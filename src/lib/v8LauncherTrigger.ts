/**
 * Etapa 2/3 (mai/2026): short-loop trigger do v8-scheduled-launcher.
 *
 * Por que: o cron do launcher roda a cada 1 min. Se o usuário enfileira logo
 * após o cron passar, pode esperar quase 60s para o lote sair de `queued`
 * para `processing`. Esse helper dispara o launcher imediatamente e re-tenta
 * em curtos intervalos para cobrir:
 *  - cold start da edge function
 *  - race entre INSERT do lote e leitura do launcher
 *  - falha pontual da primeira chamada (rede)
 *
 * Etapa 3: 4 disparos (0s, 4s, 12s, 25s) — cobre cold start mais longo.
 * O launcher é idempotente — promove apenas lotes elegíveis, então rodar 4x é seguro.
 */
import { supabase } from '@/integrations/supabase/client';

let lastBurstAt = 0;

export function triggerLauncherShortLoop(opts: { reason?: string; force?: boolean } = {}) {
  // Debounce global: se já disparamos a salva nos últimos 4s, ignora (a menos que force).
  const now = Date.now();
  if (!opts.force && now - lastBurstAt < 4000) return;
  lastBurstAt = now;

  const fire = (label: string) => {
    supabase.functions
      .invoke('v8-scheduled-launcher', { body: { trigger: opts.reason ?? 'short-loop', tick: label } })
      .catch(() => {});
  };

  // 4 disparos: 0s, 4s, 12s, 25s.
  fire('t0');
  setTimeout(() => fire('t4s'), 4_000);
  setTimeout(() => fire('t12s'), 12_000);
  setTimeout(() => fire('t25s'), 25_000);
}
