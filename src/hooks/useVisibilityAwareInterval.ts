import { useEffect, useRef } from 'react';

/**
 * Executa `callback` a cada `intervalMs`, mas APENAS enquanto a aba do
 * navegador estiver visível (document.visibilityState === 'visible').
 *
 * Quando o usuário troca de aba ou minimiza, o timer é pausado — economia
 * direta de egress Supabase e CPU. Ao voltar, dispara um refetch imediato
 * e reinicia o ciclo.
 *
 * @param callback   função chamada a cada tick (deve ser estável via useCallback)
 * @param intervalMs intervalo em ms; passe `null` para desativar
 */
export function useVisibilityAwareInterval(
  callback: () => void,
  intervalMs: number | null,
) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (intervalMs == null) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => cbRef.current(), intervalMs);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        cbRef.current(); // refetch imediato ao voltar
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [intervalMs]);
}
