import { describe, expect, it } from 'vitest';
import { ImportParseError } from './errors';
import { parseTrelloExport } from './trelloParser';

function minimalBoard(overrides: Record<string, unknown> = {}) {
  return {
    name: 'My Board',
    lists: [
      { id: 'list1', name: 'To Do', closed: false, pos: 1 },
      { id: 'list2', name: 'Done', closed: false, pos: 2 },
    ],
    cards: [
      {
        id: 'card1',
        name: 'First card',
        desc: 'Details',
        idList: 'list1',
        due: '2026-09-01T09:00:00.000Z',
        closed: false,
        idLabels: ['label1'],
        idChecklists: ['checklist1'],
        pos: 1,
      },
      {
        id: 'card2',
        name: 'Second card',
        idList: 'list2',
        closed: false,
        pos: 1,
      },
    ],
    labels: [{ id: 'label1', name: 'Bug', color: 'red' }],
    checklists: [
      {
        id: 'checklist1',
        idCard: 'card1',
        name: 'Steps',
        checkItems: [
          { id: 'ci1', name: 'Step one', state: 'complete', pos: 1 },
          { id: 'ci2', name: 'Step two', state: 'incomplete', pos: 2 },
        ],
      },
    ],
    ...overrides,
  };
}

describe('parseTrelloExport', () => {
  it('rejects a non-object payload', () => {
    expect(() => parseTrelloExport(null)).toThrow(ImportParseError);
    expect(() => parseTrelloExport('nope')).toThrow(ImportParseError);
  });

  it('rejects a JSON file that is not a Trello board export', () => {
    expect(() => parseTrelloExport({ foo: 'bar' })).toThrow(ImportParseError);
  });

  it('converts lists to columns and cards to cards, in position order', () => {
    const { payload } = parseTrelloExport(minimalBoard());
    expect(payload.projectName).toBe('My Board');
    expect(payload.columns).toHaveLength(2);
    expect(payload.columns[0]!.name).toBe('To Do');
    expect(payload.columns[0]!.cards).toHaveLength(1);
    expect(payload.columns[0]!.cards[0]!.title).toBe('First card');
    expect(payload.columns[1]!.cards[0]!.title).toBe('Second card');
  });

  it('maps due to both due_date and due_at', () => {
    const { payload } = parseTrelloExport(minimalBoard());
    const card = payload.columns[0]!.cards[0]!;
    expect(card.dueDate).toBe('2026-09-01');
    expect(card.dueAt).toBe('2026-09-01T09:00:00.000Z');
  });

  it('maps labels by id, deriving a name from color when unnamed', () => {
    const board = minimalBoard({
      labels: [
        { id: 'label1', name: 'Bug', color: 'red' },
        { id: 'label2', name: '', color: 'green' },
      ],
      cards: [
        {
          id: 'card1',
          name: 'Card',
          idList: 'list1',
          closed: false,
          idLabels: ['label1', 'label2'],
          pos: 1,
        },
      ],
    });
    const { payload } = parseTrelloExport(board);
    const labels = payload.columns[0]!.cards[0]!.labels;
    expect(labels).toEqual([
      { name: 'Bug', color: 'rose' },
      { name: 'Green', color: 'emerald' },
    ]);
  });

  it('merges checklist items into the card, marking done from state', () => {
    const { payload } = parseTrelloExport(minimalBoard());
    const checklist = payload.columns[0]!.cards[0]!.checklist;
    expect(checklist).toEqual([
      { text: 'Step one', done: true },
      { text: 'Step two', done: false },
    ]);
  });

  it('prefixes checklist item text with the checklist name when a card has more than one', () => {
    const board = minimalBoard({
      checklists: [
        {
          id: 'c1',
          idCard: 'card1',
          name: 'Prep',
          checkItems: [{ id: 'i1', name: 'Do X', pos: 1 }],
        },
        {
          id: 'c2',
          idCard: 'card1',
          name: 'Ship',
          checkItems: [{ id: 'i2', name: 'Do Y', pos: 1 }],
        },
      ],
    });
    const { payload, notes } = parseTrelloExport(board);
    const checklist = payload.columns[0]!.cards[0]!.checklist;
    expect(checklist).toEqual([
      { text: 'Prep: Do X', done: false },
      { text: 'Ship: Do Y', done: false },
    ]);
    expect(notes.some((note) => note.includes('merged into a single checklist'))).toBe(true);
  });

  it('skips archived lists and cards, noting the counts', () => {
    const board = minimalBoard({
      lists: [
        { id: 'list1', name: 'To Do', closed: false, pos: 1 },
        { id: 'listArchived', name: 'Old', closed: true, pos: 2 },
      ],
      cards: [
        { id: 'card1', name: 'Active', idList: 'list1', closed: false, pos: 1 },
        { id: 'card2', name: 'Gone', idList: 'list1', closed: true, pos: 2 },
      ],
      checklists: [],
    });
    const { payload, notes } = parseTrelloExport(board);
    expect(payload.columns).toHaveLength(1);
    expect(payload.columns[0]!.cards).toHaveLength(1);
    expect(notes.some((note) => note.includes('1 archived Trello list'))).toBe(true);
    expect(notes.some((note) => note.includes('1 archived Trello card'))).toBe(true);
  });

  it('notes skipped attachments', () => {
    const board = minimalBoard({
      cards: [
        {
          id: 'card1',
          name: 'Has attachments',
          idList: 'list1',
          closed: false,
          pos: 1,
          attachments: [{ id: 'a1' }, { id: 'a2' }],
        },
      ],
      checklists: [],
    });
    const { notes } = parseTrelloExport(board);
    expect(notes.some((note) => note.includes('2 Trello attachments skipped'))).toBe(true);
  });

  it('falls back to "Untitled card"/"Untitled list" for blank names', () => {
    const board = minimalBoard({
      lists: [{ id: 'list1', name: '   ', closed: false, pos: 1 }],
      cards: [{ id: 'card1', name: '  ', idList: 'list1', closed: false, pos: 1 }],
      checklists: [],
    });
    const { payload } = parseTrelloExport(board);
    expect(payload.columns[0]!.name).toBe('Untitled list');
    expect(payload.columns[0]!.cards[0]!.title).toBe('Untitled card');
  });
});
