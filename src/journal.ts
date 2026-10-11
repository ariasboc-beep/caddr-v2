// Journal de gratitude et de fierté : calculs (séries, totaux, souvenirs)
import type { JournalEntry } from './types';
import { getKeyFromDate } from './utils';

export type Journal = { [dateKey: string]: JournalEntry };

export const filled = (xs?: string[]) => (xs || []).filter(x => x && x.trim());
export const countItems = (e?: JournalEntry) => filled(e?.gratitude).length + filled(e?.pride).length;
/** Une journée « écrite » : au moins une gratitude ET une fierté */
export const isWritten = (e?: JournalEntry) => filled(e?.gratitude).length > 0 && filled(e?.pride).length > 0;
/** Une journée complète : 3 gratitudes et 3 fiertés */
export const isComplete = (e?: JournalEntry) => filled(e?.gratitude).length >= 3 && filled(e?.pride).length >= 3;

const prevKey = (k: string) => { const d = new Date(k + 'T12:00:00'); d.setDate(d.getDate() - 1); return getKeyFromDate(d); };

export function journalStats(j: Journal, todayKey: string) {
  const days = Object.keys(j).filter(k => isWritten(j[k])).sort();
  // Série en cours : jusqu'à aujourd'hui, ou jusqu'à hier si aujourd'hui n'est pas encore écrit
  let current = 0;
  let k = isWritten(j[todayKey]) ? todayKey : prevKey(todayKey);
  while (isWritten(j[k])) { current++; k = prevKey(k); }
  let best = 0, run = 0, last = '';
  days.forEach(d => { run = last && prevKey(d) === last ? run + 1 : 1; best = Math.max(best, run); last = d; });
  const gratitude = Object.values(j).reduce((s, e) => s + filled(e.gratitude).length, 0);
  const pride = Object.values(j).reduce((s, e) => s + filled(e.pride).length, 0);
  const complete = Object.values(j).filter(isComplete).length;
  return { current, best, gratitude, pride, written: days.length, complete };
}

/** Souvenir du jour : une entrée passée (au moins 7 jours), choisie de façon stable pour la journée */
export function memoryOf(j: Journal, todayKey: string): { date: string; entry: JournalEntry } | null {
  const lim = new Date(todayKey + 'T12:00:00'); lim.setDate(lim.getDate() - 7);
  const limK = getKeyFromDate(lim);
  const past = Object.keys(j).filter(k => k <= limK && countItems(j[k]) > 0).sort();
  if (!past.length) return null;
  const seed = todayKey.split('-').reduce((s, x) => s * 31 + Number(x), 7);
  const date = past[Math.abs(seed) % past.length];
  return { date, entry: j[date] };
}

export const GRATITUDE_PROMPTS = [
  'Une personne qui a compté aujourd’hui',
  'Un petit plaisir simple (un repas, une musique, un rayon de soleil)',
  'Quelque chose que ton corps t’a permis de faire',
  'Une chose apprise aujourd’hui',
  'Un moment de calme ou de beauté',
  'Une difficulté qui t’a fait grandir',
  'Un confort que tu as souvent oublié (un toit, de l’eau, ta santé)',
  'Un message, un sourire, un geste reçu',
  'Une opportunité qui s’offre à toi en ce moment',
];
export const PRIDE_PROMPTS = [
  'Une tâche accomplie, même petite',
  'Une habitude tenue malgré la fatigue',
  'Une peur ou une gêne que tu as affrontée',
  'Une bonne décision, même difficile',
  'Une façon dont tu as aidé quelqu’un',
  'Un progrès par rapport à hier ou à l’an dernier',
  'Une limite posée avec respect',
  'Un effort que personne n’a vu',
  'Une qualité dont tu as fait preuve (patience, courage, rigueur…)',
];
