/**
 * richFormatting.ts — the Word / Google-Docs style extras for notes: font family,
 * font size, paragraph alignment, and styled dividers. Pure Tiptap definitions
 * (no React) shared by the live editor and the static renderer.
 */
import { Extension, Node, mergeAttributes, nodeInputRule } from '@tiptap/core';

/** Fonts offered in the toolbar: web-safe stacks plus the Google fonts index.html loads. */
export const FONT_FAMILIES: ReadonlyArray<{ label: string; value: string }> = [
  { label: 'Spectral (default)', value: "'Spectral', Georgia, serif" },
  { label: 'Fraunces', value: "'Fraunces', Georgia, serif" },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: "'Times New Roman', Times, serif" },
  { label: 'Playfair Display', value: "'Playfair Display', Georgia, serif" },
  { label: 'Lora', value: "'Lora', Georgia, serif" },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: "'Trebuchet MS', sans-serif" },
  { label: 'Sora', value: "'Sora', Arial, sans-serif" },
  { label: 'Manrope', value: "'Manrope', Arial, sans-serif" },
  { label: 'Poppins', value: "'Poppins', Arial, sans-serif" },
  { label: 'Nunito', value: "'Nunito', Arial, sans-serif" },
  { label: 'Courier New', value: "'Courier New', monospace" },
  { label: 'IBM Plex Mono', value: "'IBM Plex Mono', monospace" },
];

/** Sizes in the Word-style dropdown (px; the toolbar labels them as points). */
export const FONT_SIZES: readonly number[] = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72, 96];
export const MIN_FONT_SIZE = 6;
export const MAX_FONT_SIZE = 200;

export type TextAlignment = 'left' | 'center' | 'right' | 'justify';
export const TEXT_ALIGNMENTS: readonly TextAlignment[] = ['left', 'center', 'right', 'justify'];

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textAlign: {
      setTextAlign: (alignment: TextAlignment) => ReturnType;
      unsetTextAlign: () => ReturnType;
    };
    styledRule: {
      /** Insert a divider; `attrs` picks its look. */
      setStyledRule: (attrs?: Partial<RuleAttrs>) => ReturnType;
    };
  }
}

/** Paragraph / heading alignment (left, centre, right, justify). */
export const TextAlign = Extension.create({
  name: 'textAlign',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (el: HTMLElement) => {
              const value = el.style.textAlign;
              return (TEXT_ALIGNMENTS as readonly string[]).includes(value) ? value : null;
            },
            renderHTML: (attrs: Record<string, unknown>) =>
              typeof attrs.textAlign === 'string' &&
              (TEXT_ALIGNMENTS as readonly string[]).includes(attrs.textAlign)
                ? { style: `text-align:${attrs.textAlign}` }
                : {},
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setTextAlign:
        (alignment) =>
        ({ commands }) =>
          ['paragraph', 'heading'].every((type) => commands.updateAttributes(type, { textAlign: alignment })),
      unsetTextAlign:
        () =>
        ({ commands }) =>
          ['paragraph', 'heading'].every((type) => commands.resetAttributes(type, 'textAlign')),
    };
  },
});

// ── dividers ─────────────────────────────────────────────────────────────────

export const RULE_VARIANTS = [
  'solid',
  'dashed',
  'dotted',
  'double',
  'gradient',
  'wave',
  'dots',
  'stars',
  'diamond',
  'fleuron',
] as const;
export type RuleVariant = (typeof RULE_VARIANTS)[number];
export const RULE_WIDTHS = [100, 75, 50, 25] as const;

export interface RuleAttrs {
  variant: RuleVariant;
  /** Line thickness in px (1–12). */
  thickness: number;
  /** Width as a % of the page. */
  width: number;
  /** Hex colour, or null for the theme's rule colour. */
  color: string | null;
}

export const DEFAULT_RULE: RuleAttrs = { variant: 'solid', thickness: 2, width: 100, color: null };

/**
 * The divider. Same node name as StarterKit's (`horizontalRule`) so markdown /
 * Word export and old documents keep working, but it now carries a look: ten
 * styles, adjustable thickness and width, and an optional colour.
 */
export const StyledRule = Node.create({
  name: 'horizontalRule',
  group: 'block',

  addAttributes() {
    return {
      variant: {
        default: DEFAULT_RULE.variant,
        parseHTML: (el: HTMLElement) => {
          const v = el.getAttribute('data-variant');
          return (RULE_VARIANTS as readonly string[]).includes(v ?? '') ? v : DEFAULT_RULE.variant;
        },
      },
      thickness: {
        default: DEFAULT_RULE.thickness,
        parseHTML: (el: HTMLElement) => clampNumber(el.getAttribute('data-thickness'), 1, 12, DEFAULT_RULE.thickness),
      },
      width: {
        default: DEFAULT_RULE.width,
        parseHTML: (el: HTMLElement) => clampNumber(el.getAttribute('data-width'), 10, 100, DEFAULT_RULE.width),
      },
      color: {
        default: null,
        parseHTML: (el: HTMLElement) => safeColor(el.getAttribute('data-color')),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'hr' }];
  },

  renderHTML({ node }) {
    const attrs = node.attrs as RuleAttrs;
    const color = safeColor(attrs.color);
    const style = [
      `--rule-thickness:${clampNumber(String(attrs.thickness), 1, 12, DEFAULT_RULE.thickness)}px`,
      `--rule-width:${clampNumber(String(attrs.width), 10, 100, DEFAULT_RULE.width)}%`,
      color ? `--rule-color:${color}` : '',
    ]
      .filter(Boolean)
      .join(';');
    return [
      'hr',
      mergeAttributes(
        { class: 'note-rule' },
        {
          'data-variant': attrs.variant,
          'data-thickness': String(attrs.thickness),
          'data-width': String(attrs.width),
          ...(color ? { 'data-color': color } : {}),
          style,
        },
      ),
    ];
  },

  addCommands() {
    return {
      setStyledRule:
        (attrs) =>
        ({ chain }) =>
          // The trailing paragraph keeps the caret below the rule, even at document end.
          chain()
            .insertContent([{ type: this.name, attrs: { ...DEFAULT_RULE, ...attrs } }, { type: 'paragraph' }])
            .run(),
    };
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /^(?:---|—-|___\s|\*\*\*\s)$/,
        type: this.type,
      }),
    ];
  },
});

function clampNumber(raw: string | null, min: number, max: number, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Only plain hex colours reach the style attribute (no CSS injection). */
function safeColor(value: unknown): string | null {
  return typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value.trim()) ? value.trim() : null;
}
