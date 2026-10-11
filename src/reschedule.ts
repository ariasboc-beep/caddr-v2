// Déplacer / ajouter des tâches d'un jour à l'autre en respectant le modèle de Caddr :
// - le plan (appData.blocks) s'applique à tous les jours non « figés » ;
// - un jour figé (appData.days[k].blocks) a sa propre copie des blocs, prioritaire.
// Ces fonctions sont pures : elles reçoivent l'état et renvoient le nouvel état.
import { AppData, Block, Task, RecurrenceType } from './types';
import { getKeyFromDate, generateId, isDateInRange } from './utils';

const atNoon = (k: string) => new Date(k + 'T12:00:00');
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const visibleOn = (x: { recurrence: RecurrenceType; specificDate?: string; startDate?: string; endDate?: string; stopDate?: string }, k: string) =>
  isDateInRange(atNoon(k), x.recurrence, x.specificDate, x.startDate, x.endDate, x.stopDate);

export interface Found { task: Task; block: Block; inPlan: boolean }

export function findTask(data: AppData, taskId: string, preferDay?: string): Found | null {
  for (const b of data.blocks) { const t = b.tasks.find(t => t.id === taskId); if (t) return { task: t, block: b, inPlan: true }; }
  const keys = preferDay ? [preferDay, ...Object.keys(data.days)] : Object.keys(data.days);
  for (const k of keys) {
    for (const b of data.days[k]?.blocks || []) { const t = b.tasks.find(t => t.id === taskId); if (t) return { task: t, block: b, inPlan: false }; }
  }
  return null;
}

// Une tâche « ponctuelle » vit un seul jour : date précise, ou ajoutée dans un jour figé seulement.
export const isOneOff = (f: Found) => f.task.recurrence === 'specific' || f.task.recurrence === 'once' || !f.inPlan;

// Insère une tâche dans le jour k : bloc demandé (id ou même titre) s'il existe ce jour-là,
// sinon (si aucun bloc n'est demandé) le premier bloc du jour ; à défaut, un bloc
// du même nom créé pour ce jour seulement.
export function insertOnDay(data: AppData, task: Task, k: string, pref?: { id?: string; title?: string }): AppData {
  const days = { ...data.days };
  let blocks = data.blocks;
  const frozen = days[k]?.blocks;
  const pick = (list: Block[]) => {
    const vis = list.filter(b => visibleOn(b, k));
    return vis.find(b => b.id === pref?.id) || vis.find(b => pref?.title && b.title === pref.title) || (pref?.id || pref?.title ? undefined : vis[0]);
  };
  if (frozen) {
    if (frozen.some(b => b.tasks.some(t => t.id === task.id))) return data;
    const target = pick(frozen);
    if (target) days[k] = { ...days[k], blocks: frozen.map(b => b === target ? { ...b, tasks: [...b.tasks, clone(task)] } : b) };
    else days[k] = { ...days[k], blocks: [...frozen, newDayBlock(pref?.title, k, task)] };
    return { ...data, days };
  }
  const target = pick(blocks);
  if (target) blocks = blocks.map(b => b === target ? { ...b, tasks: [...b.tasks.filter(t => t.id !== task.id), task] } : b);
  else blocks = [...blocks, newDayBlock(pref?.title, k, task)];
  return { ...data, blocks };
}

const newDayBlock = (title: string | undefined, k: string, task: Task): Block => ({
  id: generateId(), title: title || 'Tâches du jour', description: 'Ajouté pour ce jour uniquement',
  tasks: [clone(task)], recurrence: 'specific', specificDate: k, isCollapsed: false,
});

/**
 * Déplace une tâche vers le jour `targetKey` (et éventuellement une heure).
 * - Tâche récurrente : seule l'heure change (elle apparaît déjà chaque jour prévu).
 * - Tâche ponctuelle : elle quitte son ancien jour et apparaît le jour cible,
 *   dans le même bloc s'il existe ce jour-là (sinon un bloc du même nom pour ce jour).
 */
export function relocateTask(data: AppData, taskId: string, targetKey: string, startTime?: string | null, todayKey = getKeyFromDate(new Date())): AppData {
  const f = findTask(data, taskId);
  if (!f) return data;
  const timePatch = startTime === undefined ? {} : startTime === null ? { startTime: undefined } : { startTime };
  if (!isOneOff(f)) {
    if (startTime === undefined) return data;
    const upd = (bs: Block[]) => bs.map(b => b.tasks.some(t => t.id === taskId) ? { ...b, tasks: b.tasks.map(t => t.id === taskId ? { ...t, ...timePatch } : t) } : b);
    const days = { ...data.days };
    Object.keys(days).forEach(k => { const d = days[k]; if (d?.blocks && k >= todayKey) days[k] = { ...d, blocks: upd(d.blocks) }; });
    return { ...data, blocks: upd(data.blocks), days };
  }
  const moved: Task = { ...f.task, ...timePatch, recurrence: f.task.recurrence === 'once' ? 'once' : 'specific', specificDate: targetKey, startDate: undefined, endDate: undefined, stopDate: undefined };
  // 1. Retirer la tâche de partout (plan + jours figés)
  const strip = (bs: Block[]) => bs.map(b => b.tasks.some(t => t.id === taskId) ? { ...b, tasks: b.tasks.filter(t => t.id !== taskId) } : b);
  const days = { ...data.days };
  Object.keys(days).forEach(k => { const d = days[k]; if (d?.blocks?.some(b => b.tasks.some(t => t.id === taskId))) days[k] = { ...d, blocks: strip(d.blocks) }; });
  let next: AppData = { ...data, blocks: strip(data.blocks), days };
  // 2. L'ajouter au jour cible
  next = insertOnDay(next, moved, targetKey, { id: f.block.id, title: f.block.title });
  // 3. Si le jour cible n'est pas figé, la tâche vit dans le plan : il faut aussi la
  //    placer dans les jours figés couvrant ce jour (déjà fait par insertOnDay le cas échéant).
  return next;
}

/** Ajoute une nouvelle tâche ponctuelle le jour `k`, dans le bloc `blockId` si possible. */
export function addOneOff(data: AppData, task: Omit<Task, 'recurrence' | 'specificDate'> & Partial<Task>, k: string, blockId?: string): AppData {
  const t: Task = { completedDates: [], subTasks: [], ...task, recurrence: 'specific', specificDate: k, startDate: undefined, endDate: undefined, stopDate: undefined, doneAt: undefined } as Task;
  const title = blockId ? (data.blocks.find(b => b.id === blockId) || data.days[k]?.blocks?.find(b => b.id === blockId))?.title : undefined;
  return insertOnDay(data, t, k, blockId ? { id: blockId, title } : undefined);
}

/** Renvoie une tâche ponctuelle dans la Boîte de tâches (elle quitte la Routine). */
export function sendToInbox(data: AppData, taskId: string): AppData {
  const f = findTask(data, taskId);
  if (!f) return data;
  const strip = (bs: Block[]) => bs.map(b => b.tasks.some(t => t.id === taskId) ? { ...b, tasks: b.tasks.filter(t => t.id !== taskId) } : b);
  const days = { ...data.days };
  Object.keys(days).forEach(k => { const d = days[k]; if (d?.blocks?.some(b => b.tasks.some(t => t.id === taskId))) days[k] = { ...d, blocks: strip(d.blocks) }; });
  const inboxTask: Task = { ...clone(f.task), recurrence: 'once', specificDate: undefined, startTime: undefined, completedDates: [] };
  return { ...data, blocks: strip(data.blocks), days, inboxTasks: [inboxTask, ...(data.inboxTasks || [])] };
}

export interface Pending { task: Task; blockId: string; blockTitle: string; date: string }

/** Tâches ponctuelles non faites entre `from` et `to` (inclus), hors tâches sautées. */
export function pendingOneOffs(data: AppData, from: string, to: string): Pending[] {
  const out: Pending[] = [];
  const skipped = new Set((data.skips || []).map(s => `${s.taskId}|${s.date}`));
  const planIds = new Set<string>(); data.blocks.forEach(b => b.tasks.forEach(t => planIds.add(t.id)));
  const seen = new Set<string>();
  for (let d = atNoon(from); getKeyFromDate(d) <= to; d.setDate(d.getDate() + 1)) {
    const k = getKeyFromDate(d);
    const src = data.days[k]?.blocks || data.blocks;
    src.filter(b => visibleOn(b, k)).forEach(b => b.tasks.filter(t => visibleOn(t, k)).forEach(t => {
      const oneOff = t.recurrence === 'specific' || t.recurrence === 'once' || !planIds.has(t.id);
      if (!oneOff || seen.has(t.id) || t.completedDates?.includes(k) || skipped.has(`${t.id}|${k}`)) return;
      seen.add(t.id);
      out.push({ task: t, blockId: b.id, blockTitle: b.title, date: k });
    }));
  }
  return out;
}
