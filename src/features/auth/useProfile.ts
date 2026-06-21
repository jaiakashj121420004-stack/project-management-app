import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
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

/** Fields a user can edit on their own profile (display name + reminder prefs). */
export interface ProfileUpdateInput {
  displayName?: string;
  reminderEmailsEnabled?: boolean;
  reminderLeadDays?: number;
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
