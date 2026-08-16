import { LABEL_COLOR_NAMES, type LabelColor } from '@/lib/labelColors';
import { ImportParseError } from './errors';
import {
  IMPORT_MAX_CARDS,
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
 * Minimal RFC4180 CSV tokenizer: handles quoted fields (embedded commas,
 * newlines, and `""`-escaped quotes). Good enough for a hand-built or
 * spreadsheet-exported CSV without pulling in a parsing dependency for what
 * is a one-time import flow — not a full CSV-dialect implementation (no
 * custom delimiters/BOM sniffing beyond what's handled below).
 */
export function parseCsvRows(text: string): string[][] {
  // Strip a UTF-8 BOM (common from Excel/Sheets CSV exports) and normalize
  // line endings before tokenizing.
  const normalized = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < normalized.length) {
    const char = normalized[i]!;
    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }
  // Final field/row for files with no trailing newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully-blank trailing/interstitial lines produced by the tokenizer.
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
}

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

/** Accepts `YYYY-MM-DD` and `MM/DD/YYYY`; anything else (including the
 *  ambiguous `DD/MM/YYYY`) is left unparsed rather than guessed wrong. */
function parseCsvDate(raw: string): string | null {
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (isoMatch) {
    const [, year, month, day] = isoMatch as unknown as [string, string, string, string];
    const asDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (!Number.isNaN(asDate.getTime())) return `${year}-${month}-${day}`;
  }
  const usMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (usMatch) {
    const [, monthRaw, dayRaw, year] = usMatch as unknown as [string, string, string, string];
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    const asDate = new Date(Date.UTC(Number(year), month - 1, day));
    if (!Number.isNaN(asDate.getTime()) && asDate.getUTCMonth() === month - 1) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return null;
}

/**
 * Parse a generic CSV export into an `ImportPayload`. Expected columns
 * (case-insensitive, any order): `List`, `Card Title` (or `Title`),
 * `Description`, `Due Date`, `Labels` (comma- or semicolon-separated tag
 * names). `List` becomes the column a card lands in — first-seen order sets
 * the column order. Rows are otherwise a flat one-row-per-card format, so
 * there's no checklist support in CSV (Trello JSON import does support
 * checklists — see trelloParser.ts).
 */
export function parseCsvImport(text: string): ParsedImport {
  const rows = parseCsvRows(text);
  if (rows.length === 0) {
    throw new ImportParseError('This CSV file is empty.');
  }

  const rawHeader = rows[0]!.map((cell) => cell.trim());
  const header = rawHeader.map(normalizeHeader);
  const listIdx = header.indexOf('list');
  const titleIdx = header.findIndex((cell) => cell === 'card title' || cell === 'title');
  if (listIdx === -1 || titleIdx === -1) {
    throw new ImportParseError(
      'This CSV needs a "List" column and a "Card Title" column. Expected columns: List, Card Title, Description, Due Date, Labels.',
    );
  }
  const descIdx = header.indexOf('description');
  const dueIdx = header.indexOf('due date');
  const labelsIdx = header.indexOf('labels');
  const knownIdx = new Set([listIdx, titleIdx, descIdx, dueIdx, labelsIdx]);

  const notes: string[] = [];
  const unknownHeaders = rawHeader.filter((cell, idx) => cell && !knownIdx.has(idx));
  if (unknownHeaders.length > 0) {
    notes.push(
      `Unrecognised column${unknownHeaders.length === 1 ? '' : 's'} ignored: ${unknownHeaders.join(', ')}.`,
    );
  }

  const columnOrder: string[] = [];
  const cardsByColumn = new Map<string, ImportCard[]>();
  const labelColorByName = new Map<string, LabelColor>();
  let paletteIndex = 0;
  let skippedBlankTitle = 0;
  let skippedBadDate = 0;
  let totalCards = 0;
  let overCardCap = false;

  for (let r = 1; r < rows.length; r += 1) {
    const cells = rows[r]!;

    const title = truncate(cells[titleIdx] ?? '', 200);
    if (!title) {
      skippedBlankTitle += 1;
      continue;
    }
    if (totalCards >= IMPORT_MAX_CARDS) {
      overCardCap = true;
      continue;
    }

    const listName = truncate(cells[listIdx] ?? '', 60) || 'Imported';
    if (!cardsByColumn.has(listName)) {
      columnOrder.push(listName);
      cardsByColumn.set(listName, []);
    }

    const descriptionRaw = descIdx >= 0 ? (cells[descIdx] ?? '') : '';
    const description = descriptionRaw.trim() ? truncate(descriptionRaw, 5000) : null;

    let dueDate: string | null = null;
    if (dueIdx >= 0) {
      const raw = (cells[dueIdx] ?? '').trim();
      if (raw) {
        dueDate = parseCsvDate(raw);
        if (!dueDate) skippedBadDate += 1;
      }
    }

    const labels: ImportCardLabel[] = [];
    if (labelsIdx >= 0) {
      const raw = (cells[labelsIdx] ?? '').trim();
      if (raw) {
        const names = raw
          .split(/[,;]/)
          .map((name) => name.trim())
          .filter(Boolean)
          .slice(0, IMPORT_MAX_LABELS_PER_CARD);
        for (const name of names) {
          if (!labelColorByName.has(name)) {
            labelColorByName.set(name, LABEL_COLOR_NAMES[paletteIndex % LABEL_COLOR_NAMES.length]!);
            paletteIndex += 1;
          }
          labels.push({
            name: truncate(name, 40),
            color: labelColorByName.get(name)!,
          });
        }
      }
    }

    cardsByColumn.get(listName)!.push({
      title,
      description,
      dueDate,
      dueAt: null,
      labels,
      checklist: [],
    });
    totalCards += 1;
  }

  if (skippedBlankTitle > 0) {
    notes.push(
      `${skippedBlankTitle} row${skippedBlankTitle === 1 ? '' : 's'} skipped — no card title.`,
    );
  }
  if (skippedBadDate > 0) {
    notes.push(
      `${skippedBadDate} due date${skippedBadDate === 1 ? '' : 's'} couldn't be read and were left blank — use YYYY-MM-DD.`,
    );
  }
  if (overCardCap) {
    notes.push(`Only the first ${IMPORT_MAX_CARDS} cards were imported.`);
  }
  notes.push(
    "CSV import supports List, Card Title, Description, Due Date, and Labels — checklists and attachments aren't part of the CSV format and weren't imported.",
  );

  if (columnOrder.length > IMPORT_MAX_COLUMNS) {
    notes.push(
      `Only the first ${IMPORT_MAX_COLUMNS} lists were imported (found ${columnOrder.length}).`,
    );
  }

  const columns: ImportColumn[] = columnOrder.slice(0, IMPORT_MAX_COLUMNS).map((name) => ({
    name,
    cards: cardsByColumn.get(name) ?? [],
  }));

  if (columns.length === 0) {
    throw new ImportParseError(
      'No cards found to import — check the CSV has a List and Card Title for each row.',
    );
  }

  const payload: ImportPayload = { projectName: 'Imported board', columns };
  const validated = importPayloadSchema.safeParse(payload);
  if (!validated.success) {
    throw new ImportParseError('That CSV could not be converted into a valid Aurora project.');
  }

  return { payload: validated.data, notes };
}
