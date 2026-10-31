import { useState, type ReactNode } from 'react';
import type { Editor } from '@tiptap/react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Minus,
  Plus,
  Omega,
  SeparatorHorizontal,
} from 'lucide-react';
import { ToolbarPopover } from '@/components/forms/ToolbarPopover';
import { ColorPicker } from '@/features/canvas/ColorPicker';
import { cn } from '@/lib/cn';
import {
  DEFAULT_RULE,
  FONT_FAMILIES,
  FONT_SIZES,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  RULE_VARIANTS,
  RULE_WIDTHS,
  type RuleAttrs,
  type RuleVariant,
  type TextAlignment,
} from './richFormatting';
import { SYMBOL_GROUPS } from './symbols';

const DEFAULT_BODY_SIZE = 16;
const RULE_SWATCHES: readonly string[] = ['#7A2A26', '#C24A40', '#B45309', '#4D7C0F', '#0F766E', '#0369A1', '#4338CA', '#1F2937'];

const VARIANT_LABELS: Record<RuleVariant, string> = {
  solid: 'Solid',
  dashed: 'Dashed',
  dotted: 'Dotted',
  double: 'Double',
  gradient: 'Fade',
  wave: 'Wave',
  dots: 'Dots',
  stars: 'Stars',
  diamond: 'Diamond',
  fleuron: 'Flourish',
};

const ALIGNMENTS: ReadonlyArray<{ value: TextAlignment; label: string; icon: ReactNode }> = [
  { value: 'left', label: 'Align left', icon: <AlignLeft size={15} /> },
  { value: 'center', label: 'Align centre', icon: <AlignCenter size={15} /> },
  { value: 'right', label: 'Align right', icon: <AlignRight size={15} /> },
  { value: 'justify', label: 'Justify', icon: <AlignJustify size={15} /> },
];

type Panel = 'size' | 'symbols' | 'rule' | null;

function parseSize(raw: unknown): number {
  const n = typeof raw === 'string' ? Number.parseFloat(raw) : Number.NaN;
  return Number.isFinite(n) ? Math.round(n) : DEFAULT_BODY_SIZE;
}

function ToolButton({
  label,
  active = false,
  onRun,
  children,
  className,
}: {
  label: string;
  active?: boolean;
  onRun: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      // Keep the editor selection: a click must never steal focus from the text.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onRun}
      className={cn(
        'grid h-9 min-w-9 shrink-0 place-items-center rounded-lg px-1 transition-colors sm:h-8 sm:min-w-8',
        active
          ? 'bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)]'
          : 'text-fg-muted hover:bg-[var(--glass-fill)] hover:text-fg',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Font family + size, alignment, symbols and styled dividers (Word / Docs style). */
export function TypographyControls({ editor }: { editor: Editor }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [rule, setRule] = useState<RuleAttrs>(DEFAULT_RULE);
  const close = () => setPanel(null);
  const toggle = (next: Exclude<Panel, null>) => setPanel((p) => (p === next ? null : next));

  const style: Record<string, unknown> = editor.getAttributes('textStyle');
  const family = typeof style.fontFamily === 'string' ? style.fontFamily : '';
  const size = parseSize(style.fontSize);
  const ruleSelected = editor.isActive('horizontalRule');

  /** Reads the live size from the editor, so rapid clicks never use a stale render. */
  const nudgeSize = (delta: number) => {
    const live: Record<string, unknown> = editor.getAttributes('textStyle');
    setSize(parseSize(live.fontSize) + delta);
  };

  const setSize = (next: number) => {
    const clamped = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(next)));
    editor.chain().focus().setFontSize(`${clamped}px`).run();
  };

  const patchRule = (patch: Partial<RuleAttrs>) => {
    const next = { ...rule, ...patch };
    setRule(next);
    // A divider that's currently selected is restyled live.
    if (ruleSelected) editor.chain().focus().updateAttributes('horizontalRule', patch).run();
  };

  return (
    <>
      <select
        aria-label="Font"
        title="Font"
        value={FONT_FAMILIES.some((f) => f.value === family) ? family : ''}
        onChange={(e) => {
          const value = e.target.value;
          const chain = editor.chain().focus();
          (value ? chain.setFontFamily(value) : chain.unsetFontFamily()).run();
        }}
        className="h-9 max-w-[8.5rem] shrink-0 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-fill)] px-1.5 text-xs text-fg outline-none sm:h-8"
        style={{ fontFamily: family || undefined }}
      >
        <option value="">Default font</option>
        {FONT_FAMILIES.map((f) => (
          <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
            {f.label}
          </option>
        ))}
      </select>

      <ToolButton label="Smaller text" onRun={() => nudgeSize(-1)}>
        <Minus size={13} />
      </ToolButton>
      <ToolbarPopover
        open={panel === 'size'}
        onClose={close}
        title="Font size"
        trigger={
          <ToolButton label="Font size" active={panel === 'size'} onRun={() => toggle('size')} className="w-10 text-xs font-medium tabular-nums">
            {size}
          </ToolButton>
        }
      >
        <div className="grid w-44 grid-cols-4 gap-1">
          {FONT_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setSize(s);
                close();
              }}
              className={cn(
                'rounded-md px-1 py-1.5 text-sm tabular-nums transition-colors hover:bg-[var(--glass-fill)]',
                s === size && 'bg-[var(--glass-fill)] font-semibold text-fg',
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            editor.chain().focus().unsetFontSize().run();
            close();
          }}
          className="mt-2 w-full rounded-lg border border-[var(--glass-border)] px-2 py-1.5 text-xs text-fg-muted hover:text-fg"
        >
          Default size
        </button>
      </ToolbarPopover>
      <ToolButton label="Larger text" onRun={() => nudgeSize(1)}>
        <Plus size={13} />
      </ToolButton>

      {ALIGNMENTS.map(({ value, label, icon }) => (
        <ToolButton
          key={value}
          label={label}
          active={editor.isActive({ textAlign: value })}
          onRun={() => editor.chain().focus().setTextAlign(value).run()}
        >
          {icon}
        </ToolButton>
      ))}

      <ToolbarPopover
        open={panel === 'symbols'}
        onClose={close}
        title="Symbols"
        trigger={
          <ToolButton label="Symbols" active={panel === 'symbols'} onRun={() => toggle('symbols')}>
            <Omega size={16} />
          </ToolButton>
        }
      >
        <div className="max-h-72 w-64 space-y-2 overflow-y-auto pr-1">
          {SYMBOL_GROUPS.map((group) => (
            <section key={group.name}>
              <h4 className="mb-1 font-mono text-[10px] uppercase tracking-wider text-fg-subtle">{group.name}</h4>
              <div className="grid grid-cols-8 gap-0.5">
                {group.symbols.map((symbol) => (
                  <button
                    key={symbol}
                    type="button"
                    aria-label={`Insert ${symbol}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => editor.chain().focus().insertContent(symbol).run()}
                    className="grid h-7 w-7 place-items-center rounded-md text-base transition-colors hover:bg-[var(--glass-fill)]"
                  >
                    {symbol}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </ToolbarPopover>

      <ToolbarPopover
        open={panel === 'rule'}
        onClose={close}
        title={ruleSelected ? 'Edit divider' : 'Divider'}
        trigger={
          <ToolButton label="Divider" active={panel === 'rule' || ruleSelected} onRun={() => toggle('rule')}>
            <SeparatorHorizontal size={16} />
          </ToolButton>
        }
      >
        <div className="w-64 space-y-3">
          <div className="grid grid-cols-5 gap-1">
            {RULE_VARIANTS.map((variant) => (
              <button
                key={variant}
                type="button"
                aria-label={VARIANT_LABELS[variant]}
                aria-pressed={rule.variant === variant}
                title={VARIANT_LABELS[variant]}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => patchRule({ variant })}
                className={cn(
                  'rounded-md border px-1 py-1.5 text-[10px] text-fg-muted transition-colors hover:text-fg',
                  rule.variant === variant ? 'border-[var(--accent-from)] text-fg' : 'border-[var(--glass-border)]',
                )}
              >
                {VARIANT_LABELS[variant]}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-fg-muted">
            <span className="w-14">Thickness</span>
            <input
              type="range"
              min={1}
              max={12}
              value={rule.thickness}
              onChange={(e) => patchRule({ thickness: Number(e.target.value) })}
              className="flex-1"
            />
            <span className="w-6 text-right tabular-nums">{rule.thickness}</span>
          </label>
          <div className="flex items-center gap-2 text-xs text-fg-muted">
            <span className="w-14">Length</span>
            <div className="flex flex-1 gap-1">
              {RULE_WIDTHS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => patchRule({ width: w })}
                  aria-pressed={rule.width === w}
                  className={cn(
                    'flex-1 rounded-md border px-1 py-1 transition-colors',
                    rule.width === w ? 'border-[var(--accent-from)] text-fg' : 'border-[var(--glass-border)]',
                  )}
                >
                  {w}%
                </button>
              ))}
            </div>
          </div>
          <ColorPicker
            color={rule.color ?? RULE_SWATCHES[0] ?? '#7A2A26'}
            presets={RULE_SWATCHES}
            onChange={(hex) => patchRule({ color: hex })}
          />
          {!ruleSelected && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editor.chain().focus().setStyledRule(rule).run();
                close();
              }}
              className="w-full rounded-lg bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] px-2 py-2 text-sm font-medium text-[var(--accent-fg)]"
            >
              Insert divider
            </button>
          )}
          {ruleSelected && <p className="text-xs text-fg-subtle">Changes apply to the selected divider.</p>}
        </div>
      </ToolbarPopover>
    </>
  );
}
