// Retour sensoriel discret à la complétion d'une tâche : un son doux + une
// vibration légère (mobile). Volontairement sobre — pas de bruitage de jeu.

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export function playCompletionFeedback(enabled: boolean = true) {
  if (!enabled) return;

  // Vibration légère (ignorée sur desktop)
  try { navigator.vibrate?.(18); } catch {}

  // Petit son : deux notes montantes, très courtes et douces
  const ctx = getCtx();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const notes = [660, 880]; // mi5 → la5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t0 = now + i * 0.09;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.09, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.2);
    });
  } catch {
    // silencieux : jamais bloquant
  }
}
