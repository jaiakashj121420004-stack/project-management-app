import { useQuery, type QueryKey } from '@tanstack/react-query';
import { useOptimisticMutation } from '@/lib/useOptimisticMutation';
import type { Card, Column } from '@/types/database';
import {
  fetchBoard,
  insertCard,
  insertColumn,
  moveCard,
  removeCard,
  removeColumn,
  renameColumn,
  updateCardDetail,
  updateCardReview,
  updateColumnPosition,
  type BoardData,
  type CardReviewPatch,
} from './api';

/**
 * Board state lives in a single TanStack Query cache entry per project,
 * `['board', id]` → { columns, cards }. Keeping columns and cards together lets
 * every mutation — and the drag-and-drop layer — read and patch one consistent
 * snapshot, so optimistic updates render instantly and roll back as a unit on
 * error. All ordering math lives in ordering.ts and the Board component; these
 * mutations take explicit positions and simply apply them.
 */

const boardKey = (projectId: string): QueryKey => ['board', projectId];

/** Columns + cards for a project (RLS returns only what the user can see). */
export function useBoard(projectId: string | undefined) {
  return useQuery({
    queryKey: boardKey(projectId ?? ''),
    enabled: Boolean(projectId),
    queryFn: () => fetchBoard(projectId as string),
  });
}

/**
 * Board mutations are optimistic over the single `['board', id]` snapshot. Thin
 * adapter over the shared `useOptimisticMutation`: the board only ever patches an
 * existing snapshot, so `patch` returns `old` untouched until the first fetch
 * lands.
 */
function useBoardMutation<TData, TVariables>(
  projectId: string,
  mutationFn: (variables: TVariables) => Promise<TData>,
  patch: (board: BoardData, variables: TVariables) => BoardData,
  reconcile?: (board: BoardData, data: TData, variables: TVariables) => BoardData,
) {
  return useOptimisticMutation<TData, TVariables, BoardData>({
    queryKey: boardKey(projectId),
    mutationFn,
    patch: (old, variables) => (old ? patch(old, variables) : old),
    reconcile,
  });
}

// --- Columns ----------------------------------------------------------------

interface AddColumnVars {
  name: string;
  position: number;
}

export function useAddColumn(projectId: string) {
  return useBoardMutation<Column, AddColumnVars & { tempId: string }>(
    projectId,
    ({ name, position }) => insertColumn({ projectId, name, position }),
    (board, { name, position, tempId }) => ({
      ...board,
      columns: [
        ...board.columns,
        {
          id: tempId,
          project_id: projectId,
          name: name.trim(),
          position,
          created_at: new Date().toISOString(),
        },
      ],
    }),
    (board, created, { tempId }) => ({
      ...board,
      columns: board.columns.map((column) => (column.id === tempId ? created : column)),
    }),
  );
}

export function useRenameColumn(projectId: string) {
  return useBoardMutation<Column, { id: string; name: string }>(
    projectId,
    ({ id, name }) => renameColumn(id, name),
    (board, { id, name }) => ({
      ...board,
      columns: board.columns.map((column) =>
        column.id === id ? { ...column, name: name.trim() } : column,
      ),
    }),
  );
}

export function useMoveColumn(projectId: string) {
  return useBoardMutation<Column, { id: string; position: number }>(
    projectId,
    ({ id, position }) => updateColumnPosition(id, position),
    (board, { id, position }) => ({
      ...board,
      columns: board.columns.map((column) =>
        column.id === id ? { ...column, position } : column,
      ),
    }),
  );
}

export function useDeleteColumn(projectId: string) {
  return useBoardMutation<void, { id: string }>(
    projectId,
    ({ id }) => removeColumn(id),
    (board, { id }) => ({
      columns: board.columns.filter((column) => column.id !== id),
      // Cards cascade-delete in the DB; drop them locally too for an instant UI.
      cards: board.cards.filter((card) => card.column_id !== id),
    }),
  );
}

// --- Cards ------------------------------------------------------------------

interface AddCardVars {
  columnId: string;
  title: string;
  position: number;
}

export function useAddCard(projectId: string) {
  return useBoardMutation<Card, AddCardVars & { tempId: string }>(
    projectId,
    ({ columnId, title, position }) => insertCard({ projectId, columnId, title, position }),
    (board, { columnId, title, position, tempId }) => ({
      ...board,
      cards: [
        ...board.cards,
        {
          id: tempId,
          project_id: projectId,
          column_id: columnId,
          title: title.trim(),
          description: null,
          due_date: null,
          due_at: null,
          assignee_id: null,
          priority: null,
          reminder_sent_for: null,
          review_status: 'none',
          review_assignee_id: null,
          reviewed_by: null,
          reviewed_at: null,
          position,
          created_at: new Date().toISOString(),
        },
      ],
    }),
    (board, created, { tempId }) => ({
      ...board,
      cards: board.cards.map((card) => (card.id === tempId ? created : card)),
    }),
  );
}

export function useUpdateCard(projectId: string) {
  return useBoardMutation<
    Card,
    {
      id: string;
      title: string;
      description: string | null;
      due_date: string | null;
      due_at: string | null;
      priority: number | null;
      assignee_id: string | null;
    }
  >(
    projectId,
    ({ id, title, description, due_date, due_at, priority, assignee_id }) =>
      updateCardDetail(id, { title, description, due_date, due_at, priority, assignee_id }),
    (board, { id, title, description, due_date, due_at, priority, assignee_id }) => ({
      ...board,
      cards: board.cards.map((card) =>
        card.id === id
          ? { ...card, title: title.trim(), description, due_date, due_at, priority, assignee_id }
          : card,
      ),
    }),
  );
}

/** Set a card's review state (request / approve / request changes / clear). The
 *  cards UPDATE policy (owner/editor) governs this; a DB trigger handles the
 *  activity + notification side effects. Optimistic so the badge flips instantly. */
export function useUpdateCardReview(projectId: string) {
  return useBoardMutation<Card, { id: string } & CardReviewPatch>(
    projectId,
    ({ id, ...patch }) => updateCardReview(id, patch),
    (board, { id, review_status, review_assignee_id, reviewed_by, reviewed_at }) => ({
      ...board,
      cards: board.cards.map((card) =>
        card.id === id
          ? { ...card, review_status, review_assignee_id, reviewed_by, reviewed_at }
          : card,
      ),
    }),
  );
}

export function useMoveCard(projectId: string) {
  return useBoardMutation<Card, { id: string; columnId: string; position: number }>(
    projectId,
    ({ id, columnId, position }) => moveCard(id, { columnId, position }),
    (board, { id, columnId, position }) => ({
      ...board,
      cards: board.cards.map((card) =>
        card.id === id ? { ...card, column_id: columnId, position } : card,
      ),
    }),
  );
}

export function useDeleteCard(projectId: string) {
  return useBoardMutation<void, { id: string }>(
    projectId,
    ({ id }) => removeCard(id),
    (board, { id }) => ({
      ...board,
      cards: board.cards.filter((card) => card.id !== id),
    }),
  );
}
