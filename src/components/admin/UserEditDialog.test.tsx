import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserEditDialog } from '@/components/admin/UserEditDialog';

const fetchTeamOptionsMock = vi.fn();
const fetchUserTeamIdsMock = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(),
      })),
    })),
  },
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span />,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/admin/UserTeamsField', () => ({
  UserTeamsField: () => <div>Equipes</div>,
}));

vi.mock('@/lib/userTeams', async () => {
  const actual = await vi.importActual<typeof import('@/lib/userTeams')>('@/lib/userTeams');
  return {
    ...actual,
    fetchTeamOptions: fetchTeamOptionsMock,
    fetchUserTeamIds: fetchUserTeamIdsMock,
    syncUserTeams: vi.fn(),
  };
});

describe('UserEditDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchTeamOptionsMock.mockResolvedValue([{ id: 'team-1', name: 'Equipe A' }]);
    fetchUserTeamIdsMock.mockResolvedValue(['team-1']);
  });

  it('preenche os dados do usuário ao abrir o modal após a montagem inicial', async () => {
    const user = {
      id: 'profile-1',
      user_id: 'user-1',
      email: 'maria@teste.com',
      name: 'Maria Teste',
      is_blocked: false,
      created_at: '2026-04-15T00:00:00Z',
      created_by: null,
      chip_count: 2,
      max_chips: 5,
      role: 'seller',
    };

    const { rerender } = render(
      <UserEditDialog
        open={false}
        onOpenChange={vi.fn()}
        user={null}
        canManageUsers={true}
        onUserUpdated={vi.fn()}
      />,
    );

    rerender(
      <UserEditDialog
        open={true}
        onOpenChange={vi.fn()}
        user={user}
        canManageUsers={true}
        onUserUpdated={vi.fn()}
      />,
    );

    expect(await screen.findByDisplayValue('Maria Teste')).toBeInTheDocument();
    expect(screen.getByDisplayValue('maria@teste.com')).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchUserTeamIdsMock).toHaveBeenCalledWith('user-1');
    });

    expect(screen.getByText('Equipes')).toBeInTheDocument();
  });
});