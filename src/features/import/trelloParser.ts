import type { LabelColor } from '@/lib/labelColors';
import { ImportParseError } from './errors';
import {
  IMPORT_MAX_CARDS,
  IMPORT_MAX_CHECKLIST_ITEMS_PER_CARD,
  IMPORT_MAX_COLUMNS,
  IMPORT_MAX_LABELS_PER_CARD,
  importPayloadSchema,
  type ImportCard,
  type ImportCardLabel,
  type ImportColumn,
  type ImportPayload,
  type ParsedImport,
} from './schemas';

/**
 * Parses a Trello board JSON export (Trello's Menu → Print, export, and
 * share → Export as JSON) into an Aurora `ImportPayload`.
 *
 * The export is a large, loosely-typed blob (board settings, member
 * avatars, a full `actions` history, Power-Up/plugin data, custom fields,
 * …) — everything below is deliberately just the slice Aurora has a matching
 * concept for. The interfaces here are NOT the full Trello API object shape
 * (see developer.atlassian.com/cloud/trello/guides/rest-api/object-definitions),
 * just the fields this parser actually reads.
 */
interface TrelloLabel {
  id: string;
  name?: string | null;
  color?: string | null;
}
interface TrelloList {
  id: string;
  name: string;
  closed?: boolean;
  pos?: number;
}
interface TrelloCheckItem {
  id: string;
  name: string;
  state?: string;
  pos?: number;
}
interface TrelloChecklist {
  id: string;
  idCard: string;
  name?: string;
  checkItems?: TrelloCheckItem[];
}
interface TrelloCard {
  id: string;
  name: string;
  desc?: string | null;
  idList: string;
  due?: string | null;
  closed?: boolean;
  idLabels?: string[];
  idChecklists?: string[];
  pos?: number;
  attachments?: unknown[];
}
interface TrelloBoardExport {
  name?: string;
  lists?: TrelloList[];
  cards?: TrelloCard[];
  labels?: TrelloLabel[];
  checklists?: TrelloChecklist[];
}

/** Trello's label palette → Aurora's eight (`lib/labelColors.ts`). Aurora has
 *  fewer swatches, so several Trello colors intentionally collapse onto the
 *  same Aurora color — that's a lossy-but-reasonable mapping, not a bug. */
const TRELLO_COLOR_TO_AURORA: Record<string, LabelColor> = {
  green: 'emerald',
  lime: 'emerald',
  yellow: 'amber',
  orange: 'amber',
  red: 'rose',
  purple: 'violet',
  blue: 'cyan',
  sky: 'cyan',
  pink: 'pink',
  black: 'slate',
  grey: 'slate',
  gray: 'slate',
};
const DEFAULT_AURORA_COLOR: LabelColor = 'slate';

function auroraColorFor(trelloColor: string | null | undefined): LabelColor {
  if (!trelloColor) return DEFAULT_AURORA_COLOR;
  return TRELLO_COLOR_TO_AURORA[trelloColor.toLowerCase()] ?? DEFAULT_AURORA_COLOR;
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The `YYYY-MM-DD` Aurora groups by, from a Trello `due` ISO instant — or
 *  null if `due` is missing/malformed. */
function dateOnlyFrom(due: string | null | undefined): string | null {
  if (!due) return null;
  const candidate = due.slice(0, 10);
  return DATE_ONLY_RE.test(candidate) ? candidate : null;
}

/** The full instant Aurora stores, or null if `due` doesn't parse as a real
 *  date — never pass an unparseable string through to the database. */
function instantFrom(due: string | null | undefined): string | null {
  if (!due) return null;
  return Number.isNaN(Date.parse(due)) ? null : due;
}

function isClosed(value: { closed?: boolean }): boolean {
  return value.closed === true;
}

/**
 * Parse the raw parsed JSON (already `JSON.parse`d, not the file text) of a
 * Trello board export. Throws `ImportParseError` for a file that isn't
 * recognisable as a Trello export at all; anything recognisable but partial
 * (missing labels, missing checklists, archived content, …) degrades
 * gracefully with a note in the returned summary instead of throwing.
 */
export function parseTrelloExport(raw: unknown): ParsedImport {
  if (typeof raw !== 'object' || raw === null) {
    throw new ImportParseError('This file is not a Trello board export.');
  }
  const board = raw as TrelloBoardExport;
  if (!Array.isArray(board.lists) || !Array.isArray(board.cards)) {
    throw new ImportParseError(
      'This doesn\'t look like a Trello board export — expected "lists" and "cards". Use Trello\'s Menu → Print, export, and share → Export as JSON.',
    );
  }

  const notes: string[] = [];

  // Labels — keyed by id so cards can look theirs up. A label with no text
  // (many Trello users leave labels color-only) falls back to its color name
  // so it still becomes a real, visible Aurora label rather than being blank.
  const labelById = new Map<string, ImportCardLabel>();
  for (const label of board.labels ?? []) {
    const name = label.name?.trim() || capitalize(label.color ?? '') || 'Label';
    labelById.set(label.id, {
      name: truncate(name, 40),
      color: auroraColorFor(label.color),
    });
  }

  // Checklists are keyed by idCard in the export, and a card can have more
  // than one — Aurora has one flat checklist per card (checklist_items),
  // so every checklist on a card is merged in order.
  const checklistsByCard = new Map<string, TrelloChecklist[]>();
  for (const checklist of board.checklists ?? []) {
    const list = checklistsByCard.get(checklist.idCard);
    if (list) list.push(checklist);
    else checklistsByCard.set(checklist.idCard, [checklist]);
  }
  let checklistsMerged = false;

  // Lists → columns.
  const allLists = board.lists ?? [];
  const openLists = allLists.filter((list) => !isClosed(list));
  const closedListCount = allLists.length - openLists.length;
  if (closedListCount > 0) {
    notes.push(
      `${closedListCount} archived Trello list${closedListCount === 1 ? '' : 's'} skipped.`,
    );
  }
  const sortedLists = [...openLists].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
  if (sortedLists.length > IMPORT_MAX_COLUMNS) {
    notes.push(
      `Only the first ${IMPORT_MAX_COLUMNS} lists were imported (board had ${sortedLists.length}).`,
    );
  }
  const listsToImport = sortedLists.slice(0, IMPORT_MAX_COLUMNS);
  const listIds = new Set(listsToImport.map((list) => list.id));

  // Cards.
  const allCards = board.cards ?? [];
  const closedCardCount = allCards.filter((card) => isClosed(card)).length;
  if (closedCardCount > 0) {
    notes.push(
      `${closedCardCount} archived Trello card${closedCardCount === 1 ? '' : 's'} skipped.`,
    );
  }
  const openCards = allCards.filter((card) => !isClosed(card) && listIds.has(card.idList));

  const cardsByList = new Map<string, TrelloCard[]>();
  let attachmentCount = 0;
  for (const card of openCards) {
    attachmentCount += card.attachments?.length ?? 0;
    const list = cardsByList.get(card.idList);
    if (list) list.push(card);
    else cardsByList.set(card.idList, [card]);
  }

  let totalCards = 0;
  let overCap = false;
  const columns: ImportColumn[] = listsToImport.map((list) => {
    const cardsInList = [...(cardsByList.get(list.id) ?? [])].sort(
      (a, b) => (a.pos ?? 0) - (b.pos ?? 0),
    );
    const importCards: ImportCard[] = [];
    for (const card of cardsInList) {
      if (totalCards >= IMPORT_MAX_CARDS) {
        overCap = true;
        continue;
      }
      totalCards += 1;

      const labels = (card.idLabels ?? [])
        .map((id) => labelById.get(id))
        .filter((label): label is ImportCardLabel => Boolean(label))
        .slice(0, IMPORT_MAX_LABELS_PER_CARD);

      const cardChecklists = checklistsByCard.get(card.id) ?? [];
      if (cardChecklists.length > 1) checklistsMerged = true;
      const checklist = cardChecklists
        .flatMap((checklistItem) => {
          const items = [...(checklistItem.checkItems ?? [])].sort(
            (a, b) => (a.pos ?? 0) - (b.pos ?? 0),
          );
          const prefix =
            cardChecklists.length > 1 && checklistItem.name ? `${checklistItem.name}: ` : '';
          return items.map((item) => ({
            text: truncate(`${prefix}${item.name}`, 500) || 'Untitled item',
            done: item.state === 'complete',
          }));
        })
        .slice(0, IMPORT_MAX_CHECKLIST_ITEMS_PER_CARD);

      importCards.push({
        title: truncate(card.name, 200) || 'Untitled card',
        description: card.desc ? truncate(card.desc, 5000) || null : null,
        dueDate: dateOnlyFrom(card.due),
        dueAt: instantFrom(card.due),
        labels,
        checklist,
      });
    }
    return {
      name: truncate(list.name, 60) || 'Untitled list',
      cards: importCards,
    };
  });

  if (overCap) {
    notes.push(`Only the first ${IMPORT_MAX_CARDS} cards were imported.`);
  }
  if (checklistsMerged) {
    notes.push(
      'Cards with more than one Trello checklist had them merged into a single checklist.',
    );
  }
  if (attachmentCount > 0) {
    notes.push(
      `${attachmentCount} Trello attachment${attachmentCount === 1 ? '' : 's'} skipped — attach files again manually if you need them.`,
    );
  }
  notes.push(
    'Comments, activity history, board members, and Power-Up/custom field data are not part of a Trello JSON export and were not imported.',
  );

  const payload: ImportPayload = {
    projectName: truncate(board.name ?? '', 80) || 'Imported board',
    columns,
  };

  const validated = importPayloadSchema.safeParse(payload);
  if (!validated.success) {
    throw new ImportParseError(
      'That Trello export could not be converted into a valid Aurora project.',
    );
  }

  return { payload: validated.data, notes };
}
