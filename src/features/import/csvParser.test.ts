import { describe, expect, it } from 'vitest';
import { ImportParseError } from './errors';
import { parseCsvImport, parseCsvRows } from './csvParser';

describe('parseCsvRows', () => {
  it('splits plain comma-separated rows', () => {
    expect(parseCsvRows('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('handles quoted fields with embedded commas and escaped quotes', () => {
    expect(parseCsvRows('List,Title\n"To Do","Say ""hi"", ok?"')).toEqual([
      ['List', 'Title'],
      ['To Do', 'Say "hi", ok?'],
    ]);
  });

  it('handles quoted fields with embedded newlines', () => {
    expect(parseCsvRows('Title\n"Line one\nLine two"')).toEqual([
      ['Title'],
      ['Line one\nLine two'],
    ]);
  });

  it('drops fully blank rows', () => {
    expect(parseCsvRows('a,b\n\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

const HEADER = 'List,Card Title,Description,Due Date,Labels';

describe('parseCsvImport', () => {
  it('rejects an empty file', () => {
    expect(() => parseCsvImport('')).toThrow(ImportParseError);
  });

  it('requires List and Card Title columns', () => {
    expect(() => parseCsvImport('Description,Due Date\nsomething,2026-01-01')).toThrow(
      ImportParseError,
    );
  });

  it('groups cards into columns by List, preserving first-seen order', () => {
    const csv = [HEADER, 'To Do,First card,,,', 'Done,Shipped one,,,', 'To Do,Second card,,,'].join(
      '\n',
    );
    const { payload } = parseCsvImport(csv);
    expect(payload.columns.map((c) => c.name)).toEqual(['To Do', 'Done']);
    expect(payload.columns[0]!.cards.map((c) => c.title)).toEqual(['First card', 'Second card']);
  });

  it('parses description, due date, and labels', () => {
    const csv = [HEADER, 'To Do,Card A,"A description",2026-09-01,"Bug,Urgent"'].join('\n');
    const { payload } = parseCsvImport(csv);
    const card = payload.columns[0]!.cards[0]!;
    expect(card.description).toBe('A description');
    expect(card.dueDate).toBe('2026-09-01');
    expect(card.labels.map((l) => l.name)).toEqual(['Bug', 'Urgent']);
  });

  it('accepts MM/DD/YYYY due dates', () => {
    const csv = [HEADER, 'To Do,Card A,,9/1/2026,'].join('\n');
    const { payload } = parseCsvImport(csv);
    expect(payload.columns[0]!.cards[0]!.dueDate).toBe('2026-09-01');
  });

  it('notes unparseable due dates and leaves them blank', () => {
    const csv = [HEADER, 'To Do,Card A,,not-a-date,'].join('\n');
    const { payload, notes } = parseCsvImport(csv);
    expect(payload.columns[0]!.cards[0]!.dueDate).toBeNull();
    expect(notes.some((note) => note.includes('due date'))).toBe(true);
  });

  it('skips rows with a blank title and notes the count', () => {
    const csv = [HEADER, 'To Do,,,,', 'To Do,Real card,,,'].join('\n');
    const { payload, notes } = parseCsvImport(csv);
    expect(payload.columns[0]!.cards).toHaveLength(1);
    expect(notes.some((note) => note.includes('no card title'))).toBe(true);
  });

  it('throws if every row is skipped and nothing is left to import', () => {
    const csv = [HEADER, 'To Do,,,,'].join('\n');
    expect(() => parseCsvImport(csv)).toThrow(ImportParseError);
  });

  it('reuses the same label color for a repeated label name', () => {
    const csv = [HEADER, 'To Do,Card A,,,Bug', 'To Do,Card B,,,Bug'].join('\n');
    const { payload } = parseCsvImport(csv);
    const [first, second] = payload.columns[0]!.cards;
    expect(first!.labels[0]!.color).toBe(second!.labels[0]!.color);
  });

  it('notes unrecognised columns', () => {
    const csv = ['List,Card Title,Extra', 'To Do,Card A,whatever'].join('\n');
    const { notes } = parseCsvImport(csv);
    expect(notes.some((note) => note.includes('Extra'))).toBe(true);
  });
});
