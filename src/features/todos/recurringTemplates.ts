/**
 * Manages recurring to-do list templates in localStorage.
 * A recurring template is a named list (keyed by list name) with item texts.
 * When a day is opened, any recurring templates not yet present are auto-seeded.
 */

const STORAGE_KEY = 'aurora_recurring_todo_lists';

export interface RecurringTemplate {
  /** The list name — used as the stable match key across days. */
  name: string;
  /** Ordered item texts to recreate each day (all start unchecked). */
  items: string[];
}

function readAll(): RecurringTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecurringTemplate[]) : [];
  } catch {
    return [];
  }
}

function writeAll(templates: RecurringTemplate[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

/** Returns all saved recurring templates. */
export function getRecurringTemplates(): RecurringTemplate[] {
  return readAll();
}

/** Returns true if a list with this name is set as recurring. */
export function isRecurring(name: string): boolean {
  return readAll().some((t) => t.name === name);
}

/** Save or overwrite the recurring template for this list. */
export function upsertRecurringTemplate(template: RecurringTemplate): void {
  const all = readAll().filter((t) => t.name !== template.name);
  writeAll([...all, template]);
}

/** Remove the recurring template for this list name. */
export function removeRecurringTemplate(name: string): void {
  writeAll(readAll().filter((t) => t.name !== name));
}
