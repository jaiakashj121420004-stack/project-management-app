import { Extension } from '@tiptap/core';
import { Suggestion } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { makeSuggestionRender } from './renderer';
import { SlashMenu } from './SlashMenu';
import { filterSlashItems, type SlashItem } from './slashItems';

// Distinct plugin key so the slash suggestion never clashes with the emoji one.
const slashPluginKey = new PluginKey('slashCommand');

/**
 * Notion-style `/` command menu. Typing `/` at the start of a line (or after a
 * space) opens a filterable block picker; choosing one deletes the trigger text
 * and inserts the block. Built on @tiptap/suggestion with a tippy-free React
 * popup (see renderer.ts).
 */
export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        pluginKey: slashPluginKey,
        char: '/',
        // Only trigger at a block start or after whitespace, never mid-word.
        allowSpaces: false,
        startOfLine: false,
        items: ({ query }) => filterSlashItems(query),
        command: ({ editor, range, props }) => {
          editor.chain().focus().deleteRange(range).run();
          (props as SlashItem).command(editor);
        },
        render: makeSuggestionRender<SlashItem>(SlashMenu),
      }),
    ];
  },
});
