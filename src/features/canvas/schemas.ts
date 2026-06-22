import { z } from 'zod';

/** Validation for canvas notes. Mirrors the DB constraints in
 *  20260622180000_canvas.sql so the client rejects bad input before Postgres. */

export const canvasTitleSchema = z
  .string()
  .trim()
  .min(1, 'Give the canvas a title.')
  .max(120, 'Keep the title under 120 characters.');
