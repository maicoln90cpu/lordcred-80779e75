// ===== Test Helpers & Mock Factories =====
// Reusable utilities for creating test data across the project.

import type { PermissionEntry } from '@/lib/permissionLogic';

// ---- Permission Factories ----

export function createPermission(
  featureKey: string,
  overrides: Partial<PermissionEntry> = {},
): PermissionEntry {
  return {
    feature_key: featureKey,
    allowed_user_ids: [],
    allowed_roles: [],
    ...overrides,
  };
}

export function createDisabledSet(...keys: string[]): Set<string> {
  return new Set(keys);
}

// ---- Commission Sale Factory ----

export interface MockCommissionSale {
  id: string;
  sale_date: string;
  product: string;
  bank: string;
  term: number | null;
  released_value: number;
  has_insurance: boolean;
  seller_id: string;
  commission_rate: number;
  commission_value: number;
  week_label: string | null;
  client_cpf: string | null;
  client_name: string | null;
  client_phone: string | null;
  created_by: string;
  created_at: string;
  external_proposal_id: string | null;
  table_name: string | null;
  client_birth_date: string | null;
}

let saleCounter = 0;

export function createMockSale(overrides: Partial<MockCommissionSale> = {}): MockCommissionSale {
  saleCounter++;
  return {
    id: `sale-${saleCounter}`,
    sale_date: '2026-04-01T12:00-03:00',
    product: 'FGTS',
    bank: 'BMG',
    term: 12,
    released_value: 5000,
    has_insurance: false,
    seller_id: 'seller-1',
    commission_rate: 3.5,
    commission_value: 175,
    week_label: '01/04 a 07/04 - Semana 1 Abril',
    client_cpf: null,
    client_name: null,
    client_phone: null,
    created_by: 'admin-1',
    created_at: '2026-04-01T12:00:00Z',
    external_proposal_id: null,
    table_name: null,
    client_birth_date: null,
    ...overrides,
  };
}

// ---- Corban Proposta Factory ----

export interface MockCorbanProposta {
  id?: string;
  proposta_id?: string;
  cpf?: string;
  nome?: string;
  banco?: string;
  produto?: string;
  status?: string;
  valor_liberado?: number | string;
  valor_parcela?: number | string;
  prazo?: number | string;
  vendedor_nome?: string;
  [key: string]: unknown;
}

let propostaCounter = 0;

export function createMockProposta(overrides: Partial<MockCorbanProposta> = {}): MockCorbanProposta {
  propostaCounter++;
  return {
    id: `prop-${propostaCounter}`,
    cpf: '123.456.789-00',
    nome: `Cliente ${propostaCounter}`,
    banco: 'BMG',
    produto: 'FGTS',
    status: 'Aprovado',
    valor_liberado: 3000,
    prazo: 10,
    vendedor_nome: 'João',
    ...overrides,
  };
}

// ---- Profile Factory ----

export interface MockProfile {
  user_id: string;
  name: string;
  email: string;
}

export function createMockProfile(overrides: Partial<MockProfile> = {}): MockProfile {
  return {
    user_id: 'user-' + Math.random().toString(36).slice(2, 8),
    name: 'Test User',
    email: 'test@example.com',
    ...overrides,
  };
}
