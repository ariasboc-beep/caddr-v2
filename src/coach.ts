// Données envoyées au coach IA pour le résumé de la semaine (chiffres, pas de textes privés du journal)
import type { AppData } from './types';
import { getKeyFromDate } from './utils';
import { computePeriod, objectiveStats } from './analytics';
import { pendingOneOffs } from './reschedule';
import { activeHabits, habitStats } from './habits';
import { getWeekKey } from './streaks';
import { filled } from './journal';

export function weekCoachPayload(appData: AppData, start: Date, end: Date, todayKey: string) {
  const cur = computePeriod(appData, start, end, todayKey);
  const ps = new Date(start); ps.setDate(ps.getDate() - 7); const pe = new Date(end); pe.setDate(pe.getDate() - 7);
  const prev = computePeriod(appData, ps, pe, todayKey);
  const blocks: Record<string, { total: number; done: number }> = {};
  cur.days.forEach(d => d.blocks.forEach(b => { blocks[b.title] = blocks[b.title] || { total: 0, done: 0 }; blocks[b.title].total += b.total; blocks[b.title].done += b.done; }));
  const obj = objectiveStats(appData, start, end, todayKey);
  const a = getKeyFromDate(start), b = getKeyFromDate(end) < todayKey ? getKeyFromDate(end) : todayKey;
  const review = appData.weeklyReviews?.[getWeekKey(start)];
  const journalDays = Object.keys(appData.journal || {}).filter(k => k >= a && k <= b && (filled(appData.journal![k].gratitude).length || filled(appData.journal![k].pride).length)).length;
  const focus = (appData.focusSessions || []).filter(s => s.date >= a && s.date <= b);
  return {
    semaine: `${a} → ${getKeyFromDate(end)}`,
    tauxSemaine: cur.rate, tachesFaites: cur.done, tachesPrevues: cur.total, joursParfaits: cur.perfectDays,
    tauxSemainePrecedente: prev.rate,
    parJour: cur.days.map(d => ({ jour: new Date(d.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long' }), taux: d.future ? 'à venir' : d.rate })),
    parBloc: Object.entries(blocks).map(([t, v]) => ({ bloc: t, taux: v.total ? Math.round((v.done / v.total) * 100) : null, faites: v.done, prevues: v.total })),
    objectifPrioritaire: { definis: obj.defined, atteints: obj.done },
    tachesPonctuellesNonFaites: a <= b ? pendingOneOffs(appData, a, b).map(p => p.task.title).slice(0, 10) : [],
    habitudes: activeHabits(appData.habits).map(h => { const st = habitStats(h, a, b); return { habitude: h.name, faites: st.done, ratees: st.fail }; }),
    sessionsFocus: focus.length,
    joursJournalEcrits: journalDays,
    monBilan: review ? { reussites: review.wins || '', aAmeliorer: review.improve || '' } : null,
  };
}
