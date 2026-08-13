import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { TodoItem, TodoList, TodoRecurrence } from '@/types/database';
import type { RecurrenceRule } from './recurrence';
import {
  fetchRecurrences,
  fetchTodos,
  insertRecurrence,
  insertTodoItem,
  insertTodoList,
  removeRecurrence,
  removeTodoItem,
  removeTodoList,
  renameTodoList,
  setTodoListRecurrence,
  swapTodoItemPositions,
  updateRecurrence,
  updateTodoItem,
  type TodosData,
} from './api';

/**
 * One day's planner lives in a single cache entry, `['todos', dateKey]` →
 * { lists, items } — the same one-snapshot strategy as the board and card
 * extras. Every mutation patches that snapshot optimistically and rolls back as
 * a unit on error.
 */

const todosKey = (dateKey: string): QueryKey => ['todos', dateKey];

const EMPTY: TodosData = { lists: [], items: [] };

interface TodosContext {
  previous?: TodosData;
}

export function useTodos(dateKey: string) {
  return useQuery({
    queryKey: todosKey(dateKey),
    queryFn: () => fetchTodos(dateKey),
  });
}

/** Shared optimistic plumbing: snapshot → patch → rollback-on-error → refetch. */
function useTodosMutation<TData, TVariables>(
  dateKey: string,
  mutationFn: (variables: TVariables) => Promise<TData>,
  patch: (data: TodosData, variables: TVariables) => TodosData,
  reconcile?: (data: TodosData, result: TData, variables: TVariables) => TodosData,
) {
  const queryClient = useQueryClient();
  const key = todosKey(dateKey);

  return useMutation<TData, Error, TVariables, TodosContext>({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TodosData>(key);
      queryClient.setQueryData<TodosData>(key, (old) => patch(old ?? EMPTY, variables));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (result, variables) => {
      if (reconcile) {
        queryClient.setQueryData<TodosData>(key, (old) =>
          old ? reconcile(old, result, variables) : old,
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

// --- Lists ------------------------------------------------------------------

export function useAddTodoList(dateKey: string) {
  return useTodosMutation<TodoList, { name: string; position: number; tempId: string }>(
    dateKey,
    ({ name, position }) => insertTodoList({ dateKey, name, position }),
    (data, { name, position, tempId }) => ({
      ...data,
      lists: [
        ...data.lists,
        {
          id: tempId,
          user_id: '',
          list_date: dateKey,
          name: name.trim(),
          position,
          created_at: new Date().toISOString(),
        },
      ],
    }),
    (data, created, { tempId }) => ({
      ...data,
      lists: data.lists.map((list) => (list.id === tempId ? created : list)),
    }),
  );
}

export function useRenameTodoList(dateKey: string) {
  return useTodosMutation<TodoList, { id: string; name: string }>(
    dateKey,
    ({ id, name }) => renameTodoList(id, name),
    (data, { id, name }) => ({
      ...data,
      lists: data.lists.map((list) => (list.id === id ? { ...list, name: name.trim() } : list)),
    }),
  );
}

export function useDeleteTodoList(dateKey: string) {
  return useTodosMutation<void, { id: string }>(
    dateKey,
    ({ id }) => removeTodoList(id),
    (data, { id }) => ({
      lists: data.lists.filter((list) => list.id !== id),
      // Items cascade-delete in the DB; drop them locally too for an instant UI.
      items: data.items.filter((item) => item.list_id !== id),
    }),
  );
}

// --- Items ------------------------------------------------------------------

export function useAddTodoItem(dateKey: string) {
  return useTodosMutation<
    TodoItem,
    { listId: string; text: string; position: number; tempId: string }
  >(
    dateKey,
    ({ listId, text, position }) => insertTodoItem({ listId, text, position }),
    (data, { listId, text, position, tempId }) => ({
      ...data,
      items: [
        ...data.items,
        {
          id: tempId,
          list_id: listId,
          text: text.trim(),
          is_done: false,
          position,
          priority: null,
          created_at: new Date().toISOString(),
        },
      ],
    }),
    (data, created, { tempId }) => ({
      ...data,
      items: data.items.map((item) => (item.id === tempId ? created : item)),
    }),
  );
}

export function useUpdateTodoItem(dateKey: string) {
  return useTodosMutation<
    TodoItem,
    { id: string; text?: string; is_done?: boolean; priority?: number | null }
  >(
    dateKey,
    ({ id, ...patch }) => updateTodoItem(id, patch),
    (data, { id, text, is_done, priority }) => ({
      ...data,
      items: data.items.map((item) =>
        item.id === id
          ? {
              ...item,
              ...(text !== undefined ? { text: text.trim() } : {}),
              ...(is_done !== undefined ? { is_done } : {}),
              ...(priority !== undefined ? { priority } : {}),
            }
          : item,
      ),
    }),
  );
}

/**
 * Move an item up or down within its list by swapping `position` with its
 * neighbour. Optimistically swaps both positions in the day snapshot so the
 * reorder is instant, then reconciles on refetch.
 */
export function useMoveTodoItem(dateKey: string) {
  return useTodosMutation<
    void,
    { id: string; position: number; swapId: string; swapPosition: number }
  >(
    dateKey,
    ({ id, position, swapId, swapPosition }) =>
      swapTodoItemPositions({ id, position }, { id: swapId, position: swapPosition }),
    (data, { id, position, swapId, swapPosition }) => ({
      ...data,
      items: data.items.map((item) => {
        if (item.id === id) return { ...item, position: swapPosition };
        if (item.id === swapId) return { ...item, position };
        return item;
      }),
    }),
  );
}

export function useDeleteTodoItem(dateKey: string) {
  return useTodosMutation<void, { id: string }>(
    dateKey,
    ({ id }) => removeTodoItem(id),
    (data, { id }) => ({
      ...data,
      items: data.items.filter((item) => item.id !== id),
    }),
  );
}

/** Bulk-apply a done/priority patch to several items at once (the selection
 *  action bar). Runs the same underlying single-item update in parallel — no
 *  new endpoint needed, RLS already scopes each call to the caller's own items. */
export function useBulkUpdateTodoItems(dateKey: string) {
  return useTodosMutation<
    TodoItem[],
    { ids: string[]; is_done?: boolean; priority?: number | null }
  >(
    dateKey,
    ({ ids, is_done, priority }) =>
      Promise.all(ids.map((id) => updateTodoItem(id, { is_done, priority }))),
    (data, { ids, is_done, priority }) => ({
      ...data,
      items: data.items.map((item) =>
        ids.includes(item.id)
          ? {
              ...item,
              ...(is_done !== undefined ? { is_done } : {}),
              ...(priority !== undefined ? { priority } : {}),
            }
          : item,
      ),
    }),
  );
}

/** Bulk-delete several items at once (the selection action bar). */
export function useBulkDeleteTodoItems(dateKey: string) {
  return useTodosMutation<void, { ids: string[] }>(
    dateKey,
    ({ ids }) => Promise.all(ids.map((id) => removeTodoItem(id))).then(() => undefined),
    (data, { ids }) => ({
      ...data,
      items: data.items.filter((item) => !ids.includes(item.id)),
    }),
  );
}

/** Link (or unlink, with `recurrenceId: null`) a day's list to a recurrence
 *  template — used when a user turns repeat on/off from an existing list. */
export function useLinkTodoListRecurrence(dateKey: string) {
  return useTodosMutation<TodoList, { id: string; recurrenceId: string | null }>(
    dateKey,
    ({ id, recurrenceId }) => setTodoListRecurrence(id, recurrenceId),
    (data, { id, recurrenceId }) => ({
      ...data,
      lists: data.lists.map((list) =>
        list.id === id ? { ...list, source_recurrence_id: recurrenceId } : list,
      ),
    }),
  );
}

// --- Recurrences --------------------------------------------------------
// User-global (one list of templates, not scoped to a day), so these live
// under their own query key rather than the per-day todosKey.

const recurrencesKey: QueryKey = ['todo-recurrences'];

export function useRecurrences() {
  return useQuery({ queryKey: recurrencesKey, queryFn: fetchRecurrences });
}

export function useCreateRecurrence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; items: string[]; rule: RecurrenceRule }) =>
      insertRecurrence(input),
    onSuccess: (created) => {
      queryClient.setQueryData<TodoRecurrence[]>(recurrencesKey, (old) => [...(old ?? []), created]);
    },
  });
}

export function useUpdateRecurrence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; name?: string; items?: string[]; rule?: RecurrenceRule }) =>
      updateRecurrence(input.id, input),
    onSuccess: (updated) => {
      queryClient.setQueryData<TodoRecurrence[]>(recurrencesKey, (old) =>
        (old ?? []).map((r) => (r.id === updated.id ? updated : r)),
      );
    },
  });
}

export function useDeleteRecurrence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeRecurrence(id),
    onSuccess: (_void, id) => {
      queryClient.setQueryData<TodoRecurrence[]>(recurrencesKey, (old) =>
        (old ?? []).filter((r) => r.id !== id),
      );
      // Every list this template had generated just had its link cleared
      // server-side (ON DELETE SET NULL) — refetch any cached days so the
      // Repeat toggle reflects "off" immediately rather than on next visit.
      void queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
}
