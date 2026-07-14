# Nvexis — Design Guidelines (Brand Bible)

*The single source of truth for how Nvexis looks. Every project, post, slide, app, and page follows this. Version 5.1 · 15 July 2026.*
*v5.1 (Phase 7): verified §11 against the shipped implementation — the CSS vars (`--glass-fill`/`--glass-border`/`--glass-shadow`/`--field-bg`/`--accent-glow`/`--accent-from`) and file paths named below all exist in `src/styles/index.css`, `src/lib/{accents,contrast,motion}.ts`, and `src/components/Avatar.tsx`. Logo = the **Aurora "A"-monogram** (oxblood tile, `public/brand/aurora-*.svg`); the retired "Lodestar" codename must not reappear in user-facing copy.*
*System name: **The Almanac** (Editorial Authority) — a serious publication with a century of back-issues, not a startup template.*

> **Why this exists:** ~88% of a brand judgment happens in the first 90 milliseconds, driven mostly by colour, and ~46% of people judge credibility on visual design alone. Consistency across every surface is what turns a logo into a brand. Use the exact tokens below — they are law.

---

## 0. Two canonical surfaces (read this first)

The brand lives on **two surfaces**, and both are canonical. Earlier versions of this
file described only the first and then *banned* the very system the second is built
on — so the doc contradicted the shipped **Aurora** app. v5.0 fixes that: it documents
**both**, and says exactly where each applies.

| Surface | What it is | Finish |
|---|---|---|
| **A — Editorial (print / social / marketing)** | Posts, slides, newsletters, one-pagers, the marketing hero. | **Flat Almanac.** Two inks on aged paper. No glass, no glow, no mesh. Character from type + rules + whitespace. |
| **B — Product UI (the Aurora app)** | The signed-in application — boards, Library, canvas, calendar. | **Glass-over-parchment.** The Almanac palette + type, rendered on **warmed frosted-glass** surfaces with a subtle **paper-grain**, single-family **gradient accent tiles**, and calm **Framer motion / tactile depth**. |

**Same ink, same paper, same type, same restraint — different finish.** The app is a
*living, tactile* almanac (glass panels floating on parchment); print is a *bound,
flat* one. When a rule below says "no gradients / no glow / flat paper," it governs
**Surface A**. The **Surface B** system is specified in §11.

> The old blanket bans on glassmorphism, gradients, glow and motion applied to
> Surface A only. They were never meant to outlaw the app's own design system — this
> version makes that explicit rather than leaving the doc at war with the product.

---

## 1. Design philosophy

**What we are NOT (the looks we reject):**
- ❌ The **generic AI / fintech** look — navy/blue-black, *cold* neon gradients, *blue-white* glassmorphism, Inter, and the four-point "✨" sparkle. Everyone ships it; it reads machine-made. *(It's also where our old mark and spring-green accidentally lived — the sparkle is the most AI-coded glyph in use, and #46CC5B sat in the Robinhood/Spotify family.)* **Note:** the Aurora app's **warm oxblood-on-parchment** glass is the opposite of this cold frost — see §11; the thing we reject is the *cold blue* version and *rainbow* gradients, not glass or warm depth as such.
- ❌ The **get-rich-quick guru** look — gold-on-black, hype, fake luxury, shouting. The exact opposite of who we are.

**What we ARE: The Almanac.** A serious, century-old publication. Two inks on aged paper — **oxblood** and **ink** on **parchment**. The authority of a bound financial almanac and a printer's craft: earned knowledge, the long voyage, depth over noise. Character comes from a distinctive serif and disciplined editorial layout, not from effects.

> **"Isn't warm + serif the 'Claude trap' we rejected in v3?"** No — and the distance is the point. Claude's palette is *coral/peach on cream* — soft, friendly, conversational. Ours is **oxblood (#7A2A26) on parchment**: the deep blood-red of old ledgers, set in a high-contrast display serif on a precise editorial grid. One is a warm chatbot; the other is a serious publishing house.

**Five principles:**
1. **Authority over decoration.** Rules, drop caps, folios, generous margins. It reads *edited* — a publication, not a feed.
2. **Two inks, one paper.** Oxblood is the only chroma in the room. Restraint is the luxury.
3. **Earned, not loud.** No neon, no gold, no hype. The seriousness *is* the differentiation — built for people who do the work, not the get-rich-quick crowd.
4. **Set, don't decorate.** Character comes first from the type (Fraunces + Spectral) and the grid — not from effects. On **editorial** surfaces that means *no* gloss/glow/gradient at all; in the **app** (§11) the glass + depth are a quiet, warm *substrate* for the same type and grid, never the star.
5. **Two true modes.** Day (parchment) is the hero — it's a publication. Night (ink) is its lamplit pair, never an afterthought.

---

## 2. The two modes (designed as a pair)

Both are first-class. **Day** is the hero (a publication is read on paper); **Night** is the same almanac read by lamplight.

| | Day (light, hero) | Night (dark) |
|---|---|---|
| **Page** | Parchment **#ECE4D6** | Ink **#181210** |
| **Surface (cards)** | `#F4EEE2` | `#211917` |
| **Text** | Ink `#221A14` · body `#4A3F35` | Bone `#ECE2D2` · body `#C7BAA9` |
| **Muted** | Umber `#5E5346` | `#9E9082` |
| **Hairline** | `#CDBFA8` | `#352724` |
| **Accent** | Oxblood **#7A2A26** | Oxblood **#C24A40** (lifted for dark) |

On **editorial** surfaces (Surface A) backgrounds are **flat aged paper** — no gradients, no glow, no mesh; the texture lives in the *type and the rules*. The **app** (Surface B, §11) sits its glass panels on the same parchment/ink page plus a subtle paper-grain and a soft accent glow — warm depth, not cold frost.

> **Both modes are fully realised as kits:** `Nvexis-Editorial-Identity.html` (Day / light) and `Nvexis-Editorial-Identity-Dark.html` (Night / dark). The Night kit also documents **surface elevation** (depth via hairline + lift, never shadow-soup) and the **Light↔Dark token parity** every app wires into its theme switch.

---

## 3. Colour system

### Palette (every pair WCAG-AA audited)
| Token | Name | Hex (Day) | Hex (Night) | Role |
|---|---|---|---|---|
| `--ox` | Oxblood | `#7A2A26` | `#C24A40` | **The accent.** The mark, links, emphasis, rules. |
| `--ox-bright` | Oxblood Bright | `#9B3A33` | `#D2675C` | Hover; small accent text on dark. |
| `--page` | Parchment / Ink | `#ECE4D6` | `#181210` | Page base. |
| `--surface` | Surface | `#F4EEE2` | `#211917` | Cards, raised panels. |
| `--ink` | Ink / Bone | `#221A14` | `#ECE2D2` | Primary text & rules. |
| `--ink2` | Body | `#4A3F35` | `#C7BAA9` | Long-form body text. |
| `--muted` | Umber | `#5E5346` | `#9E9082` | Captions, datelines, folios. |
| `--hair` | Hairline | `#CDBFA8` | `#352724` | Rules, dividers, borders. |
| `--gilt` | Gilt | `#8A6A2E` | `#C7A24E` | **Rare.** Hairline flourishes / foil only — never body text. |
| `--signal` | Signal | `#B23A2E` | `#D8634A` | Genuine loss / risk only (use rarely). |

### Measured contrast (the receipts)
Day, on parchment: Ink **13.6 : 1** · Body **8.1 : 1** · Umber **5.9 : 1** · Oxblood **7.6 : 1**. Night holds too (Bone **14.5 : 1**; oxblood lifted to `#C24A40`). **Nothing ships under AA (4.5 : 1) for text.**

### Colour psychology (the *why*)
- **Oxblood:** the ink of old ledgers and bound almanacs — value, seriousness, permanence. Deep enough never to read "hype red," and distinct from fintech-green and AI-violet alike. It is the brand's single guiding mark.
- **Parchment & ink:** aged paper and printer's ink — calm, credible, made to last. Cooler and more serious than Claude's cream.
- **Restraint is the luxury.** Oxblood earns attention because it is the only chroma in the room.

### The 60 / 35 / 5 rule
~60% parchment, ~35% ink/structure, ~5% oxblood. **One accent moment per view.**

### Accessibility (target WCAG AA)
- Body copy uses **`--ink2`**, never `--muted` — *that was the old contrast bug (muted fell to ~4.4 : 1 on parchment).* Captions/datelines may use `--muted` (still ≥ 5.9 : 1).
- **Oxblood button:** Day = oxblood fill + `#F7F1E6` text (8.5 : 1). Night = deepen the fill to **`#8E332D`** + `#F7F1E6` (5.9 : 1) so the label keeps contrast.
- On dark, small oxblood *text/links* use `--ox-bright #D2675C`; the `#C24A40` accent is for the mark, rules and large headings.
- Gilt is decorative / large only — never small text.

---

## 4. Typography

Distinctive, free (Google Fonts), and deliberately **not Inter**. The serif is the signature.

| Role | Font | Use |
|---|---|---|
| **Display / headlines** | **Fraunces** (900; italic for pull-quotes) | Headlines, hero, wordmark. An "old-style" display serif — characterful, warm, authoritative. The signature. |
| **Body / long-form** | **Spectral** (400/500/600) | All reading text, ledes, captions. A screen-true serif built for long form. |
| **Figures / data** | **IBM Plex Mono** (500) | Numbers, prices, %, datelines, folios, eyebrows. The "instrument" texture. |

### Type scale (big jumps, no in-betweens)
| Step | Size (px) | Font / weight |
|---|---|---|
| Display | 58–128 (clamp) | Fraunces 900 |
| H1 | 44 | Fraunces 900 |
| H2 | 30 | Fraunces 900 |
| H3 | 21 | Fraunces 600 / 900 |
| Lede | 20–21 | Spectral 400 italic |
| Body | 17 | Spectral 400 |
| Small | 14 | Spectral 400 / 500 |
| Eyebrow / folio | 11.5 | IBM Plex Mono 600, UPPERCASE, +0.22em |
| Figure | varies | IBM Plex Mono |

### Rules
- **Fraunces headline + Spectral body** — never mix up. Headlines big, tight (`-.018em`), confident.
- **The editorial details are the brand:** drop caps lead features; **small caps** open sections; **oldstyle figures** (`font-feature-settings:"onum"`) sit inside prose; lining mono figures handle data tables and stats.
- Mono for *every* number that matters (prices, %, subscriber counts) — a brand signature kept from before.
- Eyebrows (tiny uppercase mono, often oxblood) above headlines = the editorial polish.
- Sentence case for UI; headline/title case for article titles. ALL CAPS only for eyebrows / folios.

---

## 5. Layout, grid & the editorial details

- **12-column grid**, generous margins (72–96px desktop), 24px gutter.
- **Spacing scale (8px base):** 4, 8, 12, 16, 24, 32, 48, 64, 96. Only these.
- **Rules & folios:** thin hairlines, **double-rules** under mastheads, and small mono **folios** (`PG. 01`, `No. 001`, `Vol. I`) give the publication feel.
- **Fleurons:** the oxblood star, centred between two hairlines, is the section break — a printer's flower. Use it to separate movements; keep it restrained.
- **Leader dots** for contents lists (title … page). **Drop caps** to open features. **Pull-quotes** in Fraunces italic.
- **Whitespace first.** Calm and spacious = premium. One focal point per screen: eyebrow → headline → lede → body → action.
- Backgrounds: **flat parchment / ink** — never a gradient or glow.

---

## 6. Logo & motifs

- **The mark — the Nvexis prism:** a **faceted gem whose three planes converge to a single apex** — *nexus* (paths meeting) + *vertex* (the point), the meaning of the name made visible. Day: three oxblood facet-tones (`#5E211E` / `#7A2A26` / `#A0453B`) on parchment. Night: brighter oxblood with a bone facet (`#9A3A34` / `#C24A40` / `#ECE2D2`) on ink. Mono: single-ink line-art (outline + three facet edges). Keep the geometry fixed; never re-tint outside the oxblood family. *(Introduced 5 Jul 2026 with the Lodestar to Nvexis rename; replaced the four-point star.)*
- **Clear space:** equal to the gem's half-height on all sides. **Min size:** 16px (use the `nvexis-favicon` variant below 24px).
- **Wordmark:** "Nvexis" in **Fraunces 900**, tight tracking. The prism leads the word or stands alone.
- **Facet as fleuron:** a single cropped facet-triangle, small, as a section divider and recurring motif (mastheads, dividers, social).
- **Logo files (ready):** `Nvexis Rebrand/Editorial Authority/logo/` — day, night, mono ink, reverse/parchment, app-icon tiles, favicon, wordmark lockup.
- **Product sub-brand — the Aurora "A" (added 14 Jul 2026):** the **Aurora** app (a Nvexis product) carries its **own product logo**: a Fraunces-style **high-contrast serif "A"** knocked out of an **oxblood tile** (letter in warm bone `#F3ECDD`; tile uses the theme oxblood so it stays vivid on Day parchment + Night ink). It is the *product* mark — the Nvexis prism remains the *company* mark and is not used inside the app. Outlined-vector source: `public/brand/aurora-{mark,mark-night,fullbleed,glyph}.svg` (font-independent); rendered in-app by `AuroraMark` in `components/shell/Brand.tsx`; rasterised to `favicon`/PWA/apple-touch/maskable via `scripts/generate-icons.mjs`. Min size 16px; wordmark "Aurora" in **Fraunces**, single oxblood accent (no gradient).
- **Imagery:** duotone (ink × oxblood) or high-contrast mono. No generic stock realism.
- **Banned everywhere (both surfaces):** spring-green / neon, gold-or-foil-as-primary, navy/blue, violet, *cold blue-white* glass, *rainbow / multi-hue* gradients, Inter, the four-point AI sparkle, drop-shadow soup (uncontrolled shadows).
- **Editorial-only bans (Surface A):** *any* glassmorphism, gradient, or glow. The **app** (§11) may use **warm oxblood-family** glass, single-family accent gradients, and a controlled accent glow — see §11 for the exact, permitted forms.

---

## 7. Components (both modes)

- **Primary button:** oxblood fill + `#F7F1E6` text (Night fill deepens to `#8E332D`), `border-radius: 2px`, generous padding. One per view.
- **Secondary (ghost):** transparent, 1px border in `--ink`; on hover, fills ink with parchment text.
- **Cards:** surface colour, 1px hairline, `border-radius: 4px`, 24–28px padding, flat. Optional masthead double-rule for "issues."
- **Tags / pills:** small mono uppercase; oxblood text on a hairline border.
- **Data / figures:** IBM Plex Mono; oxblood for emphasis, `--signal` only for genuine loss / risk.

### Web/app vs social
- **Web & app UIs:** full system, both modes, rules, folios, fleurons. Flat paper.
- **Social posts:** flat, bold, high-contrast. Huge Fraunces headline, one oxblood moment, the star, big margins. Alternate Day/Night by pillar for recognisability:
  - Markets & Money → Day (parchment), oxblood accent
  - Mind & Psychology → Night (ink), oxblood accent
  - AI & Leverage → Night (ink), bone + oxblood
  - Sectors & Signals → Day (parchment), ink + oxblood

---

## 8. Voice ↔ visual alignment
- *Engineer / systems* → the grid, mono figures, precise rules.
- *Honest / anti-guru* → no hype, no gloss, no gold; an edited page that respects the reader.
- *Calm, quiet confidence* → parchment, whitespace, one oxblood accent.
- *Depth / earned mastery* → the almanac, the serifs, the folios — a publication you return to.

---

## 9. Consistency rules (every project follows)

This file lives in every Nvexis-brand folder. Whatever you build — CO-CE outputs, Cairn, Aurora, Fintrack, the websites, the newsletter, slides, Discord branding — pulls from these exact tokens:

1. **Only** the palette in §3 (exact hex), both Day + Night.
2. **Only** Fraunces (display) + Spectral (body) + IBM Plex Mono (figures). Never Inter.
3. The **8px spacing scale** and the **type scale** — no arbitrary values.
4. **60 / 35 / 5**; **one accent family per surface** (§11) — never oxblood + an unrelated hue in the same card/tile/avatar cluster; both modes supported.
5. **No** spring-green / gold-as-primary / neon / navy / violet / *cold* glass / *rainbow* gradient / Inter / AI-sparkle. (Warm oxblood-family glass + single-family gradients are allowed **in the app only** — §11.)
6. Body text uses **`--ink2`**, not `--muted` (the audited contrast rule); every pill/badge/caption clears **AA (≥ 4.5 : 1)** in both modes (§11 tokens).
7. When unsure, choose the more **spacious, more precise** option — and let the work talk.

> Feed these tokens into CO-CE's Design Director and every app's stylesheet. Consistency compounds recognition into trust.

---

## 10. Quick-reference tokens (for devs / CO-CE)

```css
:root{ /* DAY — parchment (hero) */
  --page:#ECE4D6; --surface:#F4EEE2; --ink:#221A14; --ink2:#4A3F35;
  --muted:#5E5346; --hair:#CDBFA8; --ox:#7A2A26; --ox-bright:#9B3A33;
  --on-ox:#F7F1E6; --gilt:#8A6A2E; --signal:#B23A2E;
  --font-disp:'Fraunces',Georgia,serif;
  --font-body:'Spectral',Georgia,serif;
  --font-mono:'IBM Plex Mono',ui-monospace,monospace;
  --radius:2px; --radius-card:4px; --space:8px; /* 4 8 12 16 24 32 48 64 96 */
}
.night, [data-mode="night"]{ /* NIGHT — ink */
  --page:#181210; --surface:#211917; --ink:#ECE2D2; --ink2:#C7BAA9;
  --muted:#9E9082; --hair:#352724; --ox:#C24A40; --ox-bright:#D2675C;
  --on-ox:#1A0E0C; --btn-bg:#8E332D; --gilt:#C7A24E;
}
```
Fonts (free): `fonts.google.com/specimen/Fraunces`, `/Spectral`, `/IBM+Plex+Mono`.
Living reference — **two kit pages**: `Nvexis-Editorial-Identity.html` (Day / light) + `Nvexis-Editorial-Identity-Dark.html` (Night / dark, incl. elevation + Light↔Dark parity), plus `logo/` — all in `Nvexis Rebrand/Editorial Authority/`.

---

## 11. The Aurora app — "glass-over-parchment" (Surface B, the source of truth for the product)

This section describes the system the **Aurora** app is *actually* built on. It is
canonical — where an earlier blanket ban and this section disagree, **this section
governs the app.** The goal is unchanged: the Almanac's authority and restraint, made
tactile. Think *warm frosted panels floating on aged paper*, not cold fintech frost.

### What we KEEP from the Almanac
Everything that carries meaning: the exact §3 palette (both modes), the §4 type
(Fraunces / Spectral / IBM Plex Mono, never Inter), the 8px spacing scale, **oxblood as
the single accent**, 60 / 35 / 5, and AA contrast on all text.

### What the app ADDS (the permitted "glass-over-parchment" forms)
- **Warmed frosted glass surfaces.** Cards, panels, the sidebar, the top bar and modals
  are translucent glass **warmed onto paper** — a parchment/ink fill at partial opacity
  with a `backdrop-blur` and a hairline border, driven by CSS vars (`--glass-fill`,
  `--glass-border`, `--glass-shadow`, `--field-bg`) in `src/styles/index.css`. It is
  **never** the cold blue-white frost we reject — the tint is always warm paper.
- **Paper-grain.** A subtle noise texture over the page for tactility (the app's answer
  to the almanac's stock), plus a soft **accent glow** (`--accent-glow`) behind key
  surfaces. Warm depth, never a rainbow mesh.
- **Single-family accent tiles & gradients.** Icon tiles, the Pro badge, and the small
  card accent-strip use `linear-gradient(--accent-from → --accent-to)` — but the two
  stops are **always the same hue family** (per-project earthy accents in
  `src/lib/accents.ts`, defaulting to oxblood). One family per surface.
- **Per-project accents (subtle).** A project may pick an *earthy* accent (oxblood, gilt,
  clay, pine, terracotta, umber). It tints that project's own headers/cards only — it is
  the *one* accent moment on that surface, not a second competing hue.
- **Calm motion & tactile depth.** Framer Motion springs (`src/lib/motion.ts`), a card
  pointer-tilt, and 3D tactile buttons — editorial and calm, **gated behind
  `prefers-reduced-motion`** (`<MotionConfig reducedMotion="user">` + CSS guards).

### One accent family per surface (accent-restraint law — Phase 4)
A single surface (a card, tile, avatar cluster, toolbar) must show **one accent family**.
- **Semantic colour is exempt and stays multi-hue** *by meaning*: status (`success` /
  `warning` / `danger` / `info`), priority tiers, due-date urgency, user-chosen **label**
  colours, and multiplayer **cursor** colours. These are information, not decoration —
  they are theme-reactive tokens tuned to AA, not brand accents.
- **Decoration must not introduce a second family.** Avatars use an **oxblood-family
  tonal ramp** (`src/components/Avatar.tsx`), *not* a rainbow hash. Icon tiles inherit the
  surface's own accent. (Before Phase 4, avatars hashed across six unrelated families, so
  one card could show four competing hues — audit §1. That is now fixed.)

### Contrast & tokens (AA, both modes)
- Label/priority/status pills derive a **darkened (Day) / lightened (Night)** foreground
  via `src/lib/contrast.ts` (`readableOnTint`) so every pill clears AA on its tint — never
  render a saturated swatch hex as text.
- `success` / `info` / `warning` / `danger` are **theme-reactive CSS vars**, not fixed hex.

### Radius scale (consolidated — Phase 3)
Use **md / xl / 2xl (+ full)** only. `rounded-3xl` / `rounded-4xl` are retired.

### Where each surface applies
Glass-over-parchment is the **app** (Surface B). The **marketing site** and all print /
social (Surface A) stay flat Almanac — the one bridge is the palette, type and oxblood
accent, which are shared. Keep them distinct: a slide should never wear app glass, and the
app should never flatten into a poster.

---

*If a decision isn't covered here, ask: "What would a serious almanac — edited, set in metal type, made to last — do?" — then do that. Two inks, one paper, the nvexis, lots of space. In the app, that almanac is made tactile: warm glass on parchment, one accent in the room.*
