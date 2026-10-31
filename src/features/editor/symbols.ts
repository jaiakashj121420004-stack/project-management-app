/** Characters offered by the Symbols popover (plain Unicode, so they survive export). */
export interface SymbolGroup {
  name: string;
  symbols: readonly string[];
}

export const SYMBOL_GROUPS: readonly SymbolGroup[] = [
  { name: 'Arrows', symbols: ['→', '←', '↑', '↓', '↔', '↕', '⇒', '⇐', '⇑', '⇓', '⇔', '↳', '↰', '↱', '↩', '↪', '➜', '➔', '➤', '⟶', '⟵', '⟷', '↻', '↺'] },
  { name: 'Flowchart', symbols: ['▭', '▢', '◇', '◆', '○', '●', '⬭', '⬡', '▱', '▷', '▶', '■', '□', '▲', '△', '▼', '▽', '◯', '⏹', '⌑'] },
  { name: 'Math', symbols: ['±', '×', '÷', '≠', '≈', '≤', '≥', '∞', '√', '∑', '∏', '∫', '∂', '∆', 'π', 'µ', '°', '‰', '∈', '∉', '∪', '∩', '⊂', '⊃'] },
  { name: 'Marks', symbols: ['✓', '✔', '✗', '✘', '★', '☆', '♥', '♦', '♣', '♠', '✦', '✧', '❖', '☀', '☁', '☂', '⚑', '⚠', '☎', '✉', '✎', '⚙', '♪', '♫'] },
  { name: 'Text', symbols: ['©', '®', '™', '§', '¶', '†', '‡', '•', '…', '–', '—', '«', '»', '€', '£', '¥', '¢', '₹', '№', '¿', '¡', '′', '″', '⁂'] },
];
