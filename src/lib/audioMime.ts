/**
 * Picks best supported MediaRecorder MIME for audio recording.
 * Priority: ogg/opus (Meta-friendly) > mp4 (Safari) > webm/opus (fallback).
 */
export function pickAudioMime(): { mime: string; ext: string } {
  const candidates: Array<{ mime: string; ext: string }> = [
    { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
    { mime: 'audio/mp4;codecs=mp4a.40.2', ext: 'm4a' },
    { mime: 'audio/mp4', ext: 'm4a' },
    { mime: 'audio/webm;codecs=opus', ext: 'webm' },
    { mime: 'audio/webm', ext: 'webm' },
  ];
  if (typeof MediaRecorder !== 'undefined' && (MediaRecorder as any).isTypeSupported) {
    for (const c of candidates) {
      try { if (MediaRecorder.isTypeSupported(c.mime)) return c; } catch { /* noop */ }
    }
  }
  return { mime: 'audio/webm', ext: 'webm' };
}
