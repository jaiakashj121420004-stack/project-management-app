import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Theme } from '@/lib/theme';
import type { CustomThemeSettings } from '@/lib/customTheme';
import type { Database, Profile } from '@/types/database';

/** The current user's profile row (RLS guarantees it's theirs). */
export function useProfile() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId as string)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

/** Fields a user can edit on their own profile (display name, reminder prefs,
 *  and — 2026-08-15 — the account-synced theme/personalization). `theme` and
 *  `customTheme` are written whenever a signed-in user changes either
 *  preference (including resetting personalization to default), so the
 *  server column always reflects "this account's last choice" — see
 *  ThemeProvider / CustomThemeProvider. */
export interface ProfileUpdateInput {
  displayName?: string;
  reminderEmailsEnabled?: boolean;
  reminderLeadDays?: number;
  theme?: Theme;
  customTheme?: CustomThemeSettings;
}

interface ProfileContext {
  previous?: Profile;
}

/** Update the current user's profile; optimistic so toggles feel instant. */
export function useUpdateProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = ['profile', user?.id] as const;

  return useMutation<Profile, Error, ProfileUpdateInput, ProfileContext>({
    mutationFn: async (input): Promise<Profile> => {
      if (!user) throw new Error('You must be signed in.');
      const patch: Database['public']['Tables']['profiles']['Update'] = {};
      if (input.displayName !== undefined) patch.display_name = input.displayName;
      if (input.reminderEmailsEnabled !== undefined)
        patch.reminder_emails_enabled = input.reminderEmailsEnabled;
      if (input.reminderLeadDays !== undefined) patch.reminder_lead_days = input.reminderLeadDays;
      if (input.theme !== undefined) patch.theme = input.theme;
      // jsonb column, hand-typed loosely (Record<string, unknown>) same as
      // every other jsonb column in database.ts — CustomThemeSettings is a
      // plain, fully-serializable object so this cast is safe.
      if (input.customTheme !== undefined)
        patch.custom_theme = input.customTheme as unknown as Record<string, unknown>;

      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', user.id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Profile>(key);
      queryClient.setQueryData<Profile>(key, (old) =>
        old
          ? {
              ...old,
              ...(input.displayName !== undefined ? { display_name: input.displayName } : {}),
              ...(input.reminderEmailsEnabled !== undefined
                ? { reminder_emails_enabled: input.reminderEmailsEnabled }
                : {}),
              ...(input.reminderLeadDays !== undefined
                ? { reminder_lead_days: input.reminderLeadDays }
                : {}),
              ...(input.theme !== undefined ? { theme: input.theme } : {}),
              ...(input.customTheme !== undefined
                ? { custom_theme: input.customTheme as unknown as Record<string, unknown> }
                : {}),
            }
          : old,
      );
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(key, profile);
    },
  });
}
