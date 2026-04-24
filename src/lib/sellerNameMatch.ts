// Helper compartilhado para resolver vendedor a partir do nome durante importação de comissões.
// 1) Tenta match exato (nome ou email) localmente — comportamento legado, rápido.
// 2) Fallback fuzzy via RPC `match_seller_by_name` (pg_trgm), com threshold lido de system_settings.
// 3) Em caso de ambiguidade ou ausência de match aceitável, retorna null + motivo (UI decide se cai no fallback).

import { supabase } from '@/integrations/supabase/client';

export interface SellerProfileLike {
  user_id: string;
  name: string | null;
  email: string;
}

export interface SellerMatchResult {
  userId: string | null;
  matchedName: string | null;
  score: number;
  ambiguous: boolean;
  exact: boolean;
}

let cachedThreshold: number | null = null;
let cachedAt = 0;

export async function getCommissionMatchThreshold(): Promise<number> {
  const now = Date.now();
  if (cachedThreshold !== null && now - cachedAt < 5 * 60 * 1000) return cachedThreshold;
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('commission_name_match_threshold')
      .limit(1)
      .maybeSingle();
    const v = Number((data as any)?.commission_name_match_threshold);
    cachedThreshold = Number.isFinite(v) && v > 0 ? v : 0.55;
  } catch {
    cachedThreshold = 0.55;
  }
  cachedAt = now;
  return cachedThreshold!;
}

export async function resolveSellerByName(
  rawName: string,
  profiles: SellerProfileLike[],
): Promise<SellerMatchResult> {
  const empty: SellerMatchResult = {
    userId: null, matchedName: null, score: 0, ambiguous: false, exact: false,
  };
  if (!rawName) return empty;
  const q = rawName.toLowerCase().trim();
  if (!q) return empty;

  // 1) Match exato local (preserva comportamento legado e poupa RPC)
  const exact = profiles.find(
    (p) => p.name?.toLowerCase().trim() === q || p.email.toLowerCase() === q,
  );
  if (exact) {
    return { userId: exact.user_id, matchedName: exact.name || exact.email, score: 1, ambiguous: false, exact: true };
  }

  // 2) Fuzzy via RPC
  const threshold = await getCommissionMatchThreshold();
  try {
    const { data, error } = await (supabase as any).rpc('match_seller_by_name', {
      _name: rawName,
      _threshold: threshold,
    });
    if (error || !Array.isArray(data) || data.length === 0) return empty;
    const row = data[0];
    return {
      userId: row.user_id || null,
      matchedName: row.name || null,
      score: Number(row.score) || 0,
      ambiguous: !!row.ambiguous,
      exact: false,
    };
  } catch {
    return empty;
  }
}
