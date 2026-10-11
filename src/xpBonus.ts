// XP centré sur la discipline : en plus des points par tâche, des bonus récompensent
// la régularité (journées tenues, séries, semaines au-dessus de l'objectif, mois en progrès,
// journal complet, semaine planifiée). Chaque bonus n'est attribué qu'une fois (clé unique).
import type { AppData } from './types';
import { getKeyFromDate } from './utils';
import { computeDay, computePeriod, getPeriod, trackingStart } from './analytics';
import { getWeekKey } from './streaks';
import { isComplete } from './journal';

export interface Bonus { key: string; xp: number; label: string }

export const GOOD_DAY = 80;          // une journée « tenue »
export const WEEK_TARGET = 80;       // objectif hebdomadaire par défaut
export const STREAK_STEPS: [number, number][] = [[3, 50], [7, 120], [14, 250], [30, 500], [60, 900], [100, 1500]];

export const XP_RULES = [
  { label: 'Tâche cochée', xp: '+15' },
  { label: 'Journée à 80 % ou plus', xp: '+20' },
  { label: 'Journée parfaite (100 %)', xp: '+40' },
  { label: 'Série de journées tenues : 3, 7, 14, 30, 60, 100 jours', xp: '+50 à +1500' },
  { label: 'Semaine au-dessus de ton objectif', xp: '+150 (+250 dès 90 %)' },
  { label: 'Mois meilleur que le précédent (ou ≥ 80 %)', xp: '+300' },
  { label: 'Journal complet (3 gratitudes + 3 fiertés)', xp: '+15' },
  { label: 'Semaine planifiée avec le rituel', xp: '+50' },
];

const addDays = (k: string, n: number) => { const d = new Date(k + 'T12:00:00'); d.setDate(d.getDate() + n); return getKeyFromDate(d); };

export function dueBonuses(appData: AppData, todayKey: string): Bonus[] {
  const given = appData.userProfile?.bonuses || {};
  const out: Bonus[] = [];
  const push = (b: Bonus) => { if (!given[b.key] && !out.some(x => x.key === b.key)) out.push(b); };
  const since = trackingStart(appData);
  if (since > todayKey) return out;
  const fmt = (k: string) => new Date(k + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' });

  // Journées closes des 7 derniers jours
  const rates: Record<string, number | null> = {};
  for (let i = 1; i <= 7; i++) {
    const k = addDays(todayKey, -i);
    if (k < since) break;
    const r = computeDay(appData, k, todayKey).rate;
    rates[k] = r;
    if (r !== null && r >= 100) push({ key: `day:${k}`, xp: 40, label: `Journée parfaite (${fmt(k)})` });
    else if (r !== null && r >= GOOD_DAY) push({ key: `day:${k}`, xp: 20, label: `Journée tenue à ${r} % (${fmt(k)})` });
  }

  // Série de journées tenues se terminant hier
  let run = 0, k = addDays(todayKey, -1);
  while (k >= since && run < 400) { const r = k in rates ? rates[k] : computeDay(appData, k, todayKey).rate; if (r === null || r < GOOD_DAY) break; run++; k = addDays(k, -1); }
  const runStart = addDays(todayKey, -run);
  STREAK_STEPS.forEach(([n, xp]) => { if (run >= n) push({ key: `streak:${n}:${runStart}`, xp, label: `Série de ${n} journées tenues` }); });

  // Semaines closes (les deux dernières)
  const target = appData.settings?.weeklyTarget ?? WEEK_TARGET;
  for (let w = 1; w <= 2; w++) {
    const anchor = new Date(todayKey + 'T12:00:00'); anchor.setDate(anchor.getDate() - 7 * w);
    const p = getPeriod('week', anchor);
    if (getKeyFromDate(p.end) >= todayKey || getKeyFromDate(p.end) < since) continue;
    const st = computePeriod(appData, p.start, p.end, todayKey);
    if (st.rate !== null && st.total >= 5 && st.rate >= target) push({ key: `week:${getWeekKey(p.start)}`, xp: st.rate >= 90 ? 250 : 150, label: `Semaine à ${st.rate} % (objectif ${target} %)` });
  }

  // Mois clos (le dernier)
  const t = new Date(todayKey + 'T12:00:00');
  const lastMonth = getPeriod('month', new Date(t.getFullYear(), t.getMonth() - 1, 15));
  if (getKeyFromDate(lastMonth.end) >= since) {
    const m = computePeriod(appData, lastMonth.start, lastMonth.end, todayKey);
    const pm = getPeriod('month', new Date(t.getFullYear(), t.getMonth() - 2, 15));
    const p = computePeriod(appData, pm.start, pm.end, todayKey);
    const better = m.rate !== null && p.rate !== null && p.total > 0 && m.rate >= p.rate + 5;
    if (m.rate !== null && m.total >= 20 && (better || m.rate >= 80)) {
      const name = lastMonth.start.toLocaleDateString('fr-FR', { month: 'long' });
      push({ key: `month:${getKeyFromDate(lastMonth.start).slice(0, 7)}`, xp: 300, label: better ? `${name} : +${m.rate - (p.rate || 0)} pts sur le mois précédent` : `${name} à ${m.rate} %` });
    }
  }

  // Journal complet (aujourd'hui et 7 derniers jours)
  for (let i = 0; i <= 7; i++) {
    const d = addDays(todayKey, -i);
    if (isComplete(appData.journal?.[d])) push({ key: `journal:${d}`, xp: 15, label: `Journal complet (${i === 0 ? "aujourd'hui" : fmt(d)})` });
  }

  // Semaine planifiée avec le rituel
  const plan = appData.settings?.weekPlanDone;
  if (plan) push({ key: `plan:${plan}`, xp: 50, label: 'Semaine planifiée' });

  return out;
}
