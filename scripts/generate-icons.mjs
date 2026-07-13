/**
 * Nvexis PWA icon generator.
 *
 * The app icons are the OFFICIAL Nvexis prism, not a hand-drawn glyph. The
 * source art lives in `public/brand/` (copied from the Company HQ brand assets):
 *
 *   nvexis-logo-night-800.png      ink tile  (used for the app icons + favicon)
 *   nvexis-logo-day-800.png        parchment tile
 *   nvexis-mark-transparent-800.png  bare mark (used for the maskable safe zone)
 *
 * This script resizes those into the committed icon set. It requires Python +
 * Pillow (no Node image dependency added to the app):
 *
 *   python scripts/generate-icons.py     # see below — or run the inline snippet
 *
 * Because Node has no built-in image resampler, the actual resizing is done in
 * Python/Pillow. Run this to (re)generate after replacing the brand art:
 *
 *   python - <<'PY'
 *   from PIL import Image
 *   pub, brand = "public", "public/brand"
 *   night = Image.open(f"{brand}/nvexis-logo-night-800.png").convert("RGBA")
 *   mark  = Image.open(f"{brand}/nvexis-mark-transparent-800.png").convert("RGBA")
 *   for size in (512, 192):
 *       night.resize((size, size), Image.LANCZOS).save(f"{pub}/pwa-{size}x{size}.png")
 *   night.resize((180, 180), Image.LANCZOS).save(f"{pub}/apple-touch-icon.png")
 *   night.resize((64, 64),  Image.LANCZOS).save(f"{pub}/favicon-64.png")
 *   canvas = Image.new("RGBA", (512, 512), (24, 18, 16, 255))
 *   canvas.alpha_composite(mark.resize((360, 360), Image.LANCZOS), (76, 76))
 *   canvas.save(f"{pub}/maskable-512x512.png")
 *   PY
 *
 * favicon.svg is a monochrome prism silhouette used only for Safari pinned tabs.
 */
console.log(
  'Icons are the official Nvexis prism in public/brand/. ' +
    'Regenerate with the Python/Pillow snippet in this file’s header.',
);
