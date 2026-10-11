// Analyses fines : discipline pondérée, heures productives, ponctualité,
// prévu vs réalisé (mode Focus), progression automatique des objectifs long terme.
import type { AppData, Task, FocusSession, LongTermGoal } from './types';
import { getKeyFromDate, isDateInRange } from './utils';
import { resolveDay, trackingStart, eachDay } from './analytics';

const atNoon = (k: string) => new Date(k + 'T12:00:00');
const visible = (tasks: Task[] | undefined, d: Date) => (tasks || []).filter(t => isDateInRange(d, t.recurrence, t.specificDate, t.startDate, t.endDate, t.stopDate));
const toMin = (hhmm?: string) => { if (!hhmm) return null; const [h, m] = hhmm.split(':').map(Number); return isNaN(h) ? null : h * 60 + (m || 0); };

export const PRIORITY_WEIGHT: Record<string, number> = { high: 2, medium: 1.5, low: 1 };
export const taskWeight = (t: Task) => Math.max(0.5, (t.duration || 30) / 30) * (PRIORITY_WEIGHT[t.priority || ''] || 1);

/** Jours passés (et aujourd'hui) de la période, depuis le début du suivi */
function pastDays(appData: AppData, start: Date, end: Date, todayKey: string) {
  const since = trackingStart(appData);
  return eachDay(start, end).filter(k => k <= todayKey && k >= since);
}

/** Taux simple vs taux pondéré (durée × priorité) */
export function weightedDiscipline(appData: AppData, start: Date, end: Date, todayKey: string) {
  let n = 0, nd = 0, w = 0, wd = 0;
  const heavy = { total: 0, done: 0 }; // tâches lourdes (≥ 60 min ou priorité haute)
  pastDays(appData, start, end, todayKey).forEach(k => {
    const d = atNoon(k);
    resolveDay(appData, d).forEach(b => visible(b.tasks, d).forEach(t => {
      const done = !!t.completedDates?.includes(k);
      const wt = taskWeight(t);
      n++; w += wt; if (done) { nd++; wd += wt; }
      if ((t.duration || 0) >= 60 || t.priority === 'high') { heavy.total++; if (done) heavy.done++; }
    }));
  });
  return {
    simple: n ? Math.round((nd / n) * 100) : null,
    weighted: w ? Math.round((wd / w) * 100) : null,
    heavyRate: heavy.total ? Math.round((heavy.done / heavy.total) * 100) : null,
    heavyTotal: heavy.total,
  };
}

/** Répartition des validations par heure + ponctualité des tâches à heure fixe */
export function productiveHours(appData: AppData, start: Date, end: Date, todayKey: string) {
  const hours = Array(24).fill(0) as number[];
  const byBlock: Record<string, number[]> = {};
  let onTime = 0, late = 0, lateSum = 0, count = 0;
  pastDays(appData, start, end, todayKey).forEach(k => {
    const d = atNoon(k);
    resolveDay(appData, d).forEach(b => visible(b.tasks, d).forEach(t => {
      const at = toMin(t.completedAt?.[k]);
      if (at === null || !t.completedDates?.includes(k)) return;
      const h = Math.floor(at / 60);
      hours[h]++; count++;
      (byBlock[b.title] = byBlock[b.title] || Array(24).fill(0))[h]++;
      const s = toMin(t.startTime);
      if (s !== null) {
        const endSlot = s + (t.duration || 30);
        if (at <= endSlot + 15) onTime++; else { late++; lateSum += at - endSlot; }
      }
    }));
  });
  // Meilleure plage de 2 h
  let bestH = -1, bestN = 0;
  for (let h = 0; h < 23; h++) { const v = hours[h] + hours[h + 1]; if (v > bestN) { bestN = v; bestH = h; } }
  const blockPeaks = Object.entries(byBlock).map(([title, hs]) => {
    const tot = hs.reduce((a, b) => a + b, 0);
    const avgMin = Math.round(hs.reduce((s, v, h) => s + v * (h * 60 + 30), 0) / Math.max(1, tot));
    return { title, total: tot, avgMin };
  }).filter(x => x.total >= 3).sort((a, b) => a.avgMin - b.avgMin);
  return {
    hours, count, bestH, bestShare: count ? Math.round((bestN / count) * 100) : 0,
    punctual: onTime + late ? Math.round((onTime / (onTime + late)) * 100) : null,
    avgLate: late ? Math.round(lateSum / late) : 0, timedCount: onTime + late, blockPeaks,
  };
}

/** Prévu vs réalisé à partir des sessions Focus de la période */
export function focusEstimates(sessions: FocusSession[], start: Date, end: Date) {
  const a = getKeyFromDate(start), b = getKeyFromDate(end);
  const list = sessions.filter(s => s.date >= a && s.date <= b && typeof s.actualMin === 'number' && s.actualMin! > 0);
  const planned = list.reduce((s, x) => s + x.durationMin, 0);
  const actual = list.reduce((s, x) => s + (x.actualMin || 0), 0);
  const per: Record<string, { planned: number; actual: number; n: number }> = {};
  list.forEach(s => { const p = (per[s.taskTitle] = per[s.taskTitle] || { planned: 0, actual: 0, n: 0 }); p.planned += s.durationMin; p.actual += s.actualMin || 0; p.n++; });
  const tasks = Object.entries(per).map(([title, v]) => ({ title, ...v, diff: Math.round(((v.actual - v.planned) / Math.max(1, v.planned)) * 100) }))
    .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff)).slice(0, 4);
  return { sessions: list.length, planned, actual, diff: planned ? Math.round(((actual - planned) / planned) * 100) : null, inTime: list.filter(s => s.completedInTime).length, tasks };
}

/** Une tâche compte pour l'objectif si son bloc ou elle-même y est relié(e) */
const linked = (g: LongTermGoal, blockTitle: string, t: Task) => (g.linkedBlocks || []).includes(blockTitle) || (g.linkedTasks || []).includes(t.id);

/**
 * Progression automatique d'un objectif long terme :
 * tâches reliées faites / tâches reliées prévues entre sa création et son échéance.
 * « attendu » = part du plan qui aurait dû être faite à aujourd'hui (pour dire si on est en avance).
 */
export function goalProgress(appData: AppData, g: LongTermGoal, todayKey: string) {
  const startK = [g.createdAt.slice(0, 10), trackingStart(appData)].sort()[1] || g.createdAt.slice(0, 10);
  const endK = g.targetDate && g.targetDate > todayKey ? g.targetDate : todayKey;
  if (startK > endK) return { progress: 0, done: 0, planned: 0, expected: 0, past: 0 };
  let done = 0, planned = 0, past = 0;
  eachDay(atNoon(startK), atNoon(endK)).forEach(k => {
    const d = atNoon(k);
    resolveDay(appData, d).forEach(b => visible(b.tasks, d).forEach(t => {
      if (!linked(g, b.title, t)) return;
      planned++;
      if (k <= todayKey) past++;
      if (t.completedDates?.includes(k)) done++;
    }));
  });
  return {
    progress: planned ? Math.round((done / planned) * 100) : 0,
    done, planned, past,
    expected: planned ? Math.round((past / planned) * 100) : 0,
  };
}
