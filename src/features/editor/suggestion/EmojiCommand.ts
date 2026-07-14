import { Extension } from '@tiptap/core';
import { Suggestion } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { gitHubEmojis } from '@tiptap/extension-emoji';
import { makeSuggestionRender } from './renderer';
import { EmojiList } from './EmojiList';

/** A pickable emoji: the Unicode glyph plus its primary shortcode. */
export interface EmojiChoice {
  name: string;
  emoji: string;
  shortcode: string;
}

// Precompute the Unicode-backed subset once (GitHub custom emoji with only an
// image fallback are skipped — we insert plain text, not nodes). Defensive: if
// the dataset ever fails to load, fall back to an empty list rather than throwing
// at module-evaluation time (which would break the whole editor chunk).
const CHOICES: EmojiChoice[] = [];
const EMOJI_SOURCE = Array.isArray(gitHubEmojis) ? gitHubEmojis : [];
for (const item of EMOJI_SOURCE) {
  if (!item?.emoji) continue;
  CHOICES.push({ name: item.name, emoji: item.emoji, shortcode: item.shortcodes?.[0] ?? item.name });
}

function filterEmojis(query: string): EmojiChoice[] {
  const q = query.trim().toLowerCase();
  if (!q) return CHOICES.slice(0, 24);
  return CHOICES.filter(
    (c) => c.shortcode.includes(q) || c.name.includes(q),
  ).slice(0, 24);
}

const emojiPluginKey = new PluginKey('emojiSuggestion');

/**
 * `:shortcode` emoji autocomplete. Typing `:sm` after a space opens a filterable
 * list; choosing one replaces the trigger with the Unicode emoji (as plain text,
 * so it needs no schema node and works in every surface). Built on the shared
 * tippy-free suggestion renderer, with its own plugin key so it coexists with the
 * slash menu.
 */
export const EmojiCommand = Extension.create({
  name: 'emojiCommand',

  addProseMirrorPlugins() {
    return [
      Suggestion<EmojiChoice>({
        editor: this.editor,
        pluginKey: emojiPluginKey,
        char: ':',
        allowSpaces: false,
        items: ({ query }) => filterEmojis(query),
        command: ({ editor, range, props }) => {
          editor.chain().focus().deleteRange(range).insertContent(`${props.emoji} `).run();
        },
        render: makeSuggestionRender<EmojiChoice>(EmojiList),
      }),
    ];
  },
});
