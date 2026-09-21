import { useCallback, useMemo, useState } from 'react';
import type { Project } from '@/types/database';

const STORAGE_KEY = 'aurora-calendar-hidden-projects';

/** Read the hidden-project-id set from localStorage (best-effort — a private
 *  window or disabled storage just falls back to "everything visible"). */
function readHidden(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((id): id is string => typeof id === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

function writeHidden(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Storage unavailable — the toggle still works for this session.
  }
}

/**
 * Which projects show on the Calendar, Outlook-style "calendar list" overlay:
 * every project is visible by default (a newly created project needs no
 * opt-in), and we persist which ones the user has *hidden* rather than which
 * are shown — so the default stays right without tracking new projects.
 *
 * `hidden` (raw, as read from storage) may briefly reference a project that's
 * since been deleted or left — rather than reconciling that with an effect
 * (a setState-in-effect anti-pattern for what's really just derived data),
 * `visibleIds` filters against the current `projects` list at read time, so a
 * stale id simply has no effect until the next real toggle rewrites storage.
 */
export function useVisibleProjects(projects: Project[]) {
  const [hidden, setHidden] = useState<Set<string>>(() => readHidden());

  const visibleIds = useMemo(
    () => new Set(projects.filter((p) => !hidden.has(p.id)).map((p) => p.id)),
    [projects, hidden],
  );

  const toggleProject = useCallback((id: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeHidden(next);
      return next;
    });
  }, []);

  const showAll = useCallback(() => {
    setHidden(new Set());
    writeHidden(new Set());
  }, []);

  const showOnly = useCallback(
    (id: string) => {
      const next = new Set(projects.filter((p) => p.id !== id).map((p) => p.id));
      setHidden(next);
      writeHidden(next);
    },
    [projects],
  );

  return { hidden, visibleIds, toggleProject, showAll, showOnly };
}
