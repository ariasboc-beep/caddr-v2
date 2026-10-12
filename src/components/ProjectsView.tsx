import React, { useMemo, useState } from 'react';
import {
  Plus, ChevronLeft, ChevronDown, ChevronRight, Check, X, Trash2, CalendarClock, Flag, Target,
  Layers, CalendarPlus, Pencil, Sparkles, Hourglass, AlertTriangle, CheckCircle2, Pause, Play, Archive,
} from 'lucide-react';
import type { AppData, Project, ProjectTask, ProjectStatus, LongTermGoal, Identity, PriorityType } from '../types';
import { getKeyFromDate } from '../utils';
import { BRAND_SWATCHES } from '../palette';
import { RingMark } from './DayRing';
import DurationInput from './DurationInput';
import {
  PROJECT_STATUS, allProjects, projectStats, stepTasks, sortTasks, openTasks, HEALTH_LABEL,
  addProject, patchProject, removeProject, addStep, removeStep, patchStep,
  addProjectTask, patchProjectTask, removeProjectTask, setProjectTaskDone, mirrorProjectToRoutine,
} from '../projects';

interface Props {
  appData: AppData;
  update: (fn: (prev: AppData) => AppData) => void;
  saveToHistory: () => void;
  notify: (msg: string, ms?: number) => void;
  /** Pose une tâche de projet dans la routine d'un jour (bloc facultatif). */
  onPlan: (projectId: string, taskId: string, dateKey: string, blockId?: string) => void;
  blockChoices: { id: string; title: string }[];
  goals: LongTermGoal[];
  identities: Identity[];
  onAskClaude?: (prompt: string) => void;
}

const ink = 'text-[#18181B] dark:text-[#E6E8E6]';
const muted = 'text-[#18181B]/55 dark:text-[#E6E8E6]/55';
const faint = 'text-[#18181B]/40 dark:text-[#E6E8E6]/40';
const card = 'glass rounded-[2rem] p-5';
const input = `w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-3.5 py-3 rounded-2xl text-sm font-bold border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent ${ink}`;
const label = `text-[9px] font-black uppercase tracking-widest ${muted}`;
const chip = 'px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest';

const GOLD = '#FDCA40', CRIMSON = '#DF2935';
const HEALTH_STYLE: Record<string, string> = {
  done: 'bg-accent/15 text-accent',
  late: 'bg-[#DF2935]/12 text-[#DF2935]',
  risk: 'bg-[#FDCA40]/15 text-[#B8900A] dark:text-[#FDCA40]',
  ok: 'bg-[#18181B]/[0.06] dark:bg-[#E6E8E6]/[0.06] text-[#18181B]/60 dark:text-[#E6E8E6]/55',
  idle: 'bg-[#18181B]/[0.06] dark:bg-[#E6E8E6]/[0.06] text-[#18181B]/50 dark:text-[#E6E8E6]/45',
};
const fmtDay = (k?: string) => k ? new Date(k + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace(/\.$/, '') : '';
const dayShift = (k: string, n: number) => getKeyFromDate(new Date(new Date(k + 'T12:00:00').getTime() + n * 86400000));
const PRIO_LABEL: Record<PriorityType, string> = { high: 'Haute', medium: 'Normale', low: 'Basse' };

// ───────────────────────── Formulaire de projet ─────────────────────────
const ProjectForm: React.FC<{
  initial?: Project; goals: LongTermGoal[]; identities: Identity[];
  onSave: (f: Partial<Project> & { title: string }) => void; onCancel: () => void;
}> = ({ initial, goals, identities, onSave, onCancel }) => {
  const [title, setTitle] = useState(initial?.title || '');
  const [why, setWhy] = useState(initial?.why || '');
  const [dueDate, setDueDate] = useState(initial?.dueDate || '');
  const [goalId, setGoalId] = useState(initial?.goalId || '');
  const [identityId, setIdentityId] = useState(initial?.identityId || '');
  const [color, setColor] = useState(initial?.color || '');
  return (
    <div className={`${card} space-y-4`} aria-label={initial ? 'Modifier le projet' : 'Nouveau projet'}>
      <div className="space-y-1.5">
        <label className={label}>Le projet</label>
        <input autoFocus className={input} placeholder="Ex. Obtenir la certification ISO 22000" value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && title.trim()) onSave({ title, why, dueDate: dueDate || undefined, goalId: goalId || undefined, identityId: identityId || undefined, color }); }} />
      </div>
      <div className="space-y-1.5">
        <label className={label}>Pourquoi il compte</label>
        <input className={input} placeholder="Ce que ce projet changera pour toi" value={why} onChange={e => setWhy(e.target.value)} />
        <p className={`text-[10px] font-semibold ${faint}`}>Cette phrase te sera rappelée sur chaque tâche du projet, les jours sans élan.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={label}>Échéance</label>
          <input type="date" className={`${input} [color-scheme:light] dark:[color-scheme:dark]`} value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className={label}>Objectif de vie servi</label>
          <select className={input} value={goalId} onChange={e => setGoalId(e.target.value)}>
            <option value="">Aucun pour l'instant</option>
            {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        </div>
      </div>
      {identities.length > 0 && (
        <div className="space-y-1.5">
          <label className={label}>Identité renforcée</label>
          <select className={input} value={identityId} onChange={e => setIdentityId(e.target.value)}>
            <option value="">Aucune</option>
            {identities.map(i => <option key={i.id} value={i.id}>{i.text}</option>)}
          </select>
        </div>
      )}
      <div className="space-y-1.5">
        <label className={label}>Couleur</label>
        <div className="flex gap-2">
          {BRAND_SWATCHES.map(c => (
            <button key={c || 'accent'} onClick={() => setColor(c)} aria-label={`Couleur ${c || 'teal'}`}
              className={`w-8 h-8 rounded-xl border-2 transition-all ${color === c ? 'border-[#18181B] dark:border-[#E6E8E6] scale-110' : 'border-transparent'}`}
              style={{ background: c || 'var(--accent)' }} />
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button disabled={!title.trim()} onClick={() => onSave({ title, why, dueDate: dueDate || undefined, goalId: goalId || undefined, identityId: identityId || undefined, color })}
          className="flex-1 py-3 rounded-2xl bg-accent text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40">{initial ? 'Enregistrer' : 'Créer le projet'}</button>
        <button onClick={onCancel} className={`px-5 py-3 rounded-2xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[10px] font-black uppercase tracking-widest ${ink}`}>Annuler</button>
      </div>
    </div>
  );
};

// ───────────────────────── Une tâche de projet ─────────────────────────
const TaskRow: React.FC<{
  project: Project; task: ProjectTask; todayKey: string; blockChoices: Props['blockChoices'];
  onToggle: () => void; onPatch: (f: Partial<ProjectTask>) => void; onRemove: () => void;
  onPlan: (dateKey: string, blockId?: string) => void;
}> = ({ project, task, todayKey, blockChoices, onToggle, onPatch, onRemove, onPlan }) => {
  const [open, setOpen] = useState<'none' | 'plan' | 'edit'>('none');
  const [blockId, setBlockId] = useState(blockChoices[0]?.id || '');
  const [date, setDate] = useState(todayKey);
  const late = !task.done && task.due && task.due < todayKey;
  const planned = !task.done && task.plannedFor;
  return (
    <div className="rounded-2xl bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] border border-[#18181B]/5 dark:border-[#E6E8E6]/5">
      <div className="flex items-start gap-3 p-3">
        <button onClick={onToggle} aria-label={task.done ? 'Rouvrir la tâche' : 'Tâche faite'} aria-pressed={!!task.done}
          className={`mt-0.5 w-6 h-6 shrink-0 rounded-lg border-2 flex items-center justify-center transition-all ${task.done ? 'bg-accent border-accent text-white' : 'border-[#18181B]/20 dark:border-[#E6E8E6]/20 hover:border-accent'}`}>
          {task.done && <Check size={14} />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-bold leading-snug ${task.done ? `line-through ${faint}` : ink}`}>{task.title}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
            {task.due && <span className={`text-[10px] font-bold ${late ? 'text-[#DF2935]' : muted}`}>{late ? 'En retard · ' : 'Pour le '}{fmtDay(task.due)}</span>}
            {task.estimateMin ? <span className={`text-[10px] font-semibold ${faint}`}>{task.estimateMin >= 60 ? `${Math.floor(task.estimateMin / 60)} h${task.estimateMin % 60 ? String(task.estimateMin % 60).padStart(2, '0') : ''}` : `${task.estimateMin} min`}</span> : null}
            {task.priority === 'high' && <span className={`${chip} bg-[#FDCA40]/15 text-[#B8900A] dark:text-[#FDCA40]`}>Priorité</span>}
            {planned && <span className={`${chip} bg-accent/10 text-accent`}>Posée le {fmtDay(task.plannedFor)}</span>}
          </div>
          {task.note && <p className={`text-[11px] font-semibold mt-1 ${muted}`}>{task.note}</p>}
        </div>
        {!task.done && (
          <button onClick={() => setOpen(o => o === 'plan' ? 'none' : 'plan')} title="Poser dans une journée" aria-label="Poser dans une journée"
            className={`shrink-0 p-2 rounded-xl transition-all ${open === 'plan' ? 'bg-accent text-white' : `bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 ${muted} hover:text-accent`}`}><CalendarPlus size={14} /></button>
        )}
        <button onClick={() => setOpen(o => o === 'edit' ? 'none' : 'edit')} title="Modifier" aria-label="Modifier la tâche"
          className={`shrink-0 p-2 rounded-xl transition-all ${open === 'edit' ? 'bg-accent text-white' : `bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 ${muted} hover:text-accent`}`}><Pencil size={14} /></button>
      </div>

      {open === 'plan' && (
        <div className="px-3 pb-3 space-y-2 animate-in fade-in slide-in-from-top-1" aria-label="Poser la tâche dans une journée">
          <p className={label}>La faire</p>
          <div className="flex flex-wrap gap-2">
            {([[todayKey, "Aujourd'hui"], [dayShift(todayKey, 1), 'Demain']] as const).map(([k, l]) => (
              <button key={k} onClick={() => { onPlan(k, blockId || undefined); setOpen('none'); }} className="px-3 py-2 rounded-xl bg-accent text-white text-[10px] font-black uppercase tracking-wider">{l}</button>
            ))}
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`px-3 py-2 rounded-xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[11px] font-bold ${ink} [color-scheme:light] dark:[color-scheme:dark]`} />
            <button onClick={() => { onPlan(date, blockId || undefined); setOpen('none'); }} className={`px-3 py-2 rounded-xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[10px] font-black uppercase tracking-wider ${ink} hover:text-accent`}>Poser</button>
          </div>
          {blockChoices.length > 0 && (
            <select value={blockId} onChange={e => setBlockId(e.target.value)} className={`${input} py-2 text-[12px]`} aria-label="Bloc de la journée">
              {blockChoices.map(b => <option key={b.id} value={b.id}>Dans « {b.title} »</option>)}
            </select>
          )}
        </div>
      )}

      {open === 'edit' && (
        <div className="px-3 pb-3 space-y-2 animate-in fade-in slide-in-from-top-1">
          <input className={`${input} py-2 text-[13px]`} value={task.title} onChange={e => onPatch({ title: e.target.value })} aria-label="Titre de la tâche" />
          <input className={`${input} py-2 text-[12px]`} placeholder="Note (facultatif)" value={task.note || ''} onChange={e => onPatch({ note: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <span className={label}>Échéance</span>
              <input type="date" className={`${input} py-2 text-[12px] [color-scheme:light] dark:[color-scheme:dark]`} value={task.due || ''} onChange={e => onPatch({ due: e.target.value || undefined })} />
            </div>
            <div className="space-y-1">
              <span className={label}>Durée estimée</span>
              <DurationInput value={task.estimateMin} onChange={(v) => onPatch({ estimateMin: v || undefined })} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={label}>Priorité</span>
            <div className="flex gap-1">
              {(['high', 'medium', 'low'] as PriorityType[]).map(p => (
                <button key={p} onClick={() => onPatch({ priority: p })} className={`${chip} ${(task.priority || 'medium') === p ? 'bg-accent text-white' : `bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 ${muted}`}`}>{PRIO_LABEL[p]}</button>
              ))}
            </div>
            <button onClick={onRemove} title="Supprimer la tâche" aria-label="Supprimer la tâche" className="ml-auto p-2 rounded-xl text-[#DF2935] hover:bg-[#DF2935]/10"><Trash2 size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
};

// ───────────────────────── Vue détail d'un projet ─────────────────────────
const ProjectDetail: React.FC<Props & { project: Project; onBack: () => void; todayKey: string }> = (p) => {
  const { project, update, saveToHistory, notify, onBack, todayKey, goals, identities, blockChoices, onPlan, onAskClaude } = p;
  const [editing, setEditing] = useState(false);
  const [newStep, setNewStep] = useState('');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const st = projectStats(project, todayKey);
  const goal = goals.find(g => g.id === project.goalId);
  const identity = identities.find(i => i.id === project.identityId);
  const color = project.color || 'var(--accent)';

  const addTask = (stepId?: string) => {
    const key = stepId || '_';
    const title = (draft[key] || '').trim();
    if (!title) return;
    saveToHistory();
    update(prev => addProjectTask(prev, project.id, { title, stepId }).data);
    setDraft(d => ({ ...d, [key]: '' }));
  };
  const toggle = (t: ProjectTask) => {
    saveToHistory();
    update(prev => mirrorProjectToRoutine(setProjectTaskDone(prev, t.id, !t.done, todayKey), t.id, !t.done));
    if (!t.done && st.open === 1) notify('Projet terminé. Tout est accompli. ✦', 4000);
  };

  const sections: { id?: string; title: string; tasks: ProjectTask[] }[] = [
    ...[...project.steps].sort((a, b) => a.order - b.order).map(s => ({ id: s.id, title: s.title, tasks: sortTasks(stepTasks(project, s.id)) })),
    { id: undefined, title: project.steps.length ? 'Sans étape' : 'Tâches', tasks: sortTasks(stepTasks(project, undefined)) },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <button onClick={onBack} className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${muted} hover:text-accent`}><ChevronLeft size={14} /> Tous les projets</button>

      {editing ? (
        <ProjectForm initial={project} goals={goals} identities={identities}
          onSave={(f) => { saveToHistory(); update(prev => patchProject(prev, project.id, f)); setEditing(false); notify('Projet mis à jour.'); }}
          onCancel={() => setEditing(false)} />
      ) : (
        <div className={`${card} space-y-4 border-l-4`} style={{ borderLeftColor: color }}>
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`${chip} ${HEALTH_STYLE[st.health]}`}>{HEALTH_LABEL[st.health]}</span>
                {project.status === 'paused' && <span className={`${chip} bg-[#18181B]/[0.06] dark:bg-[#E6E8E6]/[0.06] ${muted}`}>En pause</span>}
                {project.dueDate && <span className={`text-[10px] font-bold ${st.daysLeft !== null && st.daysLeft < 0 ? 'text-[#DF2935]' : muted}`}><CalendarClock size={10} className="inline mb-0.5" /> {st.daysLeft !== null && st.daysLeft >= 0 ? `J−${st.daysLeft}` : `${Math.abs(st.daysLeft || 0)} j de retard`} · {fmtDay(project.dueDate)}</span>}
              </div>
              <h1 className={`text-xl font-black leading-tight ${ink}`}>{project.title}</h1>
              {project.why && <p className={`text-[12px] font-semibold mt-1 ${muted}`}>« {project.why} »</p>}
            </div>
            <RingMark done={st.done} total={st.total} size={64} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {goal && <span className={`${chip} bg-accent/10 text-accent`}><Target size={10} className="inline mb-0.5" /> {goal.title}</span>}
            {identity && <span className={`${chip} bg-[#FDCA40]/12 text-[#B8900A] dark:text-[#FDCA40]`}><Sparkles size={10} className="inline mb-0.5" /> {identity.text}</span>}
            <span className={`${chip} bg-[#18181B]/[0.06] dark:bg-[#E6E8E6]/[0.06] ${muted}`}>{st.done} / {st.total} tâches</span>
            {st.overdue > 0 && <span className={`${chip} bg-[#DF2935]/12 text-[#DF2935]`}><AlertTriangle size={10} className="inline mb-0.5" /> {st.overdue} en retard</span>}
          </div>

          {st.expected !== null && st.health !== 'done' && (
            <div className="space-y-1">
              <div className="h-1.5 w-full bg-[#18181B]/[0.07] dark:bg-[#E6E8E6]/[0.07] rounded-full overflow-hidden relative">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${st.pct}%`, background: color }} />
                <div className="absolute top-[-3px] w-0.5 h-3 bg-[#18181B]/40 dark:bg-[#E6E8E6]/40" style={{ left: `${st.expected}%` }} title={`Rythme attendu : ${st.expected} %`} />
              </div>
              <p className={`text-[10px] font-semibold ${faint}`}>{st.pct} % fait · le repère montre où tu devrais en être ({st.expected} %) pour tenir l'échéance.</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={() => setEditing(true)} className={`px-3 py-2 rounded-xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[10px] font-black uppercase tracking-wider ${ink} hover:text-accent`}><Pencil size={12} className="inline mb-0.5" /> Modifier</button>
            {(['active', 'paused', 'done'] as ProjectStatus[]).filter(s => s !== project.status).map(s => (
              <button key={s} onClick={() => { saveToHistory(); update(prev => patchProject(prev, project.id, { status: s })); notify(s === 'done' ? 'Projet marqué terminé. ✦' : s === 'paused' ? 'Projet mis en pause.' : 'Projet relancé.'); }}
                className={`px-3 py-2 rounded-xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[10px] font-black uppercase tracking-wider ${ink} hover:text-accent`}>
                {s === 'done' ? <><CheckCircle2 size={12} className="inline mb-0.5" /> Terminer</> : s === 'paused' ? <><Pause size={12} className="inline mb-0.5" /> Mettre en pause</> : <><Play size={12} className="inline mb-0.5" /> Relancer</>}
              </button>
            ))}
            {onAskClaude && (
              <button onClick={() => onAskClaude(`Aide-moi à découper le projet « ${project.title} »${project.why ? ` (objectif : ${project.why})` : ''}${project.dueDate ? `, échéance ${project.dueDate}` : ''} en étapes claires et en premières tâches concrètes, puis ajoute-les au projet.`)}
                className="px-3 py-2 rounded-xl bg-accent/10 text-accent text-[10px] font-black uppercase tracking-wider hover:bg-accent hover:text-white transition-all"><Sparkles size={12} className="inline mb-0.5" /> Découper avec Cady</button>
            )}
            <button onClick={() => { if (confirm('Supprimer ce projet et toutes ses tâches ?')) { saveToHistory(); update(prev => removeProject(prev, project.id)); onBack(); notify('Projet supprimé.'); } }}
              className="ml-auto p-2 rounded-xl text-[#DF2935] hover:bg-[#DF2935]/10" title="Supprimer le projet" aria-label="Supprimer le projet"><Trash2 size={14} /></button>
          </div>
        </div>
      )}

      {/* Prochaine action : ce qu'il y a à faire, maintenant */}
      {st.next && (
        <div className={`${card} flex flex-wrap items-center gap-3 border border-accent/25`} aria-label="Prochaine action">
          <span className="w-9 h-9 rounded-xl bg-accent/15 text-accent flex items-center justify-center shrink-0"><Flag size={16} /></span>
          <div className="flex-1 min-w-[160px]">
            <p className={label}>Prochaine action</p>
            <p className={`text-sm font-black ${ink}`}>{st.next.title}</p>
          </div>
          <button onClick={() => onPlan(project.id, st.next!.id, todayKey, blockChoices[0]?.id)} className="px-4 py-2.5 rounded-xl bg-accent text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-accent/20">Faire aujourd'hui</button>
        </div>
      )}

      {/* Étapes et tâches */}
      {sections.map(sec => {
        if (!sec.id && !sec.tasks.length && project.steps.length) return null;
        const done = sec.tasks.filter(t => t.done).length;
        const shut = collapsed[sec.id || '_'];
        return (
          <div key={sec.id || '_'} className={`${card} space-y-3`}>
            <div className="flex items-center gap-2">
              <button onClick={() => setCollapsed(c => ({ ...c, [sec.id || '_']: !shut }))} className={`p-1 rounded-lg ${faint} hover:text-accent`} aria-label={shut ? 'Déplier' : 'Replier'} aria-expanded={!shut}>
                {shut ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
              </button>
              <Layers size={14} className="text-accent shrink-0" />
              {sec.id ? (
                <input value={sec.title} onChange={e => update(prev => patchStep(prev, project.id, sec.id!, { title: e.target.value }))}
                  className={`flex-1 min-w-0 bg-transparent text-[12px] font-black uppercase tracking-widest outline-none ${ink}`} aria-label="Nom de l'étape" />
              ) : <span className={`flex-1 text-[12px] font-black uppercase tracking-widest ${ink}`}>{sec.title}</span>}
              <span className={`text-[10px] font-black ${done === sec.tasks.length && sec.tasks.length ? 'text-accent' : faint}`}>{done}/{sec.tasks.length}</span>
              {sec.id && <button onClick={() => { saveToHistory(); update(prev => removeStep(prev, project.id, sec.id!)); }} className={`p-1 rounded-lg ${faint} hover:text-[#DF2935]`} title="Retirer l'étape (les tâches restent)" aria-label="Retirer l'étape"><X size={14} /></button>}
            </div>
            {!shut && (
              <>
                {sec.tasks.map(t => (
                  <TaskRow key={t.id} project={project} task={t} todayKey={todayKey} blockChoices={blockChoices}
                    onToggle={() => toggle(t)}
                    onPatch={(f) => update(prev => patchProjectTask(prev, project.id, t.id, f))}
                    onRemove={() => { saveToHistory(); update(prev => removeProjectTask(prev, project.id, t.id)); }}
                    onPlan={(k, b) => onPlan(project.id, t.id, k, b)} />
                ))}
                <div className="flex gap-2">
                  <input className={`${input} py-2.5 text-[13px]`} placeholder="Ajouter une tâche…" value={draft[sec.id || '_'] || ''}
                    onChange={e => setDraft(d => ({ ...d, [sec.id || '_']: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') addTask(sec.id); }} aria-label="Nouvelle tâche" />
                  <button onClick={() => addTask(sec.id)} className="shrink-0 px-4 rounded-2xl bg-accent/10 text-accent hover:bg-accent hover:text-white transition-all" aria-label="Ajouter la tâche"><Plus size={16} /></button>
                </div>
              </>
            )}
          </div>
        );
      })}

      <div className="flex gap-2">
        <input className={`${input} py-2.5 text-[13px]`} placeholder="Ajouter une étape (ex. « Préparer le dossier »)" value={newStep}
          onChange={e => setNewStep(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newStep.trim()) { saveToHistory(); update(prev => addStep(prev, project.id, newStep)); setNewStep(''); } }} aria-label="Nouvelle étape" />
        <button onClick={() => { if (newStep.trim()) { saveToHistory(); update(prev => addStep(prev, project.id, newStep)); setNewStep(''); } }}
          className={`shrink-0 px-4 rounded-2xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 ${ink} hover:text-accent transition-all`} aria-label="Ajouter l'étape"><Layers size={16} /></button>
      </div>
    </div>
  );
};

// ───────────────────────── Liste des projets ─────────────────────────
const ProjectsView: React.FC<Props> = (props) => {
  const { appData, update, saveToHistory, notify, goals, identities } = props;
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<'active' | 'paused' | 'done' | 'all'>('active');
  const todayKey = getKeyFromDate(new Date());
  const projects = allProjects(appData);
  const current = openId ? projects.find(p => p.id === openId) : null;

  const shown = useMemo(() => {
    const list = filter === 'all' ? projects : projects.filter(p => filter === 'done' ? (p.status === 'done' || p.status === 'dropped') : p.status === filter);
    return list.sort((a, b) => {
      const sa = projectStats(a, todayKey), sb = projectStats(b, todayKey);
      const rank = (h: string) => ({ late: 0, risk: 1, ok: 2, idle: 3, done: 4 } as Record<string, number>)[h] ?? 5;
      return rank(sa.health) - rank(sb.health) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
    });
  }, [projects, filter, todayKey]);

  if (current) return <ProjectDetail {...props} project={current} todayKey={todayKey} onBack={() => setOpenId(null)} />;

  const counts = {
    active: projects.filter(p => p.status === 'active').length,
    paused: projects.filter(p => p.status === 'paused').length,
    done: projects.filter(p => p.status === 'done' || p.status === 'dropped').length,
    all: projects.length,
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex items-start justify-between gap-3 px-2">
        <div>
          <h1 className={`text-2xl font-black ${ink}`}>Projets</h1>
          <p className={`text-xs font-bold mt-1 ${muted}`}>Ce que tu construis, étape par étape — et qui sert tes objectifs de vie.</p>
        </div>
        {!creating && <button onClick={() => setCreating(true)} className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-accent/20"><Plus size={14} /> Nouveau</button>}
      </div>

      {creating && (
        <ProjectForm goals={goals} identities={identities}
          onSave={(f) => { saveToHistory(); let id = ''; update(prev => { const r = addProject(prev, f); id = r.id; return r.data; }); setCreating(false); setTimeout(() => setOpenId(id), 0); notify('Projet créé. Ajoute ses étapes et ses premières tâches.', 4000); }}
          onCancel={() => setCreating(false)} />
      )}

      {projects.length > 0 && (
        <div className="flex flex-wrap gap-2 px-2">
          {([['active', 'En cours'], ['paused', 'En pause'], ['done', 'Terminés'], ['all', 'Tous']] as const).map(([f, l]) => (
            <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
              className={`${chip} ${filter === f ? 'bg-accent text-white' : `bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 ${muted}`}`}>{l} · {counts[f]}</button>
          ))}
        </div>
      )}

      {!projects.length && !creating && (
        <div className={`${card} text-center space-y-3 py-10`}>
          <div className="w-16 h-16 mx-auto rounded-3xl bg-accent/10 flex items-center justify-center"><Layers size={28} className="text-accent" /></div>
          <p className={`text-lg font-black ${ink}`}>Aucun projet pour l'instant</p>
          <p className={`text-[12px] font-semibold max-w-sm mx-auto ${muted}`}>Un projet, c'est ce qui a un début et une fin : une certification, un voyage, un lancement. Ses tâches viennent se poser dans tes journées, et son avancement nourrit ton objectif de vie.</p>
          <button onClick={() => setCreating(true)} className="px-5 py-3 rounded-2xl bg-accent text-white text-[10px] font-black uppercase tracking-widest">Créer mon premier projet</button>
        </div>
      )}

      {shown.map(p => {
        const st = projectStats(p, todayKey);
        const color = p.color || 'var(--accent)';
        return (
          <button key={p.id} onClick={() => setOpenId(p.id)} className={`${card} w-full text-left flex items-center gap-4 border-l-4 hover:border-accent/50 transition-all`} style={{ borderLeftColor: color }}>
            <RingMark done={st.done} total={st.total} size={56} />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`${chip} ${HEALTH_STYLE[st.health]}`}>{HEALTH_LABEL[st.health]}</span>
                {p.dueDate && <span className={`text-[10px] font-bold ${st.daysLeft !== null && st.daysLeft < 0 ? 'text-[#DF2935]' : faint}`}>{st.daysLeft !== null && st.daysLeft >= 0 ? `J−${st.daysLeft}` : `${Math.abs(st.daysLeft || 0)} j de retard`}</span>}
                {st.plannedToday > 0 && <span className={`${chip} bg-accent/10 text-accent`}>{st.plannedToday} aujourd'hui</span>}
              </div>
              <p className={`text-[15px] font-black leading-tight truncate ${ink}`}>{p.title}</p>
              <p className={`text-[11px] font-semibold truncate ${muted}`}>{st.next ? <><Flag size={10} className="inline mb-0.5" /> {st.next.title}</> : st.total ? 'Toutes les tâches sont faites.' : 'Aucune tâche : commence par découper le projet.'}</p>
            </div>
            <ChevronRight size={18} className={`shrink-0 ${faint}`} />
          </button>
        );
      })}

      {projects.length > 0 && !shown.length && (
        <p className={`text-center text-[12px] font-semibold py-8 ${muted}`}>Aucun projet dans cette catégorie.</p>
      )}
    </div>
  );
};

export default ProjectsView;
