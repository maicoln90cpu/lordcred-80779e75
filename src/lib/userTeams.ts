import { supabase } from '@/integrations/supabase/client';

export interface TeamOption {
  id: string;
  name: string;
}

export interface TeamMembershipChanges {
  toAdd: string[];
  toRemove: string[];
}

export function getTeamMembershipChanges(
  originalTeamIds: string[],
  selectedTeamIds: string[],
): TeamMembershipChanges {
  const uniqueOriginal = Array.from(new Set(originalTeamIds));
  const uniqueSelected = Array.from(new Set(selectedTeamIds));

  return {
    toAdd: uniqueSelected.filter((teamId) => !uniqueOriginal.includes(teamId)),
    toRemove: uniqueOriginal.filter((teamId) => !uniqueSelected.includes(teamId)),
  };
}

export async function fetchTeamOptions(): Promise<TeamOption[]> {
  const { data, error } = await supabase.from('teams').select('id, name').order('name');
  if (error) throw error;
  return (data || []) as TeamOption[];
}

export async function fetchUserTeamIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('team_members').select('team_id').eq('user_id', userId);
  if (error) throw error;
  return (data || []).map((row: { team_id: string }) => row.team_id);
}

export async function syncUserTeams(
  userId: string,
  originalTeamIds: string[],
  selectedTeamIds: string[],
): Promise<TeamMembershipChanges> {
  const changes = getTeamMembershipChanges(originalTeamIds, selectedTeamIds);

  if (changes.toRemove.length > 0) {
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('user_id', userId)
      .in('team_id', changes.toRemove);

    if (error) throw error;
  }

  if (changes.toAdd.length > 0) {
    const rows = changes.toAdd.map((teamId) => ({ team_id: teamId, user_id: userId }));
    const { error } = await supabase.from('team_members').insert(rows as never);

    if (error) throw error;
  }

  return changes;
}