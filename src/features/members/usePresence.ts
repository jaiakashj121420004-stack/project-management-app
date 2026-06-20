import { useEffect, useState } from 'react';
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/** A member currently viewing the board (from Realtime Presence). */
export interface PresenceUser {
  userId: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * Track who is currently viewing a project's board via Supabase Realtime
 * Presence. Each viewer `track`s their identity on a per-project channel keyed by
 * user id (so multiple tabs collapse to one person), and every client receives a
 * synced roster. Returns the deduped list of present users, including the current
 * user. Cleans up its channel on unmount / project change.
 */
export function usePresence(projectId: string | undefined, me: PresenceUser | null): PresenceUser[] {
  const [users, setUsers] = useState<PresenceUser[]>([]);

  const meId = me?.userId;
  const meName = me?.name;
  const meAvatar = me?.avatarUrl ?? null;

  useEffect(() => {
    // No project/user yet: nothing to track. State is already empty; don't
    // setState synchronously in the effect body.
    if (!projectId || !meId) return;

    const channel = supabase.channel(`presence:project:${projectId}`, {
      config: { presence: { key: meId } },
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresenceUser>();
      const deduped = new Map<string, PresenceUser>();
      for (const key of Object.keys(state)) {
        const meta = state[key]?.[0];
        if (meta?.userId) {
          deduped.set(meta.userId, {
            userId: meta.userId,
            name: meta.name,
            avatarUrl: meta.avatarUrl,
          });
        }
      }
      setUsers([...deduped.values()]);
    });

    void channel.subscribe((status) => {
      if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
        void channel.track({ userId: meId, name: meName ?? 'You', avatarUrl: meAvatar });
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectId, meId, meName, meAvatar]);

  return users;
}
