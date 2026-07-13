import { z } from 'zod';

/** Validation for Library folders. Mirrors the DB check in
 *  20260713120000_library_folders.sql (name 1–80 chars) so the client rejects bad
 *  input before it reaches Postgres (plan.md §6). */
export const folderNameSchema = z
  .string()
  .trim()
  .min(1, 'Give the folder a name.')
  .max(80, 'Keep the name under 80 characters.');
