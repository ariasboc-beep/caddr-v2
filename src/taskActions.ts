// Actions sur une tâche du jour : reporter, annuler, affecter ; détection des tâches imprévues.
// Fonctions pures : elles reçoivent l'état et renvoient le nouvel état.
import type { AppData, Block, Task, TaskEvent, SkipRecord } from './types';
import { generateId, getKeyFromDate, isDateInRange } from './utils';
import { findTask, isOneOff, relocateTask, addOneOff } from './reschedule';

const atNoon = (k: string) => new Date(k + 'T12:00:00');
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
export const fmtDayShort = (k: string) => atNoon(k).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\.(?=\s|$)/g, '');
export const addDaysKey = (k: string, n: number) => { const d = atNoon(k); d.setDate(d.getDate() + n); return getKeyFromDate(d); };

const log = (data: AppData, e: Omit<TaskEvent, 'id' | 'at'>): AppData => ({ ...data, taskLog: [...(data.taskLog || []), { ...e, id: generateId(), at: new Date().toISOString() }] });
const skip = (data: AppData, s: Omit<SkipRecord, 'id'>): AppData => ({ ...data, skips: [...(data.skips || []).filter(x => !(x.taskId === s.taskId && x.date === s.date)), { ...s, id: generateId() }] });

/** Statut du jour d'une tâche (annulée, reportée, affectée, sautée), ou null */
export function dayStatus(data: AppData, taskId: string, k: string): SkipRecord | null {
  return (data.skips || []).find(s => s.taskId === taskId && s.date === k) || null;
}

/**
 * Reporter une tâche du jour `fromKey` au jour `toKey`.
 * - Tâche ponctuelle : elle est déplacée (même bloc si possible).
 * - Tâche récurrente : elle est marquée « reportée » ce jour-là, et une copie ponctuelle
 *   (avec ses sous-tâches) est créée le jour choisi. La récurrence continue normalement.
 */
export function postponeTask(data: AppData, taskId: string, fromKey: string, toKey: string): AppData {
  const f = findTask(data, taskId, fromKey);
  if (!f || toKey === fromKey) return data;
  if (isOneOff(f)) {
    const next = relocateTask(data, taskId, toKey);
    return log(next, { kind: 'postponed', taskId, taskTitle: f.task.title, date: fromKey, to: toKey });
  }
  const copyId = generateId();
  const fresh = (t: Task): Task => ({ ...clone(t), id: generateId(), completedDates: [], completedAt: undefined, executionNotes: undefined, subTasks: (t.subTasks || []).map(fresh) });
  const copy: Task = { ...fresh(f.task), id: copyId };
  let next = skip(data, { taskId, taskTitle: f.task.title, date: fromKey, reason: `Reportée au ${fmtDayShort(toKey)}`, kind: 'postpone' });
  next = addOneOff(next, copy, toKey, f.block.id);
  return log(next, { kind: 'postponed', taskId, taskTitle: f.task.title, date: fromKey, to: toKey, newTaskId: copyId });
}

/** Annuler une tâche pour le jour `k` (elle reste visible, barrée, et ne compte plus dans le taux). */
export function cancelTask(data: AppData, taskId: string, taskTitle: string, k: string, reason: string): AppData {
  const next = skip(data, { taskId, taskTitle, date: k, reason: reason.trim() || 'Annulée', kind: 'cancel' });
  return log(next, { kind: 'cancelled', taskId, taskTitle, date: k, reason: reason.trim() || undefined });
}

/** Rétablir une tâche annulée / sautée pour le jour `k` (les reports ne se défont pas ici). */
export function restoreTask(data: AppData, taskId: string, k: string): AppData {
  return { ...data, skips: (data.skips || []).filter(s => !(s.taskId === taskId && s.date === k)) };
}

/** Affectée à quelqu'un : retirée de la journée de l'expéditeur et tracée. */
export function markAssigned(data: AppData, taskId: string, taskTitle: string, k: string, email: string, assignmentId: string, note?: string): AppData {
  const next = skip(data, { taskId, taskTitle, date: k, reason: `Affectée à ${email}`, kind: 'assign' });
  return log(next, { kind: 'assigned', taskId, taskTitle, date: k, email, assignmentId, reason: note?.trim() || undefined, status: 'pending' });
}

/** Met à jour le statut des affectations envoyées (accepted, declined, done). */
export function syncAssignmentStatuses(data: AppData, statuses: Record<string, TaskEvent['status']>): AppData {
  let changed = false;
  const taskLog = (data.taskLog || []).map(e => {
    const s = e.assignmentId ? statuses[e.assignmentId] : undefined;
    if (s && s !== e.status) { changed = true; return { ...e, status: s, at: new Date().toISOString() }; }
    return e;
  });
  return changed ? { ...data, taskLog } : data;
}

// ---------- Tâches imprévues ----------

/** Tâches (niveau principal) prévues le jour k, telles que la Routine les affiche. */
export function visibleTaskIds(data: AppData, k: string): { id: string; title: string }[] {
  const d = atNoon(k);
  const src: Block[] = data.days[k]?.blocks || data.blocks;
  const out: { id: string; title: string }[] = [];
  src.filter(b => isDateInRange(d, b.recurrence, b.specificDate, b.startDate, b.endDate, b.stopDate))
    .forEach(b => b.tasks.filter(t => isDateInRange(d, t.recurrence, t.specificDate, t.startDate, t.endDate, t.stopDate)).forEach(t => out.push({ id: t.id, title: t.title })));
  return out;
}

/**
 * Au premier affichage du jour, on photographie les tâches prévues. Toute tâche qui apparaît
 * ensuite pour ce jour (ajout manuel, Cady, tâche reçue…) est une « imprévue », tracée une fois.
 * Les reports vers ce jour ne sont pas des imprévus. Renvoie `data` inchangé si rien ne change.
 */
export function trackUnplanned(data: AppData, todayKey: string): AppData {
  const snaps = data.daySnapshots || {};
  const now = visibleTaskIds(data, todayKey);
  if (!snaps[todayKey]) {
    // Photo du jour ; on ne garde que ~13 mois d'historique
    const limit = addDaysKey(todayKey, -400);
    const kept = Object.fromEntries(Object.entries(snaps).filter(([k]) => k >= limit));
    return { ...data, daySnapshots: { ...kept, [todayKey]: now.map(t => t.id) } };
  }
  const planned = new Set(snaps[todayKey]);
  const logged = new Set((data.taskLog || []).filter(e => e.kind === 'unplanned' && e.date === todayKey).map(e => e.taskId));
  const movedIn = new Set((data.taskLog || []).filter(e => e.kind === 'postponed' && e.to === todayKey).flatMap(e => [e.taskId, e.newTaskId || '']));
  const fresh = now.filter(t => !planned.has(t.id) && !logged.has(t.id) && !movedIn.has(t.id));
  if (!fresh.length) return data;
  const at = new Date().toISOString();
  return {
    ...data,
    daySnapshots: { ...snaps, [todayKey]: [...snaps[todayKey], ...fresh.map(t => t.id)] },
    taskLog: [...(data.taskLog || []), ...fresh.map(t => ({ id: generateId(), kind: 'unplanned' as const, taskId: t.id, taskTitle: t.title, date: todayKey, at }))],
  };
}

/** La tâche a-t-elle été ajoutée en imprévu ce jour-là ? */
export const isUnplanned = (data: AppData, taskId: string, k: string) =>
  (data.taskLog || []).some(e => e.kind === 'unplanned' && e.taskId === taskId && e.date === k);

// ---------- Durées ----------

/** « 1h30 », « 1 h 30 », « 5h », « 45 », « 45 min », « 1:30 », « 1,5 h » → minutes (null si illisible) */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, '').replace(',', '.').replace(/['’]/g, '');
  if (!s) return null;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{1,2}):(\d{1,2})$/))) return +m[1] * 60 + +m[2];
  if ((m = s.match(/^(\d+(?:\.\d+)?)h(?:(\d{1,2})(?:m|min|mn)?)?$/))) return Math.round(parseFloat(m[1]) * 60) + (m[2] ? +m[2] : 0);
  if ((m = s.match(/^(\d+)(?:m|min|mn|minutes?)?$/))) return +m[1];
  return null;
}

/** 90 → « 1 h 30 », 300 → « 5 h », 45 → « 45 min » */
export function fmtDuration(min?: number | null): string {
  if (!min || min <= 0) return '';
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}
