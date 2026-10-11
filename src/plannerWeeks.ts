// Semaine relue / semaine planifiée pour le rituel « Planifier ma semaine » :
// le lundi, on relit la semaine passée et on planifie celle qui commence ; les autres
// jours, on relit la semaine en cours et on planifie la suivante.
import { getWeekKey } from './streaks';

export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const mondayOf = (d: Date) => { const m = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m; };

export function plannerWeeks(now = new Date()) {
  const mon = mondayOf(now);
  const reviewStart = now.getDay() === 1 ? addDays(mon, -7) : mon;
  const planStart = addDays(reviewStart, 7);
  return { reviewStart, reviewEnd: addDays(reviewStart, 6), planStart, planEnd: addDays(planStart, 6), planKey: getWeekKey(planStart) };
}
