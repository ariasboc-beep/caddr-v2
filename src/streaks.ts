import { Task } from './types';
import { getKeyFromDate, isDateInRange } from './utils';

// --- Série par habitude ---
// Parcourt les jours où la tâche est "due" (selon sa récurrence) en remontant
// depuis aujourd'hui, et compte les complétions consécutives.
export interface HabitStreak {
  current: number;
  best: number;
  rate30: number; // % de complétion sur les 30 derniers jours dus
  rate90: number;
  dueTotal: number;
}

export function computeHabitStreak(task: Task, horizonDays = 365): HabitStreak {
  const completed = new Set(task.completedDates || []);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let current = 0;
  let best = 0;
  let running = 0;
  let brokeCurrent = false;
  let due30 = 0, done30 = 0, due90 = 0, done90 = 0, dueTotal = 0;

  for (let i = 0; i < horizonDays; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const due = isDateInRange(d, task.recurrence, task.specificDate, task.startDate, task.endDate);
    if (!due) continue;

    dueTotal++;
    const key = getKeyFromDate(d);
    const isDone = completed.has(key);

    if (i < 30) { due30++; if (isDone) done30++; }
    if (i < 90) { due90++; if (isDone) done90++; }

    if (isDone) {
      running++;
      if (running > best) best = running;
      if (!brokeCurrent) current = running;
    } else {
      // Le jour même (i===0) ne casse pas la série en cours : la journée n'est pas finie.
      if (i === 0) { brokeCurrent = false; }
      else { brokeCurrent = true; running = 0; }
    }
  }

  return {
    current,
    best,
    rate30: due30 === 0 ? 0 : Math.round((done30 / due30) * 100),
    rate90: due90 === 0 ? 0 : Math.round((done90 / due90) * 100),
    dueTotal,
  };
}

// --- Série de journées parfaites avec jour(s) de grâce ---
// history: liste { date, val } (val = perf du jour en %). Autorise jusqu'à
// `graceDaysPerWeek` jours non-parfaits par fenêtre glissante de 7 jours sans
// rompre la série.
export function computePerfectStreakWithGrace(
  history: { date: string; val: number }[],
  graceDaysPerWeek: number
): { streak: number; graceUsed: number } {
  if (!history || history.length === 0) return { streak: 0, graceUsed: 0 };
  const todayKey = getKeyFromDate(new Date());
  // history est chronologique ; on remonte du plus récent au plus ancien.
  const ordered = [...history].sort((a, b) => (a.date < b.date ? 1 : -1));

  let streak = 0;
  let graceUsed = 0;
  const window: number[] = []; // 1 = raté, 0 = parfait (7 derniers jours comptés)

  for (let i = 0; i < ordered.length; i++) {
    const { date, val } = ordered[i];
    const perfect = val === 100;

    if (perfect) {
      streak++;
      window.push(0);
    } else {
      // Le jour courant non terminé ne casse pas la série.
      if (i === 0 && date === todayKey) continue;
      const missesInWindow = window.slice(-6).reduce((a, b) => a + b, 0);
      if (missesInWindow < graceDaysPerWeek) {
        graceUsed++;
        streak++;
        window.push(1);
      } else {
        break;
      }
    }
    if (window.length > 7) window.shift();
  }

  return { streak, graceUsed };
}

// Clé de semaine ISO (ex: "2026-W29")
export function getWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
