// Som curto via Web Audio API — sem nenhum asset extra. Tocado quando um lote
// V8 termina (toggle em Configurações > Auto-retry > "Tocar som ao concluir").
// Usa um padrão "beep duplo" (✓✓) em ~0.4s, que não atrapalha quem está em call.
let _ctx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_ctx) {
    try {
      _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return _ctx;
}

export function playBatchCompleteSound(success: boolean) {
  const ac = ctx();
  if (!ac) return;
  try {
    const now = ac.currentTime;
    const tones = success ? [880, 1320] : [440, 330];
    tones.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = now + i * 0.18;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain).connect(ac.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  } catch {
    // silencia falhas de áudio (browser bloqueou autoplay etc.)
  }
}
