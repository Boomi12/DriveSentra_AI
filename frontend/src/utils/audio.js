// Web Audio API helper to generate synthesized alarm sounds without needing external audio files.

let audioCtx = null;

const getAudioContext = () => {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
};

/**
 * Play a synthesised alarm sound.
 * @param {string} type - The sound type: 'warning' (drowsiness warning), 'critical' (SOS/danger), 'distracted' (brief alert beep), or 'success' (positive confirmation)
 */
export const playAlertSound = (type = 'warning') => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Resume context if suspended (browser security policy requires user gesture)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    if (type === 'critical') {
      // Emergency alert: High-low alternating siren pattern (three pulses)
      const playPulse = (start, duration, frequency) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(frequency, start);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.3, start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration - 0.05);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };

      // Play 3 pulses
      playPulse(now, 0.25, 880);       // High beep
      playPulse(now + 0.3, 0.25, 587);   // Low beep
      playPulse(now + 0.6, 0.3, 880);    // High beep
      
    } else if (type === 'distracted') {
      // Distraction warning: Two short, sharp high-pitched beeps
      const playBeep = (start, freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.15);
      };
      playBeep(now, 1000);
      playBeep(now + 0.18, 1000);

    } else if (type === 'success') {
      // Success sound: Friendly upward chime
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc2.frequency.setValueAtTime(783.99, now + 0.2); // G5

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.45);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.45);

    } else {
      // Standard drowsiness warning: Repeated pulsing beeps
      const playWarningBeep = (start, freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.25, start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.4);
      };

      playWarningBeep(now, 660);
      playWarningBeep(now + 0.45, 660);
    }
  } catch (e) {
    console.warn('Web Audio playback blocked or not supported:', e);
  }
};
