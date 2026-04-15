import { describe, expect, it } from 'vitest';
import { getTeamMembershipChanges } from '@/lib/userTeams';

describe('getTeamMembershipChanges', () => {
  it('identifica equipes para adicionar e remover', () => {
    expect(getTeamMembershipChanges(['team-a', 'team-b'], ['team-b', 'team-c'])).toEqual({
      toAdd: ['team-c'],
      toRemove: ['team-a'],
    });
  });

  it('ignora ids repetidos para evitar operações duplicadas', () => {
    expect(getTeamMembershipChanges(['team-a', 'team-a'], ['team-a', 'team-b', 'team-b'])).toEqual({
      toAdd: ['team-b'],
      toRemove: [],
    });
  });
});