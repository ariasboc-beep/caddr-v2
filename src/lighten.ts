// Journée surchargée : détection et proposition d'une version allégée (sans IA).
import type { Task } from './types';

export interface DayTaskLite { id: string; blockId: string; title: string; block: string; start: number | null; dur: number; priority?: string; isHabit?: boolean; oneOff: boolean; done: boolean }
export interface Meeting { title: string; start: number; end: number }
export interface LightenProposal {
  summary: string;
  postpone: { id: string; reason: string }[];
  reschedule: { id: string; startTime: string }[];
  source: 'ia' | 'local';
}

export const DAY_START = 7 * 60, DAY_END = 22 * 60;
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fmt = (m: number) => m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}` : `${m} min`;

/** Temps restant à faire vs temps disponible (aujourd'hui : à partir de maintenant) */
export function loadOf(tasks: DayTaskLite[], meetings: Meeting[], nowMin: number | null) {
  const from = Math.max(DAY_START, nowMin ?? DAY_START);
  const remaining = tasks.filter(t => !t.done && (t.start === null || t.start + t.dur > from));
  const planned = remaining.reduce((s, t) => s + t.dur, 0);
  const busy = meetings.reduce((s, m) => s + Math.max(0, Math.min(DAY_END, m.end) - Math.max(from, m.start)), 0);
  const free = Math.max(0, DAY_END - from - busy);
  // Chevauchements entre tâches, ou entre une tâche et un rendez-vous
  const timed = remaining.filter(t => t.start !== null).map(t => ({ s: t.start!, e: t.start! + t.dur }));
  const all = [...timed, ...meetings.map(m => ({ s: m.start, e: m.end }))].sort((a, b) => a.s - b.s);
  let overlaps = 0; let end = -1;
  all.forEach(x => { if (x.s < end) overlaps++; end = Math.max(end, x.e); });
  return { planned, free, overlaps, remaining, overloaded: planned > free + 15 || overlaps > 0 };
}

const keepScore = (t: DayTaskLite) => (t.isHabit ? 4 : 0) + (t.priority === 'high' ? 4 : t.priority === 'medium' ? 1.5 : 0) + (t.oneOff ? 0 : 1) + (t.start !== null ? 0.5 : 0);

export function localProposal(tasks: DayTaskLite[], meetings: Meeting[], nowMin: number | null): LightenProposal {
  const L = loadOf(tasks, meetings, nowMin);
  const from = Math.max(DAY_START, nowMin ?? DAY_START);
  const postpone: LightenProposal['postpone'] = [];
  let planned = L.planned;
  // 1. Reporter les tâches les moins prioritaires jusqu'à tenir dans le temps libre
  const order = [...L.remaining].sort((a, b) => keepScore(a) - keepScore(b) || b.dur - a.dur);
  for (const t of order) {
    if (planned <= L.free) break;
    if (t.isHabit || t.priority === 'high') continue;
    postpone.push({ id: t.id, reason: t.priority === 'low' ? 'priorité basse' : t.oneOff ? 'ponctuelle, peut attendre demain' : 'récurrente, reviendra au prochain jour prévu' });
    planned -= t.dur;
  }
  // 2. Recaler les tâches à heure fixe qui se chevauchent (les rendez-vous ne bougent pas)
  const out = new Set(postpone.map(p => p.id));
  const occupied = meetings.map(m => ({ s: m.start, e: m.end }));
  const reschedule: LightenProposal['reschedule'] = [];
  L.remaining.filter(t => !out.has(t.id) && t.start !== null).sort((a, b) => a.start! - b.start!).forEach(t => {
    let s = Math.max(t.start!, t.start! < from ? from : t.start!);
    const clash = (x: number) => occupied.find(o => x < o.e && x + t.dur > o.s);
    let guard = 0;
    for (let c = clash(s); c && guard++ < 50; c = clash(s)) s = Math.ceil(c.e / 15) * 15;
    if (s + t.dur > 24 * 60) { postpone.push({ id: t.id, reason: 'plus de créneau libre aujourd’hui' }); return; }
    occupied.push({ s, e: s + t.dur });
    if (s !== t.start) reschedule.push({ id: t.id, startTime: hhmm(s) });
  });
  const saved = L.planned - planned;
  const summary = postpone.length || reschedule.length
    ? `${postpone.length ? `${postpone.length} tâche${postpone.length > 1 ? 's' : ''} à reporter (${fmt(saved)} libérées)` : ''}${postpone.length && reschedule.length ? ' et ' : ''}${reschedule.length ? `${reschedule.length} à recaler pour supprimer les chevauchements` : ''}. Habitudes et priorités hautes sont conservées.`
    : 'Ta journée tient dans le temps disponible : rien à alléger.';
  return { summary, postpone, reschedule, source: 'local' };
}

export const liteFromTask = (t: Task, blockId: string, block: string, start: number | null, done: boolean, oneOff: boolean): DayTaskLite =>
  ({ id: t.id, blockId, title: t.title, block, start, dur: Math.max(10, t.duration || 30), priority: t.priority, isHabit: t.isHabit, oneOff, done });
