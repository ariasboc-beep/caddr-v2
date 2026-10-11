// Exécution locale des outils de l'assistant + contexte envoyé à chaque message.
// Toutes les fonctions sont pures : (données) → (nouvelles données, résultat).
import type { AppData, Block, Task, RecurrenceType, StandaloneHabit, TabType, RecurringGoal, JournalEntry } from '../types';
import { getKeyFromDate, generateId, isDateInRange } from '../utils';
import { resolveDay, computePeriod, getPeriod, perfectStreak, computeDay } from '../analytics';
import { relocateTask, addOneOff, insertOnDay, findTask } from '../reschedule';
import { activeHabits, stateOn } from '../habits';
import { filled } from '../journal';
import type { Occurrence } from '../icsImport';

export interface ToolCtx { now: Date; navigate?: (tab: TabType) => void; externalEvents?: (from: Date, to: Date) => Occurrence[] }
export interface ToolOutcome { data: AppData; result: unknown; summary?: string; changed: boolean }

const atNoon = (k: string) => new Date(k + 'T12:00:00');
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const validDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const validTime = (s?: string) => !!s && /^\d{1,2}:\d{2}$/.test(s);
const hhmm = (s?: string) => validTime(s) ? s!.padStart(5, '0') : undefined;
const vis = (x: { recurrence: RecurrenceType; specificDate?: string; startDate?: string; endDate?: string; stopDate?: string }, k: string) =>
  isDateInRange(atNoon(k), x.recurrence, x.specificDate, x.startDate, x.endDate, x.stopDate);
const fmtDay = (k: string) => atNoon(k).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const addDays = (k: string, n: number) => { const d = atNoon(k); d.setDate(d.getDate() + n); return getKeyFromDate(d); };
const RECUR_LABEL: Record<string, string> = { daily: 'chaque jour', weekdays: 'en semaine', weekends: 'le week-end', weekly: 'chaque semaine', period: 'sur une période', week: 'cette semaine', month: 'ce mois', specific: 'un jour', once: 'un jour' };
const matchBlock = (list: Block[], title?: string) => {
  if (!title) return undefined;
  const t = norm(title);
  return list.find(b => norm(b.title) === t) || list.find(b => norm(b.title).includes(t) || t.includes(norm(b.title)));
};

/** Applique un patch à une tâche partout où elle existe (plan + jours figés à partir d'aujourd'hui) */
function patchTask(data: AppData, id: string, patch: Partial<Task>, todayKey: string): AppData {
  const upd = (bs: Block[]) => bs.map(b => b.tasks.some(t => t.id === id) ? { ...b, tasks: b.tasks.map(t => t.id === id ? { ...t, ...patch } : t) } : b);
  const days = { ...data.days };
  Object.keys(days).forEach(k => { const d = days[k]; if (d?.blocks?.some(b => b.tasks.some(t => t.id === id)) && (k >= todayKey || !data.blocks.some(b => b.tasks.some(t => t.id === id)))) days[k] = { ...d, blocks: upd(d.blocks) }; });
  return { ...data, blocks: upd(data.blocks), days };
}

function addRecurring(data: AppData, blockTitle: string | undefined, task: Task, todayKey: string): { data: AppData; blockTitle: string } {
  let blocks = [...data.blocks];
  let block = matchBlock(blocks.filter(b => b.recurrence !== 'specific' && b.recurrence !== 'once'), blockTitle);
  if (!block) {
    block = { id: generateId(), title: blockTitle?.trim() || 'Tâches', recurrence: 'daily', tasks: [], isCollapsed: false };
    blocks.push(block);
  }
  const bid = block.id;
  blocks = blocks.map(b => b.id === bid ? { ...b, tasks: [...b.tasks, task] } : b);
  const days = { ...data.days };
  Object.keys(days).forEach(k => {
    const d = days[k];
    if (!d?.blocks || k < todayKey || !vis(task, k)) return;
    if (d.blocks.some(b => b.id === bid)) days[k] = { ...d, blocks: d.blocks.map(b => b.id === bid ? { ...b, tasks: [...b.tasks, clone(task)] } : b) };
    else if (vis(block!, k)) days[k] = { ...d, blocks: [...d.blocks, { ...clone({ ...block!, tasks: [] }), tasks: [clone(task)] }] };
  });
  return { data: { ...data, blocks, days }, blockTitle: block.title };
}

// ---------------------------------------------------------------------------
export function executeTool(data: AppData, name: string, input: Record<string, any>, ctx: ToolCtx): ToolOutcome {
  const todayKey = getKeyFromDate(ctx.now);
  const ok = (d: AppData, result: unknown, summary: string): ToolOutcome => ({ data: d, result, summary, changed: true });
  const read = (result: unknown): ToolOutcome => ({ data, result, changed: false });
  const fail = (error: string): ToolOutcome => ({ data, result: { error }, changed: false });

  const createTask = (): ToolOutcome => {
      if (!input.title?.trim()) return fail('Titre manquant.');
      const rec: string = input.recurrence || 'once';
      const date = validDate(input.date) ? input.date : todayKey;
      const base: Task = {
        id: generateId(), title: input.title.trim(), completedDates: [], subTasks: [], recurrence: 'specific',
        startTime: hhmm(input.start_time), duration: input.duration ? Math.max(5, Math.min(720, Math.round(input.duration))) : undefined,
        priority: ['low', 'medium', 'high'].includes(input.priority) ? input.priority : undefined,
        description: input.notes || undefined, isHabit: input.is_habit || undefined,
      };
      if (rec === 'once') {
        const day = resolveDay(data, atNoon(date));
        const b = matchBlock(day, input.block);
        const d = b ? insertOnDay(data, { ...base, specificDate: date }, date, { id: b.id, title: b.title }) : (input.block ? insertOnDay(data, { ...base, specificDate: date }, date, { title: input.block }) : addOneOff(data, base, date));
        const placed = resolveDay(d, atNoon(date)).find(bb => bb.tasks.some(t => t.id === base.id));
        return ok(d, { task_id: base.id, date, block: placed?.title }, `Tâche « ${base.title} » ajoutée le ${fmtDay(date)}${base.startTime ? ` à ${base.startTime}` : ''}${placed ? ` (${placed.title})` : ''}`);
      }
      const task: Task = { ...base, recurrence: rec as RecurrenceType };
      if (rec === 'weekly') task.specificDate = date;
      if (rec === 'period') {
        if (!validDate(input.start_date) || !validDate(input.end_date)) return fail('start_date et end_date requis pour une période.');
        task.startDate = input.start_date; task.endDate = input.end_date;
      } else if (validDate(input.start_date)) task.startDate = input.start_date;
      const r = addRecurring(data, input.block, task, todayKey);
      return ok(r.data, { task_id: task.id, block: r.blockTitle, recurrence: rec }, `Tâche « ${task.title} » ajoutée ${RECUR_LABEL[rec] || ''}${task.startTime ? ` à ${task.startTime}` : ''} (${r.blockTitle})`);
    };

  switch (name) {
    case 'create_task': {
      const linkGoal = (o: ToolOutcome): ToolOutcome => {
        const tid = (o.result as any)?.task_id; const gid = input.goal_id;
        if (!tid || !gid || !(o.data.longTermGoals || []).some(g => g.id === gid)) return o;
        return { ...o, data: { ...o.data, longTermGoals: (o.data.longTermGoals || []).map(g => g.id === gid ? { ...g, linkedTasks: [...(g.linkedTasks || []), tid], autoProgress: true } : g) } };
      };
      return linkGoal(createTask());
    }
    case 'update_task': {
      const f = findTask(data, input.task_id);
      if (!f) return fail('Tâche introuvable.');
      const patch: Partial<Task> = {};
      if (input.title) patch.title = input.title;
      if (input.start_time !== undefined) patch.startTime = input.start_time === '' ? undefined : hhmm(input.start_time);
      if (input.duration) patch.duration = Math.max(5, Math.min(720, Math.round(input.duration)));
      if (input.priority) patch.priority = input.priority;
      if (input.notes !== undefined) patch.description = input.notes;
      if (input.is_habit !== undefined) patch.isHabit = input.is_habit;
      return ok(patchTask(data, f.task.id, patch, todayKey), { ok: true }, `« ${patch.title || f.task.title} » modifiée`);
    }

    case 'reschedule_task': {
      const f = findTask(data, input.task_id);
      if (!f || !validDate(input.date)) return fail('Tâche ou date invalide.');
      const d = relocateTask(data, f.task.id, input.date, hhmm(input.start_time), todayKey);
      return ok(d, { ok: true }, `« ${f.task.title} » déplacée au ${fmtDay(input.date)}${input.start_time ? ` à ${hhmm(input.start_time)}` : ''}`);
    }

    case 'set_task_done': {
      const f = findTask(data, input.task_id);
      if (!f) return fail('Tâche introuvable.');
      const k = validDate(input.date) ? input.date : todayKey;
      const flip = (t: Task): Task => {
        const has = (t.completedDates || []).includes(k);
        if (has === !!input.done) return t;
        const completedDates = input.done ? [...(t.completedDates || []), k] : (t.completedDates || []).filter(x => x !== k);
        const at = { ...(t.completedAt || {}) };
        if (input.done && k === todayKey) at[k] = `${String(ctx.now.getHours()).padStart(2, '0')}:${String(ctx.now.getMinutes()).padStart(2, '0')}`; else delete at[k];
        return { ...t, completedDates, completedAt: Object.keys(at).length ? at : undefined };
      };
      const upd = (bs: Block[]) => bs.map(b => ({ ...b, tasks: b.tasks.map(t => t.id === f.task.id ? flip(t) : t) }));
      const days = { ...data.days };
      if (days[k]?.blocks) days[k] = { ...days[k], blocks: upd(days[k].blocks!) };
      const d = { ...data, blocks: days[k]?.blocks ? data.blocks : upd(data.blocks), days };
      return ok(d, { ok: true }, `« ${f.task.title} » ${input.done ? 'cochée' : 'décochée'}${k !== todayKey ? ` (${fmtDay(k)})` : ''}`);
    }

    case 'skip_task': {
      const f = findTask(data, input.task_id);
      if (!f) return fail('Tâche introuvable.');
      const k = validDate(input.date) ? input.date : todayKey;
      return ok({ ...data, skips: [...(data.skips || []), { id: generateId(), taskId: f.task.id, taskTitle: f.task.title, date: k, reason: input.reason || 'Choix' }] }, { ok: true }, `« ${f.task.title} » sautée (${fmtDay(k)})`);
    }

    case 'remove_task': {
      const f = findTask(data, input.task_id);
      if (!f) return fail('Tâche introuvable.');
      const oneOff = f.task.recurrence === 'specific' || f.task.recurrence === 'once' || !f.inPlan;
      if (oneOff) {
        const strip = (bs: Block[]) => bs.map(b => ({ ...b, tasks: b.tasks.filter(t => t.id !== f.task.id) }));
        const days = { ...data.days };
        Object.keys(days).forEach(k => { if (days[k]?.blocks) days[k] = { ...days[k], blocks: strip(days[k].blocks!) }; });
        return ok({ ...data, blocks: strip(data.blocks), days }, { removed: true }, `« ${f.task.title} » supprimée`);
      }
      const d = patchTask(data, f.task.id, { stopDate: addDays(todayKey, -1) }, todayKey);
      return ok(d, { stopped: true }, `Récurrence de « ${f.task.title} » arrêtée (historique conservé)`);
    }

    case 'create_habit': {
      if (!input.name?.trim()) return fail('Nom manquant.');
      const h: StandaloneHabit = {
        id: generateId(), name: input.name.trim(), kind: input.kind === 'quit' ? 'quit' : 'build',
        days: Array.isArray(input.days) ? input.days.filter((x: number) => x >= 0 && x <= 6) : [], startDate: todayKey,
        description: input.description || undefined, createdAt: new Date().toISOString(), showInRoutine: input.show_in_routine !== false, entries: {},
      };
      return ok({ ...data, habits: [...(data.habits || []), h] }, { habit_id: h.id }, `Habitude « ${h.name} » créée`);
    }

    case 'log_habit': {
      const h = (data.habits || []).find(x => x.id === input.habit_id && !x.deleted);
      if (!h) return fail('Habitude introuvable.');
      const k = validDate(input.date) ? input.date : todayKey;
      const e = { ...(h.entries[k] || {}) };
      if (input.status === 'clear') delete e.s; else e.s = input.status;
      if (input.note) e.note = `${e.note || ''}<p>${String(input.note).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!))}</p>`;
      const entries = { ...h.entries, [k]: e };
      const label = input.status === 'done' ? 'réussie' : input.status === 'fail' ? 'ratée' : input.status === 'skip' ? 'exemptée' : 'effacée';
      return ok({ ...data, habits: (data.habits || []).map(x => x.id === h.id ? { ...x, entries } : x) }, { ok: true }, `« ${h.name} » ${label} (${fmtDay(k)})`);
    }

    case 'add_to_inbox': {
      if (!input.title?.trim()) return fail('Titre manquant.');
      const t: Task = { id: generateId(), title: input.title.trim(), completedDates: [], recurrence: 'once', subTasks: [], description: input.notes || undefined, deadline: validDate(input.deadline) ? input.deadline : undefined };
      return ok({ ...data, inboxTasks: [t, ...(data.inboxTasks || [])] }, { inbox_id: t.id }, `« ${t.title} » ajoutée à la Boîte`);
    }

    case 'set_objective': {
      const k = validDate(input.date) ? input.date : todayKey;
      if (!input.title?.trim()) return fail('Objectif manquant.');
      if (input.scope === 'week') {
        const m = atNoon(k); m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
        const s = getKeyFromDate(m), e = addDays(s, 6);
        let goals = [...(data.recurringGoals || [])];
        const i = goals.findIndex(g => g.recurrence === 'week' && g.startDate === s);
        const g: RecurringGoal = { id: i >= 0 ? goals[i].id : generateId(), title: input.title.trim(), recurrence: 'week', startDate: s, endDate: e };
        if (i >= 0) goals[i] = g; else goals = [g, ...goals];
        return ok({ ...data, recurringGoals: goals }, { ok: true }, `Objectif de la semaine : « ${g.title} »`);
      }
      const day = data.days[k] || { goalCompleted: false, note: '' };
      return ok({ ...data, days: { ...data.days, [k]: { ...day, dailyGoalOverride: input.title.trim() } } }, { ok: true }, `Objectif du ${fmtDay(k)} : « ${input.title.trim()} »`);
    }

    case 'create_goal': {
      if (!input.title?.trim()) return fail('Titre manquant.');
      const titles = new Set(data.blocks.map(b => b.title));
      const linked = (input.linked_blocks || []).map((t: string) => matchBlock(data.blocks, t)?.title).filter((t: string | undefined): t is string => !!t && titles.has(t));
      const g = { id: generateId(), title: input.title.trim(), progress: 0, createdAt: new Date().toISOString(), targetDate: validDate(input.target_date) ? input.target_date : undefined, linkedBlocks: linked.length ? linked : undefined, autoProgress: linked.length ? true : undefined };
      return ok({ ...data, longTermGoals: [...(data.longTermGoals || []), g] }, { goal_id: g.id }, `Objectif long terme « ${g.title} » créé${linked.length ? ` (relié à ${linked.join(', ')})` : ''}`);
    }

    case 'create_block': {
      if (!input.title?.trim()) return fail('Titre manquant.');
      const rec = input.recurrence || 'daily';
      const k = validDate(input.date) ? input.date : todayKey;
      const b: Block = { id: generateId(), title: input.title.trim(), tasks: [], isCollapsed: false, recurrence: rec === 'once' ? 'specific' : rec, specificDate: rec === 'once' ? k : undefined };
      const days = { ...data.days };
      Object.keys(days).forEach(key => { const d = days[key]; if (d?.blocks && key >= todayKey && vis(b, key)) days[key] = { ...d, blocks: [...d.blocks, clone(b)] }; });
      return ok({ ...data, blocks: [...data.blocks, b], days }, { block_id: b.id }, `Bloc « ${b.title} » créé`);
    }

    case 'write_journal': {
      const k = validDate(input.date) ? input.date : todayKey;
      const cur: JournalEntry = data.journal?.[k] || { gratitude: ['', '', ''], pride: ['', '', ''], updatedAt: '' };
      const merge = (xs: string[], add?: string[]) => { const out = [0, 1, 2].map(i => xs?.[i] || ''); (add || []).forEach(a => { const i = out.findIndex(x => !x.trim()); if (i >= 0) out[i] = a; else out.push(a); }); return out; };
      const entry: JournalEntry = { ...cur, gratitude: merge(cur.gratitude, input.gratitude), pride: merge(cur.pride, input.pride), note: input.note ? [cur.note, input.note].filter(Boolean).join(' ') : cur.note, updatedAt: new Date().toISOString() };
      return ok({ ...data, journal: { ...(data.journal || {}), [k]: entry } }, { ok: true }, `Journal du ${fmtDay(k)} complété`);
    }

    case 'add_milestones': {
      const g = (data.longTermGoals || []).find(x => x.id === input.goal_id);
      if (!g) return fail('Objectif introuvable.');
      const ms = (input.milestones || []).filter((m: any) => m?.title).map((m: any) => ({ id: generateId(), title: String(m.title).trim(), date: validDate(m.date) ? m.date : undefined }));
      if (!ms.length) return fail('Aucune étape.');
      const all = [...(g.milestones || []), ...ms].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
      return ok({ ...data, longTermGoals: (data.longTermGoals || []).map(x => x.id === g.id ? { ...x, milestones: all } : x) }, { milestones: ms.map((m: any) => ({ milestone_id: m.id, title: m.title })) }, `${ms.length} étape${ms.length > 1 ? 's' : ''} ajoutée${ms.length > 1 ? 's' : ''} à « ${g.title} »`);
    }

    case 'set_milestone_done': {
      const g = (data.longTermGoals || []).find(x => x.id === input.goal_id);
      const m = g?.milestones?.find(x => x.id === input.milestone_id);
      if (!g || !m) return fail('Étape introuvable.');
      return ok({ ...data, longTermGoals: (data.longTermGoals || []).map(x => x.id === g.id ? { ...x, milestones: (x.milestones || []).map(y => y.id === m.id ? { ...y, done: !!input.done } : y) } : x) }, { ok: true }, `Étape « ${m.title} » ${input.done ? 'atteinte' : 'rouverte'}`);
    }

    case 'remember': {
      const text = String(input.text || '').trim().slice(0, 200);
      if (!text) return fail('Rien à retenir.');
      const mem = (data.assistantMemory || []).filter(x => !x.deleted);
      if (mem.some(x => norm(x.text) === norm(text))) return read({ already: true });
      if (mem.length >= 40) return fail('Mémoire pleine (40 éléments) : demande à l’utilisateur ce qu’il faut oublier.');
      const item = { id: generateId(), text, createdAt: new Date().toISOString() };
      return ok({ ...data, assistantMemory: [...(data.assistantMemory || []), item] }, { memory_id: item.id }, `Retenu : « ${text} »`);
    }

    case 'forget': {
      const m = (data.assistantMemory || []).find(x => x.id === input.memory_id && !x.deleted);
      if (!m) return fail('Élément introuvable.');
      return ok({ ...data, assistantMemory: (data.assistantMemory || []).map(x => x.id === m.id ? { ...x, deleted: true } : x) }, { ok: true }, `Oublié : « ${m.text} »`);
    }

    case 'get_day': {
      if (!validDate(input.date)) return fail('Date invalide.');
      return read(dayDetail(data, input.date, todayKey, ctx));
    }

    case 'search': {
      const q = norm(input.query || '');
      if (!q) return fail('Requête vide.');
      const seen = new Set<string>(); const tasks: unknown[] = [];
      const scan = (bs: Block[], where: string) => bs.forEach(b => b.tasks.forEach(t => {
        if (seen.has(t.id) || !(norm(t.title).includes(q) || norm(b.title).includes(q))) return;
        seen.add(t.id); tasks.push({ task_id: t.id, title: t.title, block: b.title, recurrence: t.recurrence, date: t.specificDate, start_time: t.startTime, where });
      }));
      scan(data.blocks, 'plan');
      Object.keys(data.days).filter(k => k >= addDays(todayKey, -7)).sort().forEach(k => scan(data.days[k].blocks || [], k));
      return read({
        tasks: tasks.slice(0, 25),
        inbox: (data.inboxTasks || []).filter(t => norm(t.title).includes(q)).slice(0, 10).map(t => ({ inbox_id: t.id, title: t.title })),
        habits: activeHabits(data.habits).filter(h => norm(h.name).includes(q)).map(h => ({ habit_id: h.id, name: h.name, kind: h.kind })),
        goals: (data.longTermGoals || []).filter(g => norm(g.title).includes(q)).map(g => ({ goal_id: g.id, title: g.title })),
      });
    }

    case 'get_stats': {
      const now = ctx.now;
      const anchor = input.period === 'last_week' ? new Date(now.getTime() - 7 * 86400000) : input.period === 'last_month' ? new Date(now.getFullYear(), now.getMonth() - 1, 15) : now;
      const tf = input.period?.includes('week') ? 'week' : input.period === 'year' ? 'year' : 'month';
      const p = getPeriod(tf, anchor);
      const st = computePeriod(data, p.start, p.end, todayKey);
      const blocks: Record<string, { faites: number; prevues: number }> = {};
      st.days.forEach(d => d.blocks.forEach(b => { blocks[b.title] = blocks[b.title] || { faites: 0, prevues: 0 }; blocks[b.title].faites += b.done; blocks[b.title].prevues += b.total; }));
      const streak = perfectStreak(data, todayKey);
      return read({
        periode: p.label, taux: st.rate, faites: st.done, prevues: st.total, jours_parfaits: st.perfectDays, serie_actuelle: streak.current, meilleure_serie: streak.best,
        par_bloc: Object.entries(blocks).map(([bloc, v]) => ({ bloc, ...v, taux: v.prevues ? Math.round(v.faites / v.prevues * 100) : null })),
        par_jour: tf === 'year' ? undefined : st.days.map(d => ({ date: d.date, taux: d.future ? 'à venir' : d.rate })),
      });
    }

    case 'open_tab': {
      ctx.navigate?.(input.tab as TabType);
      return { data, result: { ok: true }, changed: false, summary: undefined };
    }
  }
  return fail(`Outil inconnu : ${name}`);
}

// ---------------------------------------------------------------------------
function dayDetail(data: AppData, k: string, todayKey: string, ctx: ToolCtx) {
  const d = atNoon(k);
  const skipped = new Set((data.skips || []).filter(s => s.date === k).map(s => s.taskId));
  const from = new Date(d); from.setHours(0, 0, 0, 0); const to = new Date(from); to.setDate(from.getDate() + 1);
  const ev = ctx.externalEvents?.(from, to) || [];
  return {
    date: k, jour: fmtDay(k),
    objectif: data.days[k]?.dailyGoalOverride || (data.recurringGoals || []).find(g => vis(g, k))?.title || null,
    blocs: resolveDay(data, d).map(b => ({
      bloc: b.title, block_id: b.id,
      taches: b.tasks.filter(t => vis(t, k)).map(t => ({ task_id: t.id, titre: t.title, heure: t.startTime || null, duree: t.duration || null, priorite: t.priority || null, recurrence: t.recurrence, faite: !!t.completedDates?.includes(k), sautee: skipped.has(t.id) || undefined })),
    })),
    habitudes: activeHabits(data.habits).map(h => ({ habit_id: h.id, nom: h.name, type: h.kind, etat: stateOn(h, k, todayKey) })),
    rendez_vous: ev.map(o => ({ titre: o.title, debut: o.allDay ? 'journée' : `${String(o.start.getHours()).padStart(2, '0')}:${String(o.start.getMinutes()).padStart(2, '0')}`, fin: o.allDay ? null : `${String(o.end.getHours()).padStart(2, '0')}:${String(o.end.getMinutes()).padStart(2, '0')}`, agenda: o.calendarName })),
  };
}

/** Contexte compact envoyé à Claude à chaque message (l'état actuel de l'app) */
export function buildContext(data: AppData, ctx: ToolCtx, userName?: string): string {
  const todayKey = getKeyFromDate(ctx.now);
  const t = ctx.now;
  const lines: string[] = [];
  lines.push(`Maintenant : ${fmtDay(todayKey)} ${t.getFullYear()}, ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')} (date ISO ${todayKey}).`);
  if (userName) lines.push(`Prénom de l'utilisateur : ${userName}.`);
  const today = dayDetail(data, todayKey, todayKey, ctx);
  lines.push(`\nAUJOURD'HUI : ${JSON.stringify({ objectif: today.objectif, blocs: today.blocs, rendez_vous: today.rendez_vous })}`);
  // 6 jours suivants : tâches ponctuelles et rendez-vous
  const next: unknown[] = [];
  for (let i = 1; i <= 6; i++) {
    const k = addDays(todayKey, i); const dd = dayDetail(data, k, todayKey, ctx);
    const planIds = new Set(data.blocks.flatMap(b => b.tasks.filter(x => x.recurrence !== 'specific' && x.recurrence !== 'once').map(x => x.id)));
    const oneOffs = dd.blocs.flatMap(b => b.taches.filter(x => !planIds.has(x.task_id)).map(x => ({ ...x, bloc: b.bloc })));
    const total = dd.blocs.reduce((s, b) => s + b.taches.length, 0);
    next.push({ date: k, jour: dd.jour, nb_taches: total, ponctuelles: oneOffs, rendez_vous: dd.rendez_vous.length ? dd.rendez_vous : undefined, objectif: dd.objectif || undefined });
  }
  lines.push(`\nPROCHAINS JOURS : ${JSON.stringify(next)}`);
  lines.push(`\nPLAN (blocs récurrents) : ${JSON.stringify(data.blocks.filter(b => b.recurrence !== 'specific' && b.recurrence !== 'once').map(b => ({ bloc: b.title, recurrence: b.recurrence, taches: b.tasks.filter(x => !x.stopDate || x.stopDate >= todayKey).map(x => ({ task_id: x.id, titre: x.title, recurrence: x.recurrence, heure: x.startTime, duree: x.duration })) })))}`);
  const inbox = (data.inboxTasks || []).filter(x => !x.doneAt);
  if (inbox.length) lines.push(`\nBOÎTE DE TÂCHES (${inbox.length}) : ${JSON.stringify(inbox.slice(0, 30).map(x => ({ inbox_id: x.id, titre: x.title, echeance: x.deadline })))}`);
  const habits = activeHabits(data.habits);
  if (habits.length) lines.push(`\nHABITUDES : ${JSON.stringify(habits.map(h => ({ habit_id: h.id, nom: h.name, type: h.kind, aujourdhui: stateOn(h, todayKey, todayKey) })))}`);
  if (data.longTermGoals?.length) lines.push(`\nOBJECTIFS LONG TERME : ${JSON.stringify(data.longTermGoals.map(g => ({ goal_id: g.id, titre: g.title, echeance: g.targetDate, progression_manuelle: g.autoProgress ? undefined : g.progress, blocs_relies: g.linkedBlocks, nb_taches_reliees: g.linkedTasks?.length, etapes: g.milestones?.map(m => ({ milestone_id: m.id, titre: m.title, date: m.date, atteinte: !!m.done })) })))}`);
  const mem = (data.assistantMemory || []).filter(x => !x.deleted);
  lines.push(`\nMÉMOIRE (préférences durables à respecter) : ${mem.length ? JSON.stringify(mem.map(m => ({ memory_id: m.id, texte: m.text }))) : 'aucune pour l’instant'}`);
  const lr = Object.values(data.lifeReviews || {}).sort((a, b) => b.quarter.localeCompare(a.quarter))[0];
  if (lr) lines.push(`\nROUE DE LA VIE (${lr.quarter}, notes sur 10) : ${JSON.stringify(lr.scores)}${lr.focus?.length ? ` · priorités du trimestre : ${lr.focus.join(', ')}` : ''}`);
  const w = getPeriod('week', ctx.now), m = getPeriod('month', ctx.now);
  const ws = computePeriod(data, w.start, w.end, todayKey), ms = computePeriod(data, m.start, m.end, todayKey);
  const j = data.journal?.[todayKey];
  lines.push(`\nSTATS : semaine ${ws.rate ?? '—'} % (${ws.done}/${ws.total}), mois ${ms.rate ?? '—'} %, aujourd'hui ${computeDay(data, todayKey, todayKey).rate ?? '—'} %. Journal du jour : ${j ? `${filled(j.gratitude).length} gratitude(s), ${filled(j.pride).length} fierté(s)` : 'vide'}.`);
  return lines.join('\n').slice(0, 24000);
}
