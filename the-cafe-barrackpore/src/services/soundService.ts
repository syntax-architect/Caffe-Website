/**
 * High-End Restaurant Sound & Haptic Synthesizer
 * The Café Barrackpore — Commercial Hospitality Suite
 *
 * Implements Web Audio API harmonic synthesis (zero external MP3 dependencies)
 * and mobile/tablet Haptic Feedback (navigator.vibrate).
 */

let sharedAudioCtx: AudioContext | null = null;

/**
 * Initializes and unlocks the browser Web Audio context
 */
export const unlockAudioContext = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return false;

    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioContextClass();
    }
    if (sharedAudioCtx.state === 'suspended') {
      await sharedAudioCtx.resume();
    }
    return sharedAudioCtx.state === 'running';
  } catch (err) {
    console.warn('[soundService] AudioContext unlock error:', err);
    return false;
  }
};

const getContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioContextClass();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
};

/**
 * Native Haptic Feedback for kitchen tablets, POS handhelds, and mobile phones
 */
export const triggerHapticFeedback = (pattern: number | number[] = 30): void => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration refusal on certain hardware
    }
  }
};

/**
 * 1. Authentic Brass Kitchen Service Bell
 * Harmonic dual-strike chime replicating front-of-house counter bell (G6: 1568Hz + C7: 2093Hz)
 * with shimmering metallic decay.
 */
export const playKitchenOrderBell = (): boolean => {
  const ctx = getContext();
  if (!ctx) return false;

  try {
    const now = ctx.currentTime;

    // Harmonic 1: 1568 Hz (G6 fundamental)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1567.98, now);
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 1.2);

    // Harmonic 2: 2093 Hz (C7 overtone shimmer)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(2093.0, now + 0.015);
    gain2.gain.setValueAtTime(0.25, now + 0.015);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.015);
    osc2.stop(now + 0.9);

    // Harmonic 3: 3135.96 Hz (G7 metallic ring)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(3135.96, now + 0.02);
    gain3.gain.setValueAtTime(0.08, now + 0.02);
    gain3.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.02);
    osc3.stop(now + 0.5);

    // Trigger double-pulse vibration for cooks
    triggerHapticFeedback([40, 80, 50]);

    return true;
  } catch (err) {
    console.warn('[soundService] Failed to play order bell:', err);
    return false;
  }
};

/**
 * 2. Tactile Ticket Bump Sound
 * Satisfying acoustic punch/wood-block tone (~480Hz -> 640Hz) when a chef punches a ticket.
 */
export const playTicketBumpSound = (): boolean => {
  const ctx = getContext();
  if (!ctx) return false;

  try {
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.08); // E5 resolve

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);

    // Quick haptic tick
    triggerHapticFeedback(25);

    return true;
  } catch (err) {
    console.warn('[soundService] Failed to play bump sound:', err);
    return false;
  }
};

/**
 * 3. Urgent Rush Alarm
 * Dual-tone strobe chime (660Hz -> 880Hz) to signal tickets exceeding threshold (>20 mins).
 */
export const playUrgentRushAlarm = (): boolean => {
  const ctx = getContext();
  if (!ctx) return false;

  try {
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.2);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.0, now + 0.15);
    gain2.gain.setValueAtTime(0.35, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.45);

    triggerHapticFeedback([60, 50, 60]);

    return true;
  } catch (err) {
    console.warn('[soundService] Failed to play urgent rush alarm:', err);
    return false;
  }
};

/**
 * 4. Dispatch / Gold Coin Payment Sound
 * Pleasant tri-tone upward chime (C5 -> E5 -> G5)
 */
export const playDispatchChime = (): boolean => {
  const ctx = getContext();
  if (!ctx) return false;

  try {
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.22, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.4);
    });

    triggerHapticFeedback([30, 40, 30]);

    return true;
  } catch (err) {
    console.warn('[soundService] Failed to play dispatch chime:', err);
    return false;
  }
};
