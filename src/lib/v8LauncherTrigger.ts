/**
 * Etapa 2 (mai/2026): short-loop trigger do v8-scheduled-launcher.
 *
 * Por que: o cron do launcher roda a cada 1 min. Se o usuário enfileira logo
 * após o cron passar, pode esperar quase 60s para o lote sair de `queued`
 * para `processing`. Esse helper dispara o launcher imediatamente e re-tenta
 * 2x em curtos intervalos (5s, 10s) para cobrir casos de:
 *  - cold start da edge function
 *  - race entre INSERT do lote e leitura do launcher
 *  - falha pontual da primeira chamada (rede)
 *
 * Cada invocação é independente e best-effort (catch silencioso). O launcher
 * é idempotente — promove apenas lotes elegíveis, então rodar 3x é seguro.
 */
import { supabase } from '@/integrations/supabase/client';

let lastBurstAt = 0;

export function triggerLauncherShortLoop(opts: { reason?: string } = {}) {
  // Debounce global: se já disparamos a salva nos últimos 4s, ignora.
  const now = Date.now();
  if (now - lastBurstAt < 4000) return;
  lastBurstAt = now;

  const fire = (label: string) => {
    supabase.functions
      .invoke('v8-scheduled-launcher', { body: { trigger: opts.reason ?? 'short-loop', tick: label } })
      .catch(() => {});
  };

  // 3 disparos: imediato, +5s, +10s.
  fire('t0');
  setTimeout(() => fire('t5s'), 5_000);
  setTimeout(() => fire('t10s'), 10_000);
}
