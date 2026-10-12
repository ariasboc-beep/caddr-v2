// Projets : ce que l'utilisateur construit, entre l'objectif de vie (le cap) et
// la tâche du jour (le geste). Un projet porte des étapes, chaque étape des tâches.
// Une tâche de projet se « pose » dans la routine d'un jour : la cocher dans la
// journée la coche dans le projet, et la progression remonte jusqu'à l'objectif de vie.
import type { AppData, Project, ProjectTask, ProjectStep, ProjectStatus, Task, PriorityType } from './types';
import { generateId, getKeyFromDate } from './utils';

export const PROJECT_STATUS: { id: ProjectStatus; label: string; hint: string }[] = [
  { id: 'active', label: 'En cours', hint: 'Projet actif, il avance' },
  { id: 'paused', label: 'En pause', hint: 'Mis de côté sans être abandonné' },
  { id: 'done', label: 'Terminé', hint: 'Objectif du projet atteint' },
  { id: 'dropped', label: 'Abandonné', hint: 'Choisi de ne pas le poursuivre' },
];

// ---------- Lecture ----------
export const allProjects = (d?: AppData): Project[] => (d?.projects || []).filter(p => !p.deleted);
export const liveProjects = (d?: AppData): Project[] => allProjects(d).filter(p => p.status === 'active' || p.status === 'paused');
export const activeProjects = (d?: AppData): Project[] => allProjects(d).filter(p => p.status === 'active');
export const findProject = (d: AppData, id: string): Project | undefined => allProjects(d).find(p => p.id === id);

export const openTasks = (p: Project): ProjectTask[] => p.tasks.filter(t => !t.done);
export const stepTasks = (p: Project, stepId?: string): ProjectTask[] =>
  p.tasks.filter(t => (t.stepId || '') === (stepId || '')).sort((a, b) => a.order - b.order);

/** Tri d'une liste de tâches : échéance d'abord, puis priorité, puis ordre de saisie. */
const PRIO: Record<string, number> = { high: 0, medium: 1, low: 2 };
export const sortTasks = (list: ProjectTask[]): ProjectTask[] => [...list].sort((a, b) =>
  (a.due || '9999').localeCompare(b.due || '9999')
  || (PRIO[a.priority || 'medium'] ?? 1) - (PRIO[b.priority || 'medium'] ?? 1)
  || a.order - b.order);

export interface ProjectStats {
  total: number; done: number; pct: number;
  open: number; overdue: number; plannedToday: number;
  daysLeft: number | null;          // jours avant l'échéance du projet
  expected: number | null;          // part du chemin qui devrait être faite à cette date
  health: 'done' | 'late' | 'risk' | 'ok' | 'idle';
  next: ProjectTask | null;         // la prochaine action à faire
}

/** Chiffres d'un projet : avancement, retard, prochaine action. */
export function projectStats(p: Project, todayKey = getKeyFromDate(new Date())): ProjectStats {
  const total = p.tasks.length, done = p.tasks.filter(t => t.done).length;
  const pct = total ? Math.round((done / total) * 100) : (p.status === 'done' ? 100 : 0);
  const open = total - done;
  const overdue = p.tasks.filter(t => !t.done && t.due && t.due < todayKey).length;
  const plannedToday = p.tasks.filter(t => !t.done && t.plannedFor === todayKey).length;
  const daysLeft = p.dueDate ? Math.round((new Date(p.dueDate + 'T12:00:00').getTime() - new Date(todayKey + 'T12:00:00').getTime()) / 86400000) : null;
  // Part attendue : où l'on devrait en être si l'on avançait régulièrement du début à l'échéance
  let expected: number | null = null;
  const startK = (p.startDate || p.createdAt.slice(0, 10));
  if (p.dueDate && p.dueDate > startK) {
    const span = new Date(p.dueDate + 'T12:00:00').getTime() - new Date(startK + 'T12:00:00').getTime();
    const gone = new Date(todayKey + 'T12:00:00').getTime() - new Date(startK + 'T12:00:00').getTime();
    expected = Math.max(0, Math.min(100, Math.round((gone / span) * 100)));
  }
  const health: ProjectStats['health'] =
    p.status === 'done' || (total > 0 && done === total) ? 'done'
    : daysLeft !== null && daysLeft < 0 ? 'late'
    : expected !== null && pct + 15 < expected ? 'risk'
    : total === 0 ? 'idle' : 'ok';
  const next = sortTasks(openTasks(p))[0] || null;
  return { total, done, pct, open, overdue, plannedToday, daysLeft, expected, health, next };
}

export const HEALTH_LABEL: Record<ProjectStats['health'], string> = {
  done: 'Terminé', late: 'En retard', risk: 'À surveiller', ok: 'Sur la bonne voie', idle: 'À démarrer',
};

/** Toutes les tâches de projet ouvertes, à l'échelle de l'app (prochaines actions). */
export function allOpenTasks(d: AppData, todayKey = getKeyFromDate(new Date())): { project: Project; task: ProjectTask }[] {
  const out: { project: Project; task: ProjectTask }[] = [];
  activeProjects(d).forEach(p => sortTasks(openTasks(p)).forEach(task => out.push({ project: p, task })));
  return out.sort((a, b) =>
    (a.task.due || '9999').localeCompare(b.task.due || '9999')
    || (a.task.plannedFor === todayKey ? 0 : 1) - (b.task.plannedFor === todayKey ? 0 : 1));
}

/** Tâches de projet en retard ou dues dans les n jours (pour le briefing et Analytics). */
export function dueSoon(d: AppData, todayKey: string, days = 7): { project: Project; task: ProjectTask; late: boolean }[] {
  const end = getKeyFromDate(new Date(new Date(todayKey + 'T12:00:00').getTime() + days * 86400000));
  return allOpenTasks(d, todayKey)
    .filter(({ task }) => task.due && task.due <= end)
    .map(({ project, task }) => ({ project, task, late: !!task.due && task.due < todayKey }));
}

/** Projets reliés à un objectif de vie, et leur avancement moyen. */
export function goalProjects(d: AppData, goalId: string, todayKey = getKeyFromDate(new Date())) {
  const list = allProjects(d).filter(p => p.goalId === goalId && p.status !== 'dropped');
  const stats = list.map(p => ({ project: p, stats: projectStats(p, todayKey) }));
  const pct = stats.length ? Math.round(stats.reduce((s, x) => s + x.stats.pct, 0) / stats.length) : null;
  return { list: stats, pct };
}

/** Tâches de projet faites un jour donné (votes d'identité, Analytics). */
export const projectTasksDoneOn = (d: AppData, dateKey: string): { project: Project; task: ProjectTask }[] =>
  allProjects(d).flatMap(p => p.tasks.filter(t => t.done && (t.doneAt || '').slice(0, 10) === dateKey).map(task => ({ project: p, task })));

// ---------- Écriture ----------
const touch = (p: Project): Project => ({ ...p, updatedAt: new Date().toISOString() });
const put = (d: AppData, p: Project): AppData => ({ ...d, projects: (d.projects || []).map(x => x.id === p.id ? touch(p) : x) });

export function addProject(d: AppData, fields: Partial<Project> & { title: string }): { data: AppData; id: string } {
  const id = generateId();
  const p: Project = {
    id, title: fields.title.trim(), why: fields.why, color: fields.color,
    status: fields.status || 'active', createdAt: new Date().toISOString(),
    startDate: fields.startDate || getKeyFromDate(new Date()), dueDate: fields.dueDate,
    goalId: fields.goalId, identityId: fields.identityId,
    steps: fields.steps || [], tasks: fields.tasks || [],
  };
  return { data: { ...d, projects: [...(d.projects || []), p] }, id };
}

export const patchProject = (d: AppData, id: string, fields: Partial<Project>): AppData => {
  const p = findProject(d, id); if (!p) return d;
  const next = { ...p, ...fields };
  if (fields.status === 'done' && !p.completedAt) next.completedAt = new Date().toISOString();
  if (fields.status && fields.status !== 'done') next.completedAt = undefined;
  return put(d, next);
};

/** Suppression douce : une pierre tombale, pour que la fusion cloud ne la ressuscite pas. */
export const removeProject = (d: AppData, id: string): AppData => {
  const p = findProject(d, id); if (!p) return d;
  return put(d, { ...p, deleted: true });
};

export function addStep(d: AppData, projectId: string, title: string): AppData {
  const p = findProject(d, projectId); if (!p || !title.trim()) return d;
  const step: ProjectStep = { id: generateId(), title: title.trim(), order: p.steps.length };
  return put(d, { ...p, steps: [...p.steps, step] });
}

export const patchStep = (d: AppData, projectId: string, stepId: string, fields: Partial<ProjectStep>): AppData => {
  const p = findProject(d, projectId); if (!p) return d;
  return put(d, { ...p, steps: p.steps.map(s => s.id === stepId ? { ...s, ...fields } : s) });
};

/** Retire une étape : ses tâches restent, simplement détachées. */
export const removeStep = (d: AppData, projectId: string, stepId: string): AppData => {
  const p = findProject(d, projectId); if (!p) return d;
  return put(d, { ...p, steps: p.steps.filter(s => s.id !== stepId), tasks: p.tasks.map(t => t.stepId === stepId ? { ...t, stepId: undefined } : t) });
};

export function addProjectTask(d: AppData, projectId: string, fields: Partial<ProjectTask> & { title: string }): { data: AppData; id: string } {
  const p = findProject(d, projectId); if (!p) return { data: d, id: '' };
  const id = generateId();
  const task: ProjectTask = {
    id, title: fields.title.trim(), stepId: fields.stepId, note: fields.note,
    due: fields.due, estimateMin: fields.estimateMin, priority: fields.priority,
    createdAt: new Date().toISOString(), order: p.tasks.length,
  };
  return { data: put(d, { ...p, tasks: [...p.tasks, task] }), id };
}

export const patchProjectTask = (d: AppData, projectId: string, taskId: string, fields: Partial<ProjectTask>): AppData => {
  const p = findProject(d, projectId); if (!p) return d;
  return put(d, { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, ...fields } : t) });
};

export const removeProjectTask = (d: AppData, projectId: string, taskId: string): AppData => {
  const p = findProject(d, projectId); if (!p) return d;
  return put(d, { ...p, tasks: p.tasks.filter(t => t.id !== taskId) });
};

export const findProjectTask = (d: AppData, taskId: string): { project: Project; task: ProjectTask } | null => {
  for (const p of allProjects(d)) { const task = p.tasks.find(t => t.id === taskId); if (task) return { project: p, task }; }
  return null;
};

/** Coche ou décoche une tâche de projet. Le projet se termine tout seul quand tout est fait. */
export function setProjectTaskDone(d: AppData, taskId: string, done: boolean, dateKey = getKeyFromDate(new Date())): AppData {
  const found = findProjectTask(d, taskId); if (!found) return d;
  const { project } = found;
  const tasks = project.tasks.map(t => t.id === taskId ? { ...t, done, doneAt: done ? `${dateKey}T${new Date().toTimeString().slice(0, 5)}` : undefined } : t);
  const all = tasks.length > 0 && tasks.every(t => t.done);
  const status: ProjectStatus = all && project.status === 'active' ? 'done' : (!all && project.status === 'done' ? 'active' : project.status);
  return put(d, { ...project, tasks, status, completedAt: status === 'done' ? (project.completedAt || new Date().toISOString()) : undefined });
}

// ---------- Pont avec la routine ----------

/** La tâche de routine correspondant à un identifiant, le jour donné (copie du jour d'abord). */
export function findRoutineTask(d: AppData, taskId: string, dateKey: string): Task | undefined {
  const scan = (list?: Task[]): Task | undefined => {
    for (const t of list || []) { if (t.id === taskId) return t; const s = scan(t.subTasks); if (s) return s; }
    return undefined;
  };
  for (const b of d.days?.[dateKey]?.blocks || []) { const t = scan(b.tasks); if (t) return t; }
  for (const b of d.blocks || []) { const t = scan(b.tasks); if (t) return t; }
  return undefined;
}

/** Après un cochage dans la journée, reporte l'état sur la tâche de projet reliée. */
export function mirrorRoutineToProject(d: AppData, taskId: string, dateKey: string): AppData {
  const t = findRoutineTask(d, taskId, dateKey);
  if (!t?.projectTaskId) return d;
  const found = findProjectTask(d, t.projectTaskId);
  if (!found) return d;
  const done = !!t.completedDates?.includes(dateKey);
  if (!!found.task.done === done) return d;
  return setProjectTaskDone(d, t.projectTaskId, done, dateKey);
}

/** Dans l'autre sens : cocher dans le projet coche la tâche posée dans la journée. */
export function mirrorProjectToRoutine(d: AppData, projectTaskId: string, done: boolean): AppData {
  const found = findProjectTask(d, projectTaskId);
  const rid = found?.task.routineTaskId, day = found?.task.plannedFor;
  if (!rid || !day) return d;
  const flip = (t: Task): Task => {
    if (t.id !== rid) return t.subTasks?.length ? { ...t, subTasks: t.subTasks.map(flip) } : t;
    const has = t.completedDates?.includes(day);
    if (done === !!has) return t;
    return { ...t, completedDates: done ? [...(t.completedDates || []), day] : (t.completedDates || []).filter(k => k !== day) };
  };
  const days = { ...(d.days || {}) };
  if (days[day]?.blocks) days[day] = { ...days[day], blocks: days[day].blocks!.map(b => ({ ...b, tasks: b.tasks.map(flip) })) };
  return { ...d, days, blocks: (d.blocks || []).map(b => ({ ...b, tasks: b.tasks.map(flip) })) };
}

/** La tâche de routine à créer pour une tâche de projet posée un jour donné. */
export function routineTaskFor(p: Project, t: ProjectTask, dateKey: string): Task {
  return {
    id: generateId(), title: t.title, completedDates: [], recurrence: 'specific', specificDate: dateKey,
    duration: t.estimateMin, priority: (t.priority as PriorityType) || undefined, deadline: t.due,
    projectId: p.id, projectTaskId: t.id, why: p.why, identityId: p.identityId,
  };
}

// ---------- Fusion cloud ----------
/** Deux appareils : on garde la version la plus récente de chaque projet, tombstones comprises. */
export function mergeProjects(local?: Project[], cloud?: Project[]): Project[] {
  const at = (p: Project) => p.updatedAt || p.completedAt || p.createdAt || '';
  const m = new Map<string, Project>();
  [...(cloud || []), ...(local || [])].forEach(p => {
    const cur = m.get(p.id);
    if (!cur) { m.set(p.id, p); return; }
    if (p.deleted || cur.deleted) { m.set(p.id, { ...(at(p) >= at(cur) ? p : cur), deleted: true }); return; }
    m.set(p.id, at(p) >= at(cur) ? p : cur);
  });
  return [...m.values()];
}

/** Retire la tâche posée dans la routine (si elle n'a pas déjà été faite). */
export function removeRoutineTask(d: AppData, routineTaskId: string): AppData {
  const strip = (tasks: Task[]): Task[] => tasks.filter(t => !(t.id === routineTaskId && !(t.completedDates || []).length));
  const days = { ...(d.days || {}) };
  Object.keys(days).forEach(k => { const day = days[k]; if (day?.blocks) days[k] = { ...day, blocks: day.blocks.map(b => ({ ...b, tasks: strip(b.tasks) })) }; });
  return { ...d, days, blocks: (d.blocks || []).map(b => ({ ...b, tasks: strip(b.tasks) })) };
}

/**
 * Remet d'accord les tâches de projet posées dans la routine avec ce que montre la journée.
 * Utile pour les chemins qui cochent sans passer par l'écran du jour : rappels, bilan du soir, Cady.
 */
export function reconcileProjects(d: AppData): AppData {
  const projects = d.projects || [];
  if (!projects.length) return d;
  let changed = false;
  const next = projects.map(p => {
    if (p.deleted) return p;
    let touched = false;
    const tasks = p.tasks.map(t => {
      if (!t.routineTaskId || !t.plannedFor) return t;
      const rt = findRoutineTask(d, t.routineTaskId, t.plannedFor);
      if (!rt) return t;
      const done = !!rt.completedDates?.includes(t.plannedFor);
      if (!!t.done === done) return t;
      touched = true;
      return { ...t, done, doneAt: done ? `${t.plannedFor}T12:00` : undefined };
    });
    if (!touched) return p;
    changed = true;
    const all = tasks.length > 0 && tasks.every(x => x.done);
    const status: ProjectStatus = all && p.status === 'active' ? 'done' : (!all && p.status === 'done' ? 'active' : p.status);
    return { ...p, tasks, status, updatedAt: new Date().toISOString() };
  });
  return changed ? { ...d, projects: next } : d;
}
