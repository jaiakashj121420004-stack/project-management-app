import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { ChecklistItem, Label } from '@/types/database';
import type { LabelColor } from '@/lib/labelColors';
import {
  attachLabel,
  detachLabel,
  fetchCardExtras,
  insertChecklistItem,
  insertLabel,
  removeChecklistItem,
  removeLabel,
  updateChecklistItem,
  type CardExtras,
} from './cardExtras.api';

/**
 * Per-card extras (checklist items, project labels, attachments) live in a
 * single TanStack cache per project, `['card-extras', id]` → CardExtras — the
 * same one-snapshot strategy as the board (useBoard.ts). The board reads it for
 * card-face label pills + checklist progress; the card modal reads and mutates
 * the open card's slice. Optimistic patches render instantly and roll back as a
 * unit on error.
 */

const extrasKey = (projectId: string): QueryKey => ['card-extras', projectId];

interface ExtrasContext {
  previous?: CardExtras;
}

export function useCardExtras(projectId: string | undefined) {
  return useQuery({
    queryKey: extrasKey(projectId ?? ''),
    enabled: Boolean(projectId),
    queryFn: () => fetchCardExtras(projectId as string),
  });
}

/** Shared optimistic plumbing: snapshot → patch → rollback-on-error → refetch. */
function useExtrasMutation<TData, TVariables>(
  projectId: string,
  mutationFn: (variables: TVariables) => Promise<TData>,
  patch: (extras: CardExtras, variables: TVariables) => CardExtras,
  reconcile?: (extras: CardExtras, data: TData, variables: TVariables) => CardExtras,
) {
  const queryClient = useQueryClient();
  const key = extrasKey(projectId);

  return useMutation<TData, Error, TVariables, ExtrasContext>({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CardExtras>(key);
      queryClient.setQueryData<CardExtras>(key, (old) => (old ? patch(old, variables) : old));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (data, variables) => {
      if (reconcile) {
        queryClient.setQueryData<CardExtras>(key, (old) =>
          old ? reconcile(old, data, variables) : old,
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

// --- Labels -----------------------------------------------------------------

export function useCreateLabel(projectId: string) {
  return useExtrasMutation<Label, { name: string; color: LabelColor; tempId: string }>(
    projectId,
    ({ name, color }) => insertLabel({ projectId, name, color }),
    (extras, { name, color, tempId }) => ({
      ...extras,
      labels: [
        ...extras.labels,
        {
          id: tempId,
          project_id: projectId,
          name: name.trim(),
          color,
          created_at: new Date().toISOString(),
        },
      ],
    }),
    (extras, created, { tempId }) => ({
      ...extras,
      labels: extras.labels.map((label) => (label.id === tempId ? created : label)),
      // Re-point any attachment made against the temp id to the real one.
      cardLabels: extras.cardLabels.map((link) =>
        link.label_id === tempId ? { ...link, label_id: created.id } : link,
      ),
    }),
  );
}

export function useDeleteLabel(projectId: string) {
  return useExtrasMutation<void, { id: string }>(
    projectId,
    ({ id }) => removeLabel(id),
    (extras, { id }) => ({
      ...extras,
      labels: extras.labels.filter((label) => label.id !== id),
      // Attachments cascade-delete in the DB; drop them locally too.
      cardLabels: extras.cardLabels.filter((link) => link.label_id !== id),
    }),
  );
}

// --- Card ↔ label attachments ----------------------------------------------

export function useAttachLabel(projectId: string) {
  return useExtrasMutation<void, { cardId: string; labelId: string }>(
    projectId,
    ({ cardId, labelId }) => attachLabel(cardId, labelId),
    (extras, { cardId, labelId }) => {
      const exists = extras.cardLabels.some(
        (link) => link.card_id === cardId && link.label_id === labelId,
      );
      if (exists) return extras;
      return { ...extras, cardLabels: [...extras.cardLabels, { card_id: cardId, label_id: labelId }] };
    },
  );
}

export function useDetachLabel(projectId: string) {
  return useExtrasMutation<void, { cardId: string; labelId: string }>(
    projectId,
    ({ cardId, labelId }) => detachLabel(cardId, labelId),
    (extras, { cardId, labelId }) => ({
      ...extras,
      cardLabels: extras.cardLabels.filter(
        (link) => !(link.card_id === cardId && link.label_id === labelId),
      ),
    }),
  );
}

// --- Checklist items --------------------------------------------------------

export function useAddChecklistItem(projectId: string) {
  return useExtrasMutation<
    ChecklistItem,
    { cardId: string; text: string; position: number; tempId: string }
  >(
    projectId,
    ({ cardId, text, position }) => insertChecklistItem({ cardId, text, position }),
    (extras, { cardId, text, position, tempId }) => ({
      ...extras,
      checklist: [
        ...extras.checklist,
        {
          id: tempId,
          card_id: cardId,
          text: text.trim(),
          is_done: false,
          position,
          created_at: new Date().toISOString(),
        },
      ],
    }),
    (extras, created, { tempId }) => ({
      ...extras,
      checklist: extras.checklist.map((item) => (item.id === tempId ? created : item)),
    }),
  );
}

export function useUpdateChecklistItem(projectId: string) {
  return useExtrasMutation<
    ChecklistItem,
    { id: string; text?: string; is_done?: boolean; position?: number }
  >(
    projectId,
    ({ id, ...patch }) => updateChecklistItem(id, patch),
    (extras, { id, text, is_done, position }) => ({
      ...extras,
      checklist: extras.checklist.map((item) =>
        item.id === id
          ? {
              ...item,
              ...(text !== undefined ? { text: text.trim() } : {}),
              ...(is_done !== undefined ? { is_done } : {}),
              ...(position !== undefined ? { position } : {}),
            }
          : item,
      ),
    }),
  );
}

export function useDeleteChecklistItem(projectId: string) {
  return useExtrasMutation<void, { id: string }>(
    projectId,
    ({ id }) => removeChecklistItem(id),
    (extras, { id }) => ({
      ...extras,
      checklist: extras.checklist.filter((item) => item.id !== id),
    }),
  );
}

// --- Card removal cleanup ---------------------------------------------------

/**
 * Drop a deleted card's checklist items and label attachments from the cache.
 * Deleting the card row cascades to these in the DB; this mirrors that in the
 * local snapshot immediately, so nothing dangles while we wait for a refetch.
 * Returns a stable callback the board calls after a card delete succeeds.
 */
export function useRemoveCardExtras(projectId: string) {
  const queryClient = useQueryClient();
  return (cardId: string) => {
    queryClient.setQueryData<CardExtras>(extrasKey(projectId), (old) =>
      old
        ? {
            ...old,
            checklist: old.checklist.filter((item) => item.card_id !== cardId),
            cardLabels: old.cardLabels.filter((link) => link.card_id !== cardId),
          }
        : old,
    );
  };
}
