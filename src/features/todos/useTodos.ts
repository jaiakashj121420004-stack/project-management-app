import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { TodoItem, TodoList } from '@/types/database';
import {
  fetchTodos,
  insertTodoItem,
  insertTodoList,
  removeTodoItem,
  removeTodoList,
  renameTodoList,
  swapTodoItemPositions,
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
  return useTodosMutation<TodoItem, { id: string; text?: string; is_done?: boolean }>(
    dateKey,
    ({ id, ...patch }) => updateTodoItem(id, patch),
    (data, { id, text, is_done }) => ({
      ...data,
      items: data.items.map((item) =>
        item.id === id
          ? {
              ...item,
              ...(text !== undefined ? { text: text.trim() } : {}),
              ...(is_done !== undefined ? { is_done } : {}),
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
