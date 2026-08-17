// Hoisted to `src/lib/recurrence.ts` (2026-08-17) so `features/board` (recurring
// Kanban cards) can share the same rule type/logic instead of duplicating it —
// same precedent as `src/lib/ordering.ts` being hoisted out of
// `features/board/ordering.ts` on 2026-08-15. Re-exported here unchanged so
// every existing `from './recurrence'` import in this feature keeps working.
export * from '@/lib/recurrence';
