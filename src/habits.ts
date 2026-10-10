// Calculs des habitudes indépendantes (prendre / arrêter une habitude)
import { StandaloneHabit, HabitDayStatus } from './types';
import { getKeyFromDate } from './utils';
import { stripHtml } from './components/RichText';

// Une note est vide si elle ne contient ni texte ni image
export const isEmptyNote = (html?: string) => !html || (!stripHtml(html).trim() && !/<img/i.test(html));

export type DayState = HabitDayStatus | 'open' | 'off' | 'future' | 'before';
// open = jour prévu passé (ou aujourd'hui) sans réponse

const noon = (k: string) => new Date(k + 'T12:00:00');
export const todayKey = () => getKeyFromDate(new Date());

export const isScheduled = (h: StandaloneHabit, k: string) => {
  if (k < h.startDate) return false;
  if (!h.days || h.days.length === 0 || h.days.length === 7) return true;
  return h.days.includes(noon(k).getDay());
};

export const stateOn = (h: StandaloneHabit, k: string, tk = todayKey()): DayState => {
  if (k < h.startDate) return 'before';
  if (k > tk) return 'future';
  const s = h.entries?.[k]?.s;
  if (s) return s;
  return isScheduled(h, k) ? 'open' : 'off';
};

export const labelsFor = (h: StandaloneHabit) => h.kind === 'quit'
  ? { done: 'Tenu', fail: 'Rechute', skip: 'Ignoré', open: 'Pas encore noté', verb: 'Tenu aujourd’hui ?' }
  : { done: 'Fait', fail: 'Pas fait', skip: 'Ignoré', open: 'Pas encore noté', verb: 'Fait aujourd’hui ?' };

const range = (from: string, to: string) => {
  const out: string[] = [];
  const c = noon(from), e = noon(to);
  while (c <= e) { out.push(getKeyFromDate(c)); c.setDate(c.getDate() + 1); }
  return out;
};

export interface HabitStats {
  current: number;        // série en cours (jours prévus réussis consécutifs)
  best: number;
  done: number; fail: number; skip: number; open: number;
  rate: number | null;    // réussis / (réussis + échecs + non notés passés) — aujourd'hui non noté exclu
  sinceLastFail: number;  // « arrêter » : jours écoulés depuis la dernière rechute (ou le début)
  lastFail?: string;
  notes: { date: string; note: string; s?: HabitDayStatus }[];
}

export function habitStats(h: StandaloneHabit, from?: string, to?: string): HabitStats {
  const tk = todayKey();
  const start = h.startDate;
  const end = tk;
  const all = start <= end ? range(start, end) : [];
  let best = 0, run = 0;
  all.forEach(k => {
    const st = stateOn(h, k, tk);
    if (st === 'done') { run++; best = Math.max(best, run); }
    else if (st === 'fail' || (st === 'open' && k !== tk)) run = 0;
  });
  let current = 0;
  for (let i = all.length - 1; i >= 0; i--) {
    const k = all[i]; const st = stateOn(h, k, tk);
    if (st === 'off' || st === 'skip') continue;
    if (st === 'done') current++;
    else if (st === 'open' && k === tk) continue;
    else break;
  }
  const pFrom = from && from > start ? from : start;
  const pTo = to && to < end ? to : end;
  let done = 0, fail = 0, skip = 0, open = 0;
  if (pFrom <= pTo) range(pFrom, pTo).forEach(k => {
    const st = stateOn(h, k, tk);
    if (st === 'done') done++; else if (st === 'fail') fail++; else if (st === 'skip') skip++;
    else if (st === 'open' && k !== tk) open++;
  });
  const denom = done + fail + open;
  const fails = Object.entries(h.entries || {}).filter(([, e]) => e.s === 'fail').map(([k]) => k).sort();
  const lastFail = fails[fails.length - 1];
  const ref = lastFail || start;
  // Jours pleins écoulés depuis la dernière rechute (ou depuis le début de l'habitude)
  const sinceLastFail = Math.max(0, Math.round((noon(tk).getTime() - noon(ref).getTime()) / 86400000));
  const notes = Object.entries(h.entries || {}).filter(([, e]) => !isEmptyNote(e.note)).map(([date, e]) => ({ date, note: e.note!, s: e.s })).sort((a, b) => b.date.localeCompare(a.date));
  return { current, best, done, fail, skip, open, rate: denom ? Math.round((done / denom) * 100) : null, sinceLastFail, lastFail, notes };
}

// Taux de réussite par mois (pour le graphique de la fiche)
export function monthlyRates(h: StandaloneHabit, months = 6): { key: string; label: string; rate: number | null; done: number; total: number }[] {
  const out = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1, 12);
    const from = getKeyFromDate(d);
    const to = getKeyFromDate(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12));
    const s = habitStats(h, from, to);
    const total = s.done + s.fail + s.open;
    out.push({ key: from.slice(0, 7), label: d.toLocaleDateString('fr-FR', { month: 'short' }).replace(/\.$/, ''), rate: total ? Math.round((s.done / total) * 100) : null, done: s.done, total });
  }
  return out;
}

export const nextStatus = (s?: HabitDayStatus): HabitDayStatus | undefined => s === undefined ? 'done' : s === 'done' ? 'fail' : s === 'fail' ? 'skip' : undefined;

export const activeHabits = (list?: StandaloneHabit[]) => (list || []).filter(h => !h.deleted && !h.archived);
