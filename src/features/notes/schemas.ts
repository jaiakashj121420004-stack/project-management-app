import { z } from 'zod';

/** Validation for per-project notes. Mirrors the DB constraints in the
 *  20260620140000_notes.sql migration so the client rejects bad input before it
 *  reaches Postgres (plan.md §6). */

export const noteTitleSchema = z
  .string()
  .trim()
  .min(1, 'Give the note a title.')
  .max(120, 'Keep the title under 120 characters.');

/** Content may be empty (a fresh note); only the upper bound is enforced. */
export const noteContentSchema = z
  .string()
  .max(100_000, 'This note is too long to save.');
