import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { AlertCircle, Link2, Mic, Square, Upload, Video } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { GradientButton } from '@/components/buttons/GradientButton';
import { SegmentedToggle } from '@/components/forms/SegmentedToggle';
import { Spinner } from '@/components/feedback/Spinner';
import { MEDIA_CAPS, formatBytes, mediaKindForMime } from '@/lib/proFeatures';
import { validateCanvasMedia, MediaUploadError } from '@/lib/storage';
import {
  ALLOWED_EMBED_PROVIDERS,
  parseEmbedUrl,
  type ParsedEmbed,
} from './embeds';
import { useMediaRecorder, formatDuration } from './useMediaRecorder';

type Tab = 'record' | 'upload' | 'embed';

interface AddMediaModalProps {
  open: boolean;
  onClose: () => void;
  /** Hand a recorded/uploaded file to the editor to upload + place. */
  onSubmitFile: (file: File) => void;
  /** Hand a validated, allow-listed embed to the editor to place. */
  onSubmitEmbed: (embed: ParsedEmbed) => void;
}

/** Accept string for the upload file input — audio + video allow-list. */
const FILE_ACCEPT = [...MEDIA_CAPS.audio.mimeTypes, ...MEDIA_CAPS.video.mimeTypes].join(',');

/**
 * The "Add media" modal: Record (mic/camera via MediaRecorder), Upload a file, or
 * paste an allow-listed Embed link. Lazily imported by CanvasEditor so the
 * recorder + permission machinery stays out of the main bundle.
 */
export function AddMediaModal({ open, onClose, onSubmitFile, onSubmitEmbed }: AddMediaModalProps) {
  const [tab, setTab] = useState<Tab>('record');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add media"
      description="Record, upload, or embed audio & video on this canvas."
      className="max-w-xl"
    >
      <SegmentedToggle
        label="Add media method"
        value={tab}
        onChange={setTab}
        className="mb-4"
        options={[
          { value: 'record', label: 'Record', icon: <Mic size={14} /> },
          { value: 'upload', label: 'Upload', icon: <Upload size={14} /> },
          { value: 'embed', label: 'Embed', icon: <Link2 size={14} /> },
        ]}
      />

      {tab === 'record' && <RecordTab onSubmitFile={onSubmitFile} />}
      {tab === 'upload' && <UploadTab onSubmitFile={onSubmitFile} />}
      {tab === 'embed' && <EmbedTab onSubmitEmbed={onSubmitEmbed} />}
    </Modal>
  );
}

// ── Record ──────────────────────────────────────────────────────────────────

function RecordTab({ onSubmitFile }: { onSubmitFile: (file: File) => void }) {
  const [kind, setKind] = useState<'audio' | 'video'>('audio');
  const recorder = useMediaRecorder(kind);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Mirror the live stream into the preview <video> while recording video.
  useEffect(() => {
    const el = videoRef.current;
    if (el && recorder.stream) {
      el.srcObject = recorder.stream;
      void el.play().catch(() => {});
    }
  }, [recorder.stream]);

  // Switching kind mid-flow resets the recorder (the hook re-keys on `kind`).
  const overCap = recorder.recordedBytes > recorder.capBytes;
  const pct = Math.min(100, (recorder.recordedBytes / recorder.capBytes) * 100);

  return (
    <div className="space-y-4">
      <SegmentedToggle
        label="What to record"
        value={kind}
        onChange={(next) => {
          recorder.reset();
          setKind(next);
        }}
        options={[
          { value: 'audio', label: 'Audio', icon: <Mic size={14} /> },
          { value: 'video', label: 'Video', icon: <Video size={14} /> },
        ]}
      />

      {/* Live preview / state surface */}
      <div className="grid min-h-[160px] place-items-center overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-black/50">
        {kind === 'video' && recorder.status === 'recording' ? (
          <video ref={videoRef} muted playsInline className="h-[200px] w-full bg-black object-contain" />
        ) : recorder.status === 'stopped' && recorder.mediaFile ? (
          <RecordedPreview kind={kind} file={recorder.mediaFile} />
        ) : (
          <div className="px-4 py-8 text-center text-sm text-fg-muted">
            {recorder.status === 'requesting'
              ? 'Waiting for permission…'
              : kind === 'audio'
                ? 'Tap record to capture audio from your microphone.'
                : 'Tap record to capture video from your camera.'}
          </div>
        )}
      </div>

      {/* Duration + size meter against the cap */}
      {(recorder.status === 'recording' || recorder.status === 'stopped') && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-fg-muted">
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              {recorder.status === 'recording' && (
                <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />
              )}
              {formatDuration(recorder.durationMs)}
            </span>
            <span className="tabular-nums">
              {formatBytes(recorder.recordedBytes)} / {formatBytes(recorder.capBytes)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--glass-border)]">
            <div
              className={overCap ? 'h-full bg-danger' : 'h-full bg-success'}
              style={{ width: `${pct}%` }}
            />
          </div>
          {overCap && (
            <p className="text-xs text-danger">Reached the size limit — recording stopped.</p>
          )}
        </div>
      )}

      {recorder.message && (
        <p className="flex items-start gap-1.5 text-sm text-danger">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {recorder.message}
        </p>
      )}

      {kind === 'video' && (
        <p className="text-xs text-fg-subtle">
          Tip: for long videos, prefer an <strong>Embed</strong> link (YouTube/Vimeo/Loom) — uploads
          are capped at {formatBytes(MEDIA_CAPS.video.maxBytes)} and count against your storage.
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        {recorder.status === 'recording' ? (
          <GradientButton variant="secondary" leftIcon={<Square size={15} />} onClick={recorder.stop}>
            Stop
          </GradientButton>
        ) : recorder.status === 'stopped' ? (
          <>
            <GradientButton variant="ghost" onClick={recorder.reset}>
              Re-record
            </GradientButton>
            <GradientButton
              onClick={() => recorder.mediaFile && onSubmitFile(recorder.mediaFile)}
              disabled={!recorder.mediaFile}
            >
              Add to canvas
            </GradientButton>
          </>
        ) : (
          <GradientButton
            leftIcon={
              recorder.status === 'requesting' ? (
                <Spinner size={15} className="text-current" />
              ) : kind === 'audio' ? (
                <Mic size={15} />
              ) : (
                <Video size={15} />
              )
            }
            onClick={recorder.start}
            disabled={recorder.status === 'requesting'}
          >
            {recorder.status === 'denied' || recorder.status === 'error' ? 'Try again' : 'Record'}
          </GradientButton>
        )}
      </div>
    </div>
  );
}

/** A small playback preview of the just-recorded clip. */
function RecordedPreview({ kind, file }: { kind: 'audio' | 'video'; file: File }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return kind === 'audio' ? (
    <div className="w-full px-4">
      <audio src={url} controls className="w-full" />
    </div>
  ) : (
    <video src={url} controls playsInline className="h-[200px] w-full bg-black object-contain" />
  );
}

// ── Upload ────────────────────────────────────────────────────────────────--

function UploadTab({ onSubmitFile }: { onSubmitFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    const kind = mediaKindForMime(file.type);
    if (kind !== 'audio' && kind !== 'video') {
      setError('Choose an audio or video file.');
      return;
    }
    try {
      validateCanvasMedia(file);
    } catch (err) {
      setError(err instanceof MediaUploadError ? err.message : 'That file can’t be used.');
      return;
    }
    onSubmitFile(file);
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="grid w-full place-items-center gap-2 rounded-2xl border border-dashed border-[var(--glass-border)] bg-[var(--glass-fill)] px-4 py-10 text-center text-sm text-fg-muted transition-colors hover:border-[var(--accent-from)] hover:text-fg"
      >
        <Upload size={22} />
        <span className="font-medium text-fg">Choose an audio or video file</span>
        <span className="text-xs text-fg-subtle">
          Audio up to {formatBytes(MEDIA_CAPS.audio.maxBytes)} · Video up to{' '}
          {formatBytes(MEDIA_CAPS.video.maxBytes)}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={FILE_ACCEPT}
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={handleChange}
      />
      {error && (
        <p className="flex items-start gap-1.5 text-sm text-danger">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
      <p className="text-xs text-fg-subtle">
        For long videos, an <strong>Embed</strong> link keeps your canvas fast and doesn’t use
        storage.
      </p>
    </div>
  );
}

// ── Embed ─────────────────────────────────────────────────────────────────--

function EmbedTab({ onSubmitEmbed }: { onSubmitEmbed: (embed: ParsedEmbed) => void }) {
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const parsed = useMemo(() => parseEmbedUrl(value), [value]);
  const showError = touched && value.trim().length > 0 && !parsed;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="embed-url" className="text-sm font-medium text-fg">
          Paste a link
        </label>
        <input
          id="embed-url"
          type="url"
          inputMode="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="https://www.youtube.com/watch?v=…"
          className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)] px-3 py-2.5 text-sm text-fg placeholder:text-fg-subtle focus:border-[var(--accent-from)] focus:outline-none"
        />
        <p className="text-xs text-fg-subtle">Supported: {ALLOWED_EMBED_PROVIDERS}.</p>
      </div>

      {parsed && (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)] px-3 py-2 text-sm text-fg">
          <span className="rounded-md bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] px-2 py-0.5 text-xs font-semibold text-[var(--accent-fg)]">
            {parsed.label}
          </span>
          <span className="text-fg-muted">{parsed.kind === 'audio' ? 'Audio' : 'Video'} embed ready</span>
        </div>
      )}

      {showError && (
        <p className="flex items-start gap-1.5 text-sm text-danger">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          That link isn’t from a supported provider. Use {ALLOWED_EMBED_PROVIDERS}.
        </p>
      )}

      <div className="flex justify-end">
        <GradientButton
          leftIcon={<Link2 size={15} />}
          disabled={!parsed}
          onClick={() => parsed && onSubmitEmbed(parsed)}
        >
          Add embed
        </GradientButton>
      </div>
    </div>
  );
}
