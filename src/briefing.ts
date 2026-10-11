// Briefing du matin : la journée en trois lignes (priorité, heures prises, vigilance)
import type { AppData, Task } from './types';
import { getKeyFromDate, isDateInRange } from './utils';
import { resolveDay } from './analytics';
import { pendingOneOffs } from './reschedule';
import { activeHabits, isScheduled } from './habits';
import { loadOf, liteFromTask } from './lighten';
import type { Occurrence } from './icsImport';

const toMin = (t?: string) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return isNaN(h) ? null : h * 60 + (m || 0); };
const hh = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`;
const fmt = (m: number) => m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}` : `${m} min`;

export const quarterKey = (d: Date) => `${d.getFullYear()}-T${Math.floor(d.getMonth() / 3) + 1}`;

export interface Briefing { priority: string; priorityKind: 'objectif' | 'tâche' | 'aucune'; hours: string; vigilance: string[]; habits: number; tasks: number }

export function computeBriefing(appData: AppData, now: Date, occs: Occurrence[]): Briefing {
  const k = getKeyFromDate(now);
  const d = new Date(k + 'T12:00:00');
  const skipped = new Set((appData.skips || []).filter(s => s.date === k).map(s => s.taskId));
  const planIds = new Set(appData.blocks.flatMap(b => b.tasks.map(t => t.id)));
  const items: { t: Task; block: string; blockId: string }[] = [];
  resolveDay(appData, d).forEach(b => b.tasks.filter(t => isDateInRange(d, t.recurrence, t.specificDate, t.startDate, t.endDate, t.stopDate) && !skipped.has(t.id)).forEach(t => items.push({ t, block: b.title, blockId: b.id })));

  // Priorité : objectif du jour/semaine, sinon tâche prioritaire, sinon première tâche à heure fixe
  const objective = appData.days[k]?.dailyGoalOverride || (appData.recurringGoals || []).find(g => isDateInRange(d, g.recurrence, g.specificDate, g.startDate, g.endDate, g.stopDate))?.title;
  const open = items.filter(i => !i.t.completedDates?.includes(k));
  const high = open.find(i => i.t.priority === 'high');
  const firstTimed = [...open].filter(i => i.t.startTime).sort((a, b) => (a.t.startTime || '').localeCompare(b.t.startTime || ''))[0];
  const priority = objective || high?.t.title || firstTimed?.t.title || '';

  // Heures prises
  const timed = items.filter(i => toMin(i.t.startTime) !== null);
  const meetings = occs.filter(o => !o.allDay);
  const starts = [...timed.map(i => toMin(i.t.startTime)!), ...meetings.map(o => o.start.getHours() * 60 + o.start.getMinutes())];
  const ends = [...timed.map(i => toMin(i.t.startTime)! + (i.t.duration || 30)), ...meetings.map(o => o.end.getHours() * 60 + o.end.getMinutes())];
  const lite = items.map(i => liteFromTask(i.t, i.blockId, i.block, toMin(i.t.startTime), !!i.t.completedDates?.includes(k), i.t.recurrence === 'specific' || i.t.recurrence === 'once' || !planIds.has(i.t.id)));
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const L = loadOf(lite, meetings.map(o => ({ title: o.title, start: o.start.getHours() * 60 + o.start.getMinutes(), end: o.end.getHours() * 60 + o.end.getMinutes() })), nowMin);
  const hours = starts.length
    ? `${timed.length} tâche${timed.length > 1 ? 's' : ''} à heure fixe${meetings.length ? ` et ${meetings.length} rendez-vous` : ''}, de ${hh(Math.min(...starts))} à ${hh(Math.max(...ends))} · ${fmt(L.planned)} à faire pour ${fmt(L.free)} disponibles`
    : `Aucun horaire fixé · ${items.length} tâche${items.length > 1 ? 's' : ''} au programme (${fmt(L.planned)} estimées)`;

  // Points de vigilance
  const vigilance: string[] = [];
  if (L.planned > L.free + 15) vigilance.push(`Journée chargée : ${fmt(L.planned - L.free)} de trop. Pense à alléger dans le Planning.`);
  if (L.overlaps) vigilance.push(`${L.overlaps} chevauchement${L.overlaps > 1 ? 's' : ''} d'horaires à régler.`);
  const from = new Date(d); from.setDate(from.getDate() - 7); const y = new Date(d); y.setDate(y.getDate() - 1);
  const pend = pendingOneOffs(appData, getKeyFromDate(from), getKeyFromDate(y)).length;
  if (pend) vigilance.push(`${pend} tâche${pend > 1 ? 's' : ''} non terminée${pend > 1 ? 's' : ''} des jours précédents à reporter ou abandonner.`);
  const ah = activeHabits(appData.habits).filter(h => isScheduled(h, k));
  const quitRisk = ah.find(h => h.kind === 'quit');
  if (quitRisk) vigilance.push(`Tiens bon sur « ${quitRisk.name} » aujourd'hui.`);
  const dl = (appData.inboxTasks || []).filter(t => !t.doneAt && t.deadline && t.deadline <= getKeyFromDate(new Date(d.getTime() + 2 * 86400000)));
  if (dl.length) vigilance.push(`Échéance proche dans la Boîte : « ${dl[0].title} »${dl.length > 1 ? ` (+${dl.length - 1})` : ''}.`);
  const dayOfQuarter = Math.floor((d.getTime() - new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1).getTime()) / 86400000);
  if (dayOfQuarter <= 14 && !appData.lifeReviews?.[quarterKey(d)]) vigilance.push('Début de trimestre : fais ta revue de la roue de la vie (Analytics).');
  if (!vigilance.length) vigilance.push('Rien de particulier : une belle journée à dérouler.');

  return { priority, priorityKind: objective ? 'objectif' : priority ? 'tâche' : 'aucune', hours, vigilance: vigilance.slice(0, 3), habits: ah.length, tasks: items.length };
}
