import { describe, it, expect } from 'vitest';
import { templateDocToBlocks, templateSubtitle } from './templateDoc';

const doc = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Standup' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Notes go here' }] },
  ],
};

describe('templateDocToBlocks', () => {
  it("returns the doc's top-level blocks", () => {
    expect(templateDocToBlocks(doc)).toEqual(doc.content);
  });

  it('returns an empty array for a missing or malformed doc', () => {
    expect(templateDocToBlocks(null)).toEqual([]);
    expect(templateDocToBlocks(undefined)).toEqual([]);
    expect(templateDocToBlocks('nope')).toEqual([]);
    expect(templateDocToBlocks({ type: 'doc' })).toEqual([]); // no content array
  });
});

describe('templateSubtitle', () => {
  it('uses the first non-empty line of text', () => {
    expect(templateSubtitle(doc)).toBe('Standup');
  });

  it('skips leading empty blocks', () => {
    const withBlank = {
      type: 'doc',
      content: [{ type: 'paragraph' }, { type: 'paragraph', content: [{ type: 'text', text: 'Real' }] }],
    };
    expect(templateSubtitle(withBlank)).toBe('Real');
  });

  it('truncates long text with an ellipsis', () => {
    const long = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x'.repeat(80) }] }],
    };
    const out = templateSubtitle(long, 10);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBe(10);
  });

  it('falls back to a generic label for an empty doc', () => {
    expect(templateSubtitle({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(
      'Custom template',
    );
  });
});
