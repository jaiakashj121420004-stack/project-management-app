/**
 * exportNotePdf.ts — "Export as PDF" for a note (Pro). Renders the note's
 * existing static HTML (renderBlockHtml — the exact same schema/output as any
 * other read-only render, see serialize.ts) into a hidden iframe with its own
 * print stylesheet, then triggers the browser's native print-to-PDF via
 * `iframe.contentWindow.print()`. No new dependency, and the result is real
 * selectable text — not a rasterized image — unlike a canvas-screenshot
 * approach (html2canvas+jsPDF).
 *
 * Two things renderBlockHtml's raw output can't give us for free, handled
 * here instead of in the shared static renderer:
 *   - `noteImage` stores a PRIVATE storage PATH, not a URL (see NoteImage.ts)
 *     — every image is resolved to a short-lived signed URL (noteMedia.ts)
 *     and its `load`/`error` event awaited before printing, or a broken image
 *     placeholder would silently print instead of the photo.
 *   - `noteEmbed`/`canvasLink` are atom nodes whose real UI (a video/audio
 *     player, a clickable canvas card) only exists as a live React NodeView —
 *     there is nothing for a static render to show. They're swapped for a
 *     small placeholder card with a real link, mirroring the bracketed
 *     placeholders `docToMarkdown` already uses for the same nodes.
 *
 * The print is always rendered in Aurora's Day/parchment palette regardless of
 * the app's current theme — plain hardcoded colors, not the app's CSS custom
 * properties, since the iframe is a fresh document with none of that in
 * scope. A dark background would also waste toner/ink on an actual printer,
 * which is the whole point of "print" even when the destination is a PDF.
 */
import type { JSONContent } from '@tiptap/core';
import { renderBlockHtml } from '@/features/editor/serialize';
import { safeLinkHref } from '@/features/editor/extensions';
import { resolveNoteMediaUrl } from './noteMedia';

// Fraunces (display) + Spectral (body) + IBM Plex Mono (code) — the same
// families/weights index.html loads for the live app, trimmed to just the
// three the block editor actually uses (editor.css). A fresh iframe document
// has none of the parent page's loaded fonts, so without this the PDF would
// silently fall back to the generic serif/monospace in the stack below.
const PRINT_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..900;1,9..144,400..900&family=Spectral:ital,wght@0,400;0,500;0,600;1,400;1,600&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap';

// KaTeX's own stylesheet, inlined as a string (Vite's `?inline` query returns
// the processed CSS without injecting it into the host page) — a note with a
// math formula needs it for the formula to lay out correctly at all; without
// it KaTeX's markup renders as unstyled, misaligned fraction/glyph soup.
import katexCss from 'katex/dist/katex.min.css?inline';

/** Day/parchment palette (src/styles/index.css `.light`), hardcoded — see the
 *  file header for why this can't reference the app's CSS custom properties. */
const PRINT_CSS = `
  @page { margin: 0.75in; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    background: #ECE4D6;
    color: #221A14;
  }
  body {
    padding: 0;
    font-family: 'Spectral', Georgia, serif;
    font-size: 11pt;
    line-height: 1.6;
  }
  .note-pdf-title {
    font-family: 'Fraunces', Georgia, serif;
    font-weight: 800;
    font-size: 22pt;
    line-height: 1.2;
    margin: 0 0 0.6em;
    break-after: avoid-page;
  }
  .block-editor { overflow-wrap: break-word; word-break: break-word; }
  .block-editor > :first-child { margin-top: 0; }
  .block-editor p { margin: 0.5em 0; orphans: 3; widows: 3; }
  .block-editor h1, .block-editor h2, .block-editor h3 {
    font-family: 'Fraunces', Georgia, serif;
    font-weight: 700;
    line-height: 1.25;
    margin: 1em 0 0.35em;
    break-after: avoid-page;
    break-inside: avoid;
  }
  .block-editor h1 { font-size: 17pt; font-weight: 800; }
  .block-editor h2 { font-size: 14pt; }
  .block-editor h3 { font-size: 12.5pt; }
  .block-editor strong { font-weight: 700; }
  .block-editor em { font-style: italic; }
  .block-editor u { text-decoration: underline; }
  .block-editor s { text-decoration: line-through; }
  .block-editor a { color: #7A2A26; text-decoration: underline; }
  .block-editor mark { border-radius: 0.2em; padding: 0 0.12em; }
  .block-editor ul { list-style: disc; padding-left: 1.4em; margin: 0.5em 0; }
  .block-editor ol { list-style: decimal; padding-left: 1.5em; margin: 0.5em 0; }
  .block-editor li { margin: 0.2em 0; break-inside: avoid; }
  .block-editor li > p { margin: 0.1em 0; }
  .block-editor ul[data-list-style='disc'] { list-style-type: disc; }
  .block-editor ul[data-list-style='circle'] { list-style-type: circle; }
  .block-editor ul[data-list-style='square'] { list-style-type: square; }
  .block-editor ul[data-list-style='hyphen'] { list-style-type: '–  '; }
  .block-editor ol[data-list-style='decimal'] { list-style-type: decimal; }
  .block-editor ol[data-list-style='lower-alpha'] { list-style-type: lower-alpha; }
  .block-editor ol[data-list-style='upper-alpha'] { list-style-type: upper-alpha; }
  .block-editor ol[data-list-style='lower-roman'] { list-style-type: lower-roman; }
  .block-editor ol[data-list-style='upper-roman'] { list-style-type: upper-roman; }
  .block-editor ul[data-type='taskList'] { list-style: none; padding-left: 0.2em; }
  .block-editor ul[data-type='taskList'] li { display: flex; align-items: flex-start; gap: 0.5em; }
  .block-editor ul[data-type='taskList'] li > label { margin-top: 0.3em; }
  .block-editor ul[data-type='taskList'] li > div { flex: 1 1 auto; min-width: 0; }
  .block-editor ul[data-type='taskList'] input[type='checkbox'] { width: 1em; height: 1em; }
  .block-editor ul[data-type='taskList'] li[data-checked='true'] > div {
    color: #4A3F35;
    text-decoration: line-through;
  }
  .block-editor blockquote {
    border-left: 3px solid #7A2A26;
    padding-left: 0.85em;
    margin: 0.6em 0;
    color: #4A3F35;
    font-style: italic;
    break-inside: avoid;
  }
  .block-editor code {
    font-family: 'IBM Plex Mono', ui-monospace, Menlo, monospace;
    background: rgba(244, 238, 226, 0.62);
    padding: 0.1em 0.3em;
    border-radius: 0.3em;
    font-size: 0.9em;
  }
  .block-editor pre {
    background: rgba(244, 238, 226, 0.62);
    border: 1px solid rgba(184, 154, 136, 0.75);
    padding: 0.7em 0.9em;
    border-radius: 0.5em;
    margin: 0.6em 0;
    overflow-wrap: break-word;
    white-space: pre-wrap;
    font-family: 'IBM Plex Mono', ui-monospace, Menlo, monospace;
    font-size: 0.9em;
    break-inside: avoid;
  }
  .block-editor pre code { background: none; padding: 0; }
  .block-editor hr { border: none; border-top: 1px solid rgba(184, 154, 136, 0.75); margin: 1em 0; }
  .block-editor [data-type='details'] {
    border: 1px solid rgba(184, 154, 136, 0.75);
    border-radius: 0.5em;
    padding: 0.4em 0.7em;
    margin: 0.6em 0;
    background: rgba(244, 238, 226, 0.62);
    break-inside: avoid;
  }
  .block-editor summary { font-weight: 600; }
  .block-editor [data-type='detailsContent'] { margin-top: 0.3em; padding-left: 0.2em; }
  .block-editor .tableWrapper { margin: 0.7em 0; max-width: 100%; }
  .block-editor table {
    border-collapse: collapse;
    table-layout: fixed;
    width: 100%;
    font-family: 'Spectral', Georgia, serif;
    break-inside: avoid;
  }
  .block-editor table td, .block-editor table th {
    padding: 0.4em 0.6em;
    border: 1px solid rgba(184, 154, 136, 0.75);
    vertical-align: top;
    text-align: left;
  }
  .block-editor table td > p, .block-editor table th > p { margin: 0; }
  .block-editor table th {
    font-family: 'Fraunces', Georgia, serif;
    font-weight: 700;
    background: rgba(122, 42, 38, 0.12);
  }
  .block-editor [data-math-block] { display: block; margin: 0.7em 0; text-align: center; break-inside: avoid; }
  .block-editor img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 0.7em auto;
    break-inside: avoid;
  }
  .note-pdf-embed-placeholder, .note-pdf-canvas-placeholder {
    display: block;
    margin: 0.7em 0;
    padding: 0.6em 0.8em;
    border: 1px solid rgba(184, 154, 136, 0.75);
    border-radius: 0.5em;
    background: rgba(244, 238, 226, 0.62);
    font-size: 0.92em;
    color: #4A3F35;
    text-decoration: none;
    break-inside: avoid;
  }
  .note-pdf-embed-placeholder strong, .note-pdf-canvas-placeholder strong { color: #221A14; }
  .note-pdf-embed-placeholder a { color: #7A2A26; word-break: break-all; }
  .note-pdf-image-broken {
    display: block;
    margin: 0.7em 0;
    padding: 0.5em 0.7em;
    border: 1px dashed rgba(184, 154, 136, 0.75);
    border-radius: 0.5em;
    color: #5E5346;
    font-size: 0.85em;
    font-style: italic;
  }
`;

/** Same filename-safe cleanup NoteEditor's Markdown export already applies —
 *  the sanitized title also becomes the iframe's `<title>`, which browsers use
 *  as the suggested filename in the print-to-PDF save dialog. */
function safeFileName(title: string): string {
  const cleanTitle = title.trim() || 'Untitled note';
  return cleanTitle.replace(/[^\w\- ]+/g, '').trim() || 'note';
}

/** Build the placeholder card for a `noteEmbed` node from its (now
 *  DOMPurify-surviving) `data-*` attrs — mirrors docToMarkdown's bracketed
 *  `[<provider> embed](<url>)` placeholder, as a small styled box instead. */
function embedPlaceholder(doc: Document, el: Element): HTMLElement {
  const kind = el.getAttribute('data-kind') === 'audio' ? 'Audio' : 'Video';
  const provider = el.getAttribute('data-provider') || 'embed';
  const url = safeLinkHref(el.getAttribute('data-embed-url') ?? '');
  const card = doc.createElement('div');
  card.className = 'note-pdf-embed-placeholder';
  const label = doc.createElement('strong');
  label.textContent = `${kind} — ${provider}`;
  card.appendChild(label);
  if (url) {
    card.appendChild(doc.createElement('br'));
    const link = doc.createElement('a');
    link.href = url;
    link.textContent = url;
    card.appendChild(link);
  }
  return card;
}

/** Build the placeholder card for a `canvasLink` node — a real link back to
 *  the canvas (same `/library?canvas=<id>` route CanvasLinkView navigates to
 *  on click), since the PDF viewer opens it in a browser where that works. */
function canvasLinkPlaceholder(doc: Document, el: Element): HTMLElement {
  const canvasId = el.getAttribute('data-canvas-id');
  const title = el.getAttribute('title') || 'Canvas';
  const card = doc.createElement('a');
  card.className = 'note-pdf-canvas-placeholder';
  if (canvasId) {
    card.href = `${window.location.origin}/library?canvas=${encodeURIComponent(canvasId)}`;
  }
  const label = doc.createElement('strong');
  label.textContent = `Canvas: ${title}`;
  card.appendChild(label);
  return card;
}

/** Resolve every `noteImage`'s private storage path to a signed URL and wait
 *  for it to actually load (or fail) — a naive print would otherwise fire
 *  before any signed URL resolves, printing broken image placeholders. */
async function resolveImages(doc: Document): Promise<void> {
  const images = Array.from(doc.querySelectorAll<HTMLImageElement>('img[data-note-image]'));
  await Promise.all(
    images.map(async (img) => {
      const path = img.getAttribute('data-path');
      const width = img.getAttribute('data-width');
      if (width) img.style.width = `${width}%`;
      const url = path ? await resolveNoteMediaUrl(path) : null;
      if (!url) {
        const broken = doc.createElement('span');
        broken.className = 'note-pdf-image-broken';
        broken.textContent = `[image unavailable: ${img.getAttribute('alt') || 'untitled'}]`;
        img.replaceWith(broken);
        return;
      }
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve(); // don't block the export on one bad image
        img.src = url;
        // Already cached/complete (e.g. a signed URL reused from the live
        // editor) — `load` won't re-fire, so resolve immediately.
        if (img.complete) resolve();
      });
    }),
  );
}

/** Swap every `noteEmbed`/`canvasLink` atom node for its static placeholder —
 *  their real UI is a live React NodeView with nothing for a static render to
 *  reuse (see file header). */
function replacePlaceholderNodes(doc: Document): void {
  doc.querySelectorAll('div[data-note-embed]').forEach((el) => el.replaceWith(embedPlaceholder(doc, el)));
  doc.querySelectorAll('div[data-canvas-link]').forEach((el) => el.replaceWith(canvasLinkPlaceholder(doc, el)));
}

/** Wait for the iframe's web fonts to actually be available before printing —
 *  otherwise the very first print can race the Google Fonts request and fall
 *  back to the generic serif in the stack. */
async function waitForFonts(win: Window): Promise<void> {
  try {
    await win.document.fonts.ready;
  } catch {
    // Best-effort — printing with a fallback font beats not printing at all.
  }
}

/**
 * Export a note's current document (including unsaved edits — the same
 * "what you see now" contract as the Markdown export and "save as template")
 * as a PDF, via the browser's native print-to-PDF. Resolves once the print
 * dialog has been triggered; the hidden iframe is cleaned up afterward.
 */
export async function exportNoteAsPdf(doc: JSONContent | null, title: string): Promise<void> {
  const cleanTitle = title.trim() || 'Untitled note';
  const fileName = safeFileName(title);
  const bodyHtml = renderBlockHtml(doc);

  const iframe = document.createElement('iframe');
  // Off-screen, not display:none — some browsers skip layout (and therefore
  // printing) entirely for a display:none frame. Print layout uses the
  // frame's own document flow under the @page/print media query, independent
  // of this on-screen box.
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    iframe.remove();
  };

  try {
    const win = iframe.contentWindow;
    const idoc = iframe.contentDocument;
    if (!win || !idoc) throw new Error('Could not prepare the print document.');

    idoc.open();
    idoc.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${fileName}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${PRINT_FONTS_HREF}">
<style>${katexCss}</style>
<style>${PRINT_CSS}</style>
</head>
<body>
<h1 class="note-pdf-title"></h1>
<div class="block-editor"></div>
</body>
</html>`);
    idoc.close();

    // Title set via textContent (not the template string above) so it can
    // never inject markup — the note title is untrusted user content.
    const titleEl = idoc.querySelector('.note-pdf-title');
    if (titleEl) titleEl.textContent = cleanTitle;
    const contentEl = idoc.querySelector('.block-editor');
    // bodyHtml is already DOMPurify-sanitized by renderBlockHtml — safe to set.
    if (contentEl) contentEl.innerHTML = bodyHtml;

    replacePlaceholderNodes(idoc);
    await Promise.all([resolveImages(idoc), waitForFonts(win)]);

    win.addEventListener('afterprint', cleanup, { once: true });
    // Fallback in case `afterprint` never fires (seen on some browsers when
    // the print dialog is cancelled a certain way) — don't leak the iframe.
    setTimeout(cleanup, 60_000);

    win.focus();
    win.print();
  } catch (err) {
    cleanup();
    throw err;
  }
}
