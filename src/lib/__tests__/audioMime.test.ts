import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { pickAudioMime } from '../audioMime';

describe('pickAudioMime', () => {
  const originalMR = (globalThis as any).MediaRecorder;
  afterEach(() => { (globalThis as any).MediaRecorder = originalMR; });

  function setSupported(supported: string[]) {
    (globalThis as any).MediaRecorder = {
      isTypeSupported: (m: string) => supported.includes(m),
    };
  }

  it('prefers ogg/opus when available (Firefox)', () => {
    setSupported(['audio/ogg;codecs=opus', 'audio/webm;codecs=opus']);
    expect(pickAudioMime().mime).toBe('audio/ogg;codecs=opus');
  });

  it('falls back to mp4 (Safari) when ogg not available', () => {
    setSupported(['audio/mp4', 'audio/webm']);
    expect(pickAudioMime().ext).toBe('m4a');
  });

  it('falls back to webm (Chrome)', () => {
    setSupported(['audio/webm;codecs=opus', 'audio/webm']);
    expect(pickAudioMime().ext).toBe('webm');
  });

  it('returns webm default when MediaRecorder missing', () => {
    (globalThis as any).MediaRecorder = undefined;
    expect(pickAudioMime().ext).toBe('webm');
  });
});
