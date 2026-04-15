import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTeamMembershipChanges } from '@/lib/userTeams';

// We can't test syncUserTeams directly (needs real Supabase), 
// but we CAN test the pure logic it depends on + verify the module structure.

describe('getTeamMembershipChanges — extended', () => {
  it('no changes when both are empty', () => {
    const result = getTeamMembershipChanges([], []);
    expect(result.toAdd).toEqual([]);
    expect(result.toRemove).toEqual([]);
  });

  it('adds all when original is empty', () => {
    const result = getTeamMembershipChanges([], ['a', 'b']);
    expect(result.toAdd).toEqual(['a', 'b']);
    expect(result.toRemove).toEqual([]);
  });

  it('removes all when selected is empty', () => {
    const result = getTeamMembershipChanges(['a', 'b'], []);
    expect(result.toAdd).toEqual([]);
    expect(result.toRemove).toEqual(['a', 'b']);
  });

  it('handles mixed add and remove', () => {
    const result = getTeamMembershipChanges(['a', 'b', 'c'], ['b', 'c', 'd']);
    expect(result.toAdd).toEqual(['d']);
    expect(result.toRemove).toEqual(['a']);
  });

  it('deduplicates inputs', () => {
    const result = getTeamMembershipChanges(['a', 'a'], ['a', 'b', 'b']);
    expect(result.toAdd).toEqual(['b']);
    expect(result.toRemove).toEqual([]);
  });

  it('no changes when same sets', () => {
    const result = getTeamMembershipChanges(['x', 'y'], ['y', 'x']);
    expect(result.toAdd).toEqual([]);
    expect(result.toRemove).toEqual([]);
  });
});

// Verify the module exports the expected functions
describe('userTeams module structure', () => {
  it('exports fetchTeamOptions', async () => {
    const mod = await import('@/lib/userTeams');
    expect(typeof mod.fetchTeamOptions).toBe('function');
  });

  it('exports fetchUserTeamIds', async () => {
    const mod = await import('@/lib/userTeams');
    expect(typeof mod.fetchUserTeamIds).toBe('function');
  });

  it('exports syncUserTeams', async () => {
    const mod = await import('@/lib/userTeams');
    expect(typeof mod.syncUserTeams).toBe('function');
  });
});
