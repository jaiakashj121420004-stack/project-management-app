/**
 * Aurora PWA icon generator.
 *
 * The app icons are the Aurora "A"-monogram (Fraunces-inspired, outlined so it
 * needs no font at render time). The vector source of truth lives in
 * `public/brand/`:
 *
 *   aurora-mark.svg        rounded oxblood tile + bone A  (favicon + PWA "any")
 *   aurora-fullbleed.svg   edge-to-edge oxblood + centred A  (maskable + apple-touch)
 *   aurora-glyph.svg       bare oxblood A, transparent  (flexible / wordmark use)
 *   aurora-mark-night.svg  lifted-oxblood tile variant
 *
 * This script rasterises those SVGs into the committed PNG icon set. Rendering
 * from vector paths (no <text>) means the output is exact and font-independent.
 * It uses Python + CairoSVG (no Node image dependency is added to the app):
 *
 *   pip install cairosvg
 *   python - <<'PY'
 *   import cairosvg
 *   pub, brand = "public", "public/brand"
 *   def r(src, out, size):
 *       cairosvg.svg2png(url=f"{brand}/{src}", write_to=f"{pub}/{out}",
 *                        output_width=size, output_height=size)
 *   r("aurora-mark.svg",      "favicon-64.png",       64)
 *   r("aurora-mark.svg",      "pwa-192x192.png",      192)
 *   r("aurora-mark.svg",      "pwa-512x512.png",      512)
 *   r("aurora-fullbleed.svg", "maskable-512x512.png", 512)
 *   r("aurora-fullbleed.svg", "apple-touch-icon.png", 180)
 *   PY
 *
 * favicon.svg is a copy of aurora-mark.svg (also used for Safari pinned tabs).
 */
console.log(
  'Aurora icons are rendered from public/brand/aurora-*.svg. ' +
    'Regenerate with the Python/CairoSVG snippet in this file’s header.',
);
