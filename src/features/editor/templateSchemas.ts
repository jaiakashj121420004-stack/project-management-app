/**
 * templateSchemas.ts — Zod validation for custom note templates.
 *
 * Mirrors the DB constraints in 20260714220000_note_templates.sql AND validates
 * the document against the *actual* shared editor schema (not just a shape
 * check): a template's `content_json` must round-trip through the ProseMirror
 * schema built from `blockExtensions`, so a malformed or foreign document can
 * never be stored and later fail to render.
 */
import { z } from 'zod';
import { getSchema, type JSONContent } from '@tiptap/core';
import { blockExtensions } from './extensions';

// Built once from the same extension list the live editor + static renderer use.
const editorSchema = getSchema(blockExtensions);

/**
 * True when `value` is a Tiptap document valid under the shared block schema.
 * Cheap structural gate first, then ProseMirror's own `check()` (throws on an
 * invalid node/mark), all wrapped so a bad body returns false instead of raising.
 */
export function isValidTemplateDoc(value: unknown): value is JSONContent {
  if (!value || typeof value !== 'object') return false;
  const doc = value as JSONContent;
  if (doc.type !== 'doc' || !Array.isArray(doc.content)) return false;
  try {
    editorSchema.nodeFromJSON(doc).check();
    return true;
  } catch {
    return false;
  }
}

export const templateTitleSchema = z
  .string()
  .trim()
  .min(1, 'Give the template a name.')
  .max(80, 'Keep the name under 80 characters.');

/** Validated input for creating a template. */
export const noteTemplateInputSchema = z.object({
  title: templateTitleSchema,
  subtitle: z.string().trim().max(120).optional(),
  icon: z
    .string()
    .trim()
    .max(32)
    .nullish(),
  content_json: z.custom<JSONContent>(
    (value) => isValidTemplateDoc(value),
    'That note can’t be saved as a template.',
  ),
});

export type NoteTemplateInput = z.infer<typeof noteTemplateInputSchema>;
