import { describe, it, expect, afterEach } from 'vitest';
import { SLASH_ITEMS, allSlashItems, filterSlashItems } from './slashItems';
import { setCustomTemplates } from '../customTemplateStore';

const blocks = [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }];

afterEach(() => setCustomTemplates([])); // reset the module snapshot between tests

describe('slash menu merge (built-in + custom templates)', () => {
  it('returns only the built-ins when the user has no custom templates', () => {
    setCustomTemplates([]);
    expect(allSlashItems()).toHaveLength(SLASH_ITEMS.length);
  });

  it('appends custom templates AFTER the built-ins, under the "Your templates" section', () => {
    setCustomTemplates([
      { id: 't1', title: 'Retro', subtitle: 'My retro', blocks },
      { id: 't2', title: 'Sprint', subtitle: 'My sprint', blocks },
    ]);

    const items = allSlashItems();
    expect(items).toHaveLength(SLASH_ITEMS.length + 2);

    const custom = items.slice(SLASH_ITEMS.length);
    expect(custom.map((i) => i.title)).toEqual(['Retro', 'Sprint']);
    expect(custom.every((i) => i.section === 'Your templates')).toBe(true);
    // Built-ins keep their ungrouped identity.
    expect(items[0]?.section).toBeUndefined();
  });

  it('gives every item a stable, unique key (custom titles can collide)', () => {
    setCustomTemplates([
      { id: 'a', title: 'Plan', subtitle: '', blocks },
      { id: 'b', title: 'Plan', subtitle: '', blocks }, // same title, different id
    ]);
    const keys = allSlashItems().map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('filters custom templates by title and keywords', () => {
    setCustomTemplates([{ id: 't1', title: 'Retro', subtitle: 'My retro', blocks }]);
    expect(filterSlashItems('retro').map((i) => i.title)).toContain('Retro');
    // The generic "template" keyword also matches custom items.
    expect(filterSlashItems('template').some((i) => i.title === 'Retro')).toBe(true);
    expect(filterSlashItems('definitely-not-here')).toHaveLength(0);
  });

  it("a custom item's command inserts its stored blocks at the caret", () => {
    setCustomTemplates([{ id: 't1', title: 'Retro', subtitle: '', blocks }]);
    const item = allSlashItems().find((i) => i.title === 'Retro');
    // Minimal editor chain spy — assert the stored blocks reach insertContent.
    let inserted: unknown;
    const chain = {
      focus: () => chain,
      insertContent: (b: unknown) => {
        inserted = b;
        return chain;
      },
      run: () => true,
    };
    const editor = { chain: () => chain } as never;
    item?.command(editor);
    expect(inserted).toBe(blocks);
  });
});
