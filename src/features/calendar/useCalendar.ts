import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { Card } from '@/types/database';
import { removeCard, updateCardDetail, type BoardData } from '@/features/board/api';
import type { CardExtras } from '@/features/board/cardExtras.api';
import { fetchDatedCards, updateCardDueDate } from './api';

/**
 * Calendar state lives in one cache entry, `['calendar-cards']` → Card[] (every
 * dated card across the user's projects). Because a card is also part of its
 * project's `['board', id]` cache (and its checklist/labels in `['card-extras',
 * id]`), every calendar mutation patches those caches too, so a reschedule or
 * edit made here is reflected the moment you return to the board — no flicker,
 * rolled back as a unit on error.
 */

const calendarKey: QueryKey = ['calendar-cards'];
const boardKey = (projectId: string): QueryKey => ['board', projectId];
const extrasKey = (projectId: string): QueryKey => ['card-extras', projectId];

/** Every card with a due date the user can see (RLS scopes it). */
export function useDatedCards() {
  return useQuery({ queryKey: calendarKey, queryFn: fetchDatedCards });
}

interface CardMutationContext {
  prevCalendar?: Card[];
  prevBoard?: BoardData;
  projectId: string;
}

/** Patch one card's fields in the calendar list; drop it when it loses its date. */
function patchCalendar(cards: Card[] | undefined, id: string, patch: Partial<Card>): Card[] | undefined {
  if (!cards) return cards;
  if (patch.due_date === null) return cards.filter((card) => card.id !== id);
  return cards.map((card) => (card.id === id ? { ...card, ...patch } : card));
}

/** Patch one card's fields in a project's board cache (if it's loaded). */
function patchBoard(board: BoardData | undefined, id: string, patch: Partial<Card>): BoardData | undefined {
  if (!board) return board;
  return { ...board, cards: board.cards.map((card) => (card.id === id ? { ...card, ...patch } : card)) };
}

/** Drag-to-reschedule: set a card's due date (optimistic across both caches). */
export function useRescheduleCard() {
  const queryClient = useQueryClient();
  return useMutation<Card, Error, { id: string; projectId: string; dueDate: string | null }, CardMutationContext>({
    mutationFn: ({ id, dueDate }) => updateCardDueDate(id, dueDate),
    onMutate: async ({ id, projectId, dueDate }) => {
      await queryClient.cancelQueries({ queryKey: calendarKey });
      const prevCalendar = queryClient.getQueryData<Card[]>(calendarKey);
      const prevBoard = queryClient.getQueryData<BoardData>(boardKey(projectId));
      queryClient.setQueryData<Card[]>(calendarKey, (old) => patchCalendar(old, id, { due_date: dueDate }));
      queryClient.setQueryData<BoardData>(boardKey(projectId), (old) => patchBoard(old, id, { due_date: dueDate }));
      return { prevCalendar, prevBoard, projectId };
    },
    onError: (_error, _vars, context) => {
      if (context?.prevCalendar) queryClient.setQueryData(calendarKey, context.prevCalendar);
      if (context?.prevBoard) queryClient.setQueryData(boardKey(context.projectId), context.prevBoard);
    },
    onSettled: (_data, _error, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: calendarKey });
      void queryClient.invalidateQueries({ queryKey: boardKey(projectId) });
    },
  });
}

/** Save the full card from the detail modal (title/description/due date). */
export function useUpdateCalendarCard() {
  const queryClient = useQueryClient();
  return useMutation<
    Card,
    Error,
    {
      id: string;
      projectId: string;
      title: string;
      description: string | null;
      due_date: string | null;
      priority: number | null;
      assignee_id: string | null;
    },
    CardMutationContext
  >({
    mutationFn: ({ id, title, description, due_date, priority, assignee_id }) =>
      updateCardDetail(id, { title, description, due_date, priority, assignee_id }),
    onMutate: async ({ id, projectId, title, description, due_date, priority, assignee_id }) => {
      await queryClient.cancelQueries({ queryKey: calendarKey });
      const prevCalendar = queryClient.getQueryData<Card[]>(calendarKey);
      const prevBoard = queryClient.getQueryData<BoardData>(boardKey(projectId));
      const patch = { title: title.trim(), description, due_date, priority, assignee_id };
      queryClient.setQueryData<Card[]>(calendarKey, (old) => patchCalendar(old, id, patch));
      queryClient.setQueryData<BoardData>(boardKey(projectId), (old) => patchBoard(old, id, patch));
      return { prevCalendar, prevBoard, projectId };
    },
    onError: (_error, _vars, context) => {
      if (context?.prevCalendar) queryClient.setQueryData(calendarKey, context.prevCalendar);
      if (context?.prevBoard) queryClient.setQueryData(boardKey(context.projectId), context.prevBoard);
    },
    onSettled: (_data, _error, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: calendarKey });
      void queryClient.invalidateQueries({ queryKey: boardKey(projectId) });
    },
  });
}

/** Delete a card from the modal; mirror the DB cascade in every local cache. */
export function useDeleteCalendarCard() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { id: string; projectId: string }, CardMutationContext>({
    mutationFn: ({ id }) => removeCard(id),
    onMutate: async ({ id, projectId }) => {
      await queryClient.cancelQueries({ queryKey: calendarKey });
      const prevCalendar = queryClient.getQueryData<Card[]>(calendarKey);
      const prevBoard = queryClient.getQueryData<BoardData>(boardKey(projectId));
      queryClient.setQueryData<Card[]>(calendarKey, (old) => old?.filter((card) => card.id !== id));
      queryClient.setQueryData<BoardData>(boardKey(projectId), (old) =>
        old ? { ...old, cards: old.cards.filter((card) => card.id !== id) } : old,
      );
      queryClient.setQueryData<CardExtras>(extrasKey(projectId), (old) =>
        old
          ? {
              ...old,
              checklist: old.checklist.filter((item) => item.card_id !== id),
              cardLabels: old.cardLabels.filter((link) => link.card_id !== id),
            }
          : old,
      );
      return { prevCalendar, prevBoard, projectId };
    },
    onError: (_error, _vars, context) => {
      if (context?.prevCalendar) queryClient.setQueryData(calendarKey, context.prevCalendar);
      if (context?.prevBoard) queryClient.setQueryData(boardKey(context.projectId), context.prevBoard);
    },
    onSettled: (_data, _error, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: calendarKey });
      void queryClient.invalidateQueries({ queryKey: boardKey(projectId) });
      void queryClient.invalidateQueries({ queryKey: extrasKey(projectId) });
    },
  });
}
