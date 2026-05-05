import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EmptyStateNoAccess } from '@/components/common/EmptyStateNoAccess';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

function renderEl(props: Parameters<typeof EmptyStateNoAccess>[0] = {}) {
  return render(
    <MemoryRouter>
      <EmptyStateNoAccess {...props} />
    </MemoryRouter>
  );
}

describe('EmptyStateNoAccess', () => {
  it('renders default heading and feature fallback', () => {
    renderEl();
    expect(screen.getByText('Acesso restrito')).toBeInTheDocument();
    expect(screen.getByText(/esta funcionalidade/)).toBeInTheDocument();
  });

  it('shows custom feature name and description', () => {
    renderEl({ feature: 'Simulador V8', description: 'Solicite ao gestor.' });
    expect(screen.getByText('Simulador V8')).toBeInTheDocument();
    expect(screen.getByText('Solicite ao gestor.')).toBeInTheDocument();
  });

  it('renders back button by default and calls navigate(-1)', () => {
    renderEl();
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(navigateMock).toHaveBeenCalledWith(-1);
  });

  it('hides back button when hideBackButton', () => {
    renderEl({ hideBackButton: true });
    expect(screen.queryByRole('button', { name: /voltar/i })).toBeNull();
  });
});
