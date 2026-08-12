-- Migration: canvas-media server-side type/size enforcement + per-account quota
-- (decision log, memory.md, 2026-08-12 — cost/safety review before go-live).
--
-- Closes two gaps left by 20260622000000_pro_foundation.sql:
--
--   1. The per-type caps (image 10 MB / audio 25 MB / video 100 MB) in
--      src/lib/proFeatures.ts were ONLY checked client-side (lib/storage.ts).
--      The bucket's own file_size_limit is a single ceiling (100 MiB) shared by
--      every type, so a request that skipped the app UI could upload a 100 MB
--      file mislabeled as an image. Aurora's uploads always go through the
--      standard (non-resumable) `supabase.storage.from(...).upload()` call,
--      which populates storage.objects.metadata (size, mimetype) BEFORE the
--      RLS check runs on INSERT — the existing bucket/member/pro policies
--      below already prove this (they've worked since Phase P0). So we can
--      safely check metadata in WITH CHECK. Fails CLOSED (rejects) if metadata
--      or mimetype is ever missing/unrecognized — e.g. a future resumable
--      upload path would need its own explicit case here, not silently pass.
--
--   2. Nothing capped TOTAL canvas-media bytes per account — a Pro user could
--      upload an unbounded number of 100 MB videos. Adds a 10 GiB per-owner
--      quota (CANVAS_MEDIA_QUOTA_BYTES, mirrored in src/lib/proFeatures.ts).
--      "Per-owner" because the board OWNER's plan already governs the whole
--      board (project_is_pro), so their quota covers every project they own.
--
-- Keep the byte thresholds below in sync with MEDIA_CAPS / CANVAS_MEDIA_QUOTA_BYTES
-- in src/lib/proFeatures.ts. Idempotent: safe to re-run.

-- 1. Per-type mimetype + size check from the object's own metadata -----------
create or replace function public.canvas_media_within_caps(p_metadata jsonb)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select case coalesce(p_metadata->>'mimetype', '')
    when 'image/png'       then coalesce((p_metadata->>'size')::bigint, 9223372036854775807) <= 10485760   -- 10 MB
    when 'image/jpeg'      then coalesce((p_metadata->>'size')::bigint, 9223372036854775807) <= 10485760
    when 'image/gif'       then coalesce((p_metadata->>'size')::bigint, 9223372036854775807) <= 10485760
    when 'image/webp'      then coalesce((p_metadata->>'size')::bigint, 9223372036854775807) <= 10485760
    when 'audio/webm'      then coalesce((p_metadata->>'size')::bigint, 9223372036854775807) <= 26214400   -- 25 MB
    when 'audio/mpeg'      then coalesce((p_metadata->>'size')::bigint, 9223372036854775807) <= 26214400
    when 'audio/mp4'       then coalesce((p_metadata->>'size')::bigint, 9223372036854775807) <= 26214400
    when 'audio/ogg'       then coalesce((p_metadata->>'size')::bigint, 9223372036854775807) <= 26214400
    when 'audio/wav'       then coalesce((p_metadata->>'size')::bigint, 9223372036854775807) <= 26214400
    when 'video/webm'      then coalesce((p_metadata->>'size')::bigint, 9223372036854775807) <= 104857600  -- 100 MB
    when 'video/mp4'       then coalesce((p_metadata->>'size')::bigint, 9223372036854775807) <= 104857600
    when 'video/ogg'       then coalesce((p_metadata->>'size')::bigint, 9223372036854775807) <= 104857600
    when 'video/quicktime' then coalesce((p_metadata->>'size')::bigint, 9223372036854775807) <= 104857600
    else false -- unknown/missing mimetype: reject rather than guess
  end;
$$;

comment on function public.canvas_media_within_caps(jsonb) is
  'SECURITY DEFINER: does this storage.objects.metadata match an allowed canvas-media type and its per-type size cap? Fails closed on unknown/missing mimetype or size.';

-- 2. Per-owner total-bytes quota ----------------------------------------------
-- Sums existing canvas-media bytes across every project owned by the SAME
-- owner as p_project_id (the board owner's storage covers their whole
-- workspace), then checks it plus the incoming file against the quota. Scoped
-- to one owner's own projects, so the scan stays bounded by their own usage —
-- not the whole bucket.
create or replace function public.canvas_media_quota_ok(p_project_id uuid, p_new_bytes bigint)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(
    (
      select sum((o.metadata->>'size')::bigint)
      from storage.objects o
      where o.bucket_id = 'canvas-media'
        and split_part(o.name, '/', 1)::uuid in (
          select p.id from public.projects p
          where p.owner_id = (select owner_id from public.projects where id = p_project_id)
        )
    ), 0
  ) + coalesce(p_new_bytes, 0) <= 10737418240; -- 10 GiB per account
$$;

comment on function public.canvas_media_quota_ok(uuid, bigint) is
  'SECURITY DEFINER: would adding p_new_bytes push this project owner past the 10 GiB total canvas-media quota?';

-- 3. Usage readout for the UI (a "4.2 GB of 10 GB used" indicator) -----------
create or replace function public.my_canvas_media_usage_bytes()
returns bigint
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(sum((o.metadata->>'size')::bigint), 0)
  from storage.objects o
  where o.bucket_id = 'canvas-media'
    and split_part(o.name, '/', 1)::uuid in (
      select p.id from public.projects p where p.owner_id = auth.uid()
    );
$$;

comment on function public.my_canvas_media_usage_bytes() is
  'Total canvas-media bytes across every project the caller owns — powers a storage-used indicator in the UI.';

grant execute on function public.my_canvas_media_usage_bytes() to authenticated;

-- 4. Wire both checks into the existing INSERT/UPDATE policies ---------------
drop policy if exists "canvas-media: insert if pro member" on storage.objects;
create policy "canvas-media: insert if pro member"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'canvas-media'
    and public.is_project_member(split_part(name, '/', 1)::uuid)
    and public.project_is_pro(split_part(name, '/', 1)::uuid)
    and public.canvas_media_within_caps(metadata)
    and public.canvas_media_quota_ok(split_part(name, '/', 1)::uuid, (metadata->>'size')::bigint)
  );

drop policy if exists "canvas-media: update if pro member" on storage.objects;
create policy "canvas-media: update if pro member"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'canvas-media'
    and public.is_project_member(split_part(name, '/', 1)::uuid)
    and public.project_is_pro(split_part(name, '/', 1)::uuid)
  )
  with check (
    bucket_id = 'canvas-media'
    and public.is_project_member(split_part(name, '/', 1)::uuid)
    and public.project_is_pro(split_part(name, '/', 1)::uuid)
    and public.canvas_media_within_caps(metadata)
  );
