/**
 * embeds.ts — the canvas embed allow-list (Pro P3.5).
 *
 * We render external media inside an <iframe>. An iframe pointed at an arbitrary
 * pasted URL is an XSS / clickjacking hole, so we NEVER embed a raw URL: a URL is
 * accepted only if its host matches an allow-listed provider, and we then build
 * the iframe `src` ourselves from the provider's *canonical* embed endpoint plus
 * the extracted id — never from the user's string. Unknown hosts are rejected.
 *
 * The element only ever stores the canonical embed URL we produced (see
 * MediaElement.embedUrl); MediaLayer renders that exact string. So even a stored
 * scene can't smuggle a `javascript:`/`data:`/foreign-origin iframe past us.
 */

/** The providers we allow to be embedded, and the media kind each yields. */
export type EmbedProvider = 'youtube' | 'vimeo' | 'loom' | 'soundcloud';

export interface ParsedEmbed {
  provider: EmbedProvider;
  /** audio for SoundCloud, video for the rest — drives the default box ratio. */
  kind: 'audio' | 'video';
  /** The canonical iframe src WE built (never the raw user string). */
  embedUrl: string;
  /** A friendly provider label for the UI chip. */
  label: string;
  /** Sensible default element size for this provider (world px). */
  width: number;
  height: number;
}

/** Provider display names for UI copy. */
export const EMBED_PROVIDER_LABELS: Record<EmbedProvider, string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  loom: 'Loom',
  soundcloud: 'SoundCloud',
};

/** Strip a leading "www." so host checks are uniform. */
function bareHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, '');
}

/** A YouTube video id is 11 url-safe chars; validate so we never inject junk. */
function isYouTubeId(id: string): boolean {
  return /^[A-Za-z0-9_-]{11}$/.test(id);
}

/** Vimeo / Loom ids are numeric / hex-ish — keep them to a safe charset. */
function isSimpleId(id: string): boolean {
  return /^[A-Za-z0-9]+$/.test(id);
}

function parseYouTube(url: URL): ParsedEmbed | null {
  const host = bareHost(url.hostname);
  let id: string | null = null;

  if (host === 'youtu.be') {
    id = url.pathname.split('/').filter(Boolean)[0] ?? null;
  } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (url.pathname === '/watch') {
      id = url.searchParams.get('v');
    } else {
      // /embed/ID, /shorts/ID, /v/ID, /live/ID
      const parts = url.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts', 'v', 'live'].includes(parts[0] ?? '')) id = parts[1] ?? null;
    }
  } else {
    return null;
  }

  if (!id || !isYouTubeId(id)) return null;
  return {
    provider: 'youtube',
    kind: 'video',
    embedUrl: `https://www.youtube.com/embed/${id}`,
    label: EMBED_PROVIDER_LABELS.youtube,
    width: 480,
    height: 270,
  };
}

function parseVimeo(url: URL): ParsedEmbed | null {
  const host = bareHost(url.hostname);
  if (host !== 'vimeo.com' && host !== 'player.vimeo.com') return null;
  const parts = url.pathname.split('/').filter(Boolean);
  // vimeo.com/123456789  or  player.vimeo.com/video/123456789
  const id = host === 'player.vimeo.com' ? parts[1] : parts[0];
  if (!id || !/^\d+$/.test(id)) return null;
  return {
    provider: 'vimeo',
    kind: 'video',
    embedUrl: `https://player.vimeo.com/video/${id}`,
    label: EMBED_PROVIDER_LABELS.vimeo,
    width: 480,
    height: 270,
  };
}

function parseLoom(url: URL): ParsedEmbed | null {
  const host = bareHost(url.hostname);
  if (host !== 'loom.com') return null;
  const parts = url.pathname.split('/').filter(Boolean);
  // loom.com/share/ID  or  loom.com/embed/ID
  if (parts[0] !== 'share' && parts[0] !== 'embed') return null;
  const id = parts[1];
  if (!id || !isSimpleId(id)) return null;
  return {
    provider: 'loom',
    kind: 'video',
    embedUrl: `https://www.loom.com/embed/${id}`,
    label: EMBED_PROVIDER_LABELS.loom,
    width: 480,
    height: 270,
  };
}

function parseSoundCloud(url: URL): ParsedEmbed | null {
  const host = bareHost(url.hostname);
  if (host !== 'soundcloud.com') return null;
  // SoundCloud's widget takes the track URL as a query param. We rebuild a clean
  // https://soundcloud.com/<path> (dropping query/hash) and hand it to the
  // official widget endpoint — never the raw input.
  const cleanTrack = `https://soundcloud.com${url.pathname}`;
  if (url.pathname.split('/').filter(Boolean).length < 2) return null; // need /user/track
  const widget = `https://w.soundcloud.com/player/?url=${encodeURIComponent(
    cleanTrack,
  )}&color=%237c3aed&auto_play=false&hide_related=true&show_comments=false`;
  return {
    provider: 'soundcloud',
    kind: 'audio',
    embedUrl: widget,
    label: EMBED_PROVIDER_LABELS.soundcloud,
    width: 460,
    height: 166,
  };
}

const PARSERS = [parseYouTube, parseVimeo, parseLoom, parseSoundCloud];

/**
 * Parse a pasted URL into a safe, canonical embed — or `null` if the host isn't
 * allow-listed or the URL is malformed. Callers should show a "host not
 * supported" message on null.
 */
export function parseEmbedUrl(raw: string): ParsedEmbed | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  // Only ever follow http(s); blocks javascript:, data:, etc. at the door.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  for (const parse of PARSERS) {
    const result = parse(url);
    if (result) return result;
  }
  return null;
}

/** The allow-listed provider names, for help copy. */
export const ALLOWED_EMBED_PROVIDERS = Object.values(EMBED_PROVIDER_LABELS).join(', ');
