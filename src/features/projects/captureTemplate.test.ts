import { describe, it, expect } from 'vitest';
import type { Card, CardLabel, ChecklistItem, Column, Label } from '@/types/database';
import { snapshotProjectPayload } from './captureTemplate';

// Minimal typed fixtures — snapshotProjectPayload only reads the handful of
// fields it actually uses, so we cast partial rows rather than build full DB
// shapes (mirrors board/ordering.test.ts's fixture style).
const column = (id: string, name: string, position: number): Column =>
  ({ id, name, position }) as unknown as Column;
const card = (id: string, columnId: string, title: string, position: number): Card =>
  ({ id, column_id: columnId, title, position }) as unknown as Card;
const item = (cardId: string, text: string, position: number): ChecklistItem =>
  ({ card_id: cardId, text, position, is_done: false }) as unknown as ChecklistItem;
const label = (id: string, name: string, color: Label['color']): Label =>
  ({ id, name, color }) as unknown as Label;
const cardLabel = (cardId: string, labelId: string): CardLabel => ({
  card_id: cardId,
  label_id: labelId,
});

describe('snapshotProjectPayload', () => {
  it('captures columns/cards in position order with checklist text and label name+color', () => {
    const payload = snapshotProjectPayload({
      columns: [column('col-2', 'Done', 2000), column('col-1', 'To Do', 1000)],
      cards: [card('card-1', 'col-1', 'First task', 1000)],
      checklist: [item('card-1', 'Step two', 2000), item('card-1', 'Step one', 1000)],
      labels: [label('lbl-1', 'Urgent', 'rose')],
      cardLabels: [cardLabel('card-1', 'lbl-1')],
    });

    expect(payload.columns.map((c) => c.name)).toEqual(['To Do', 'Done']);
    expect(payload.columns[0]!.cards).toEqual([
      {
        title: 'First task',
        checklist: ['Step one', 'Step two'],
        labels: [{ name: 'Urgent', color: 'rose' }],
      },
    ]);
    expect(payload.columns[1]!.cards).toEqual([]);
  });

  it('omits checklist/labels keys entirely for a plain card', () => {
    const payload = snapshotProjectPayload({
      columns: [column('col-1', 'To Do', 1000)],
      cards: [card('card-1', 'col-1', 'Plain card', 1000)],
      checklist: [],
      labels: [],
      cardLabels: [],
    });

    expect(payload.columns[0]!.cards[0]).toEqual({ title: 'Plain card' });
    expect(payload.columns[0]!.cards[0]).not.toHaveProperty('checklist');
    expect(payload.columns[0]!.cards[0]).not.toHaveProperty('labels');
  });

  it('truncates to the shared caps rather than erroring on a huge project', () => {
    const columns = Array.from({ length: 15 }, (_, i) => column(`col-${i}`, `Column ${i}`, i * 1000));
    const payload = snapshotProjectPayload({
      columns,
      cards: [],
      checklist: [],
      labels: [],
      cardLabels: [],
    });
    expect(payload.columns).toHaveLength(10);
  });
});
