import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/Modal';
import { GradientButton } from '@/components/buttons/GradientButton';
import { parseEmbedUrl, ALLOWED_EMBED_PROVIDERS } from '@/features/canvas/embeds';

/**
 * Paste-a-link dialog for embedding audio/video in a note. The URL is validated
 * against the allow-list (parseEmbedUrl) and only the canonical embed URL we
 * build is ever inserted — never the raw string.
 */
export function EmbedModal({
  open,
  onClose,
  onInsert,
}: {
  open: boolean;
  onClose: () => void;
  onInsert: (attrs: { embedUrl: string; kind: 'audio' | 'video'; provider: string }) => void;
}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseEmbedUrl(url);
    if (!parsed) {
      setError(`That link isn’t supported. Paste one from ${ALLOWED_EMBED_PROVIDERS}.`);
      return;
    }
    onInsert({ embedUrl: parsed.embedUrl, kind: parsed.kind, provider: parsed.label });
    setUrl('');
    setError(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Embed audio or video" className="max-w-md">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          value={url}
          autoFocus
          onChange={(event) => {
            setUrl(event.target.value);
            setError(null);
          }}
          placeholder="Paste a YouTube, Vimeo, Loom or SoundCloud link…"
          aria-label="Embed URL"
          className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--field-bg)] px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-subtle focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)]"
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        <p className="text-xs text-fg-subtle">Supported: {ALLOWED_EMBED_PROVIDERS}.</p>
        <div className="flex justify-end gap-2">
          <GradientButton type="button" variant="ghost" onClick={onClose}>
            Cancel
          </GradientButton>
          <GradientButton type="submit" disabled={!url.trim()}>
            Embed
          </GradientButton>
        </div>
      </form>
    </Modal>
  );
}
