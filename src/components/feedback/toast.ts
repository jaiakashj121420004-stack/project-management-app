/**
 * toast.ts — a tiny, dependency-free toast store.
 *
 * A module-level pub/sub (independent of React context) so *any* code — including
 * the global `MutationCache({ onError })` in `lib/queryClient.ts`, which runs
 * outside the component tree — can surface a message. The `<Toaster />` component
 * subscribes and renders. Kept deliberately small (no `sonner` dependency): the
 * app's one need is visible mutation-failure feedback.
 */

export type ToastVariant = 'error' | 'success' | 'info';

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
  /** Auto-dismiss delay in ms. */
  duration: number;
}

type Listener = (toasts: Toast[]) => void;

const listeners = new Set<Listener>();
let toasts: Toast[] = [];
let nextId = 1;

/** Cap the stack so a burst of failures can't fill the screen. */
const MAX_TOASTS = 4;
const DEFAULT_DURATION = 5000;

function emit(): void {
  for (const listener of listeners) listener(toasts);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => {
    listeners.delete(listener);
  };
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function show(message: string, variant: ToastVariant, duration = DEFAULT_DURATION): number {
  const id = nextId++;
  toasts = [...toasts, { id, message, variant, duration }].slice(-MAX_TOASTS);
  emit();
  return id;
}

/** Fire a toast. `toast.error(msg)` is the common case for mutation failures. */
export const toast = {
  show,
  error: (message: string, duration?: number) => show(message, 'error', duration),
  success: (message: string, duration?: number) => show(message, 'success', duration),
  info: (message: string, duration?: number) => show(message, 'info', duration),
};
