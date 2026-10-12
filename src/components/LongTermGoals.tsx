import React, { useMemo, useState } from 'react';
import { Plus, Trash2, CalendarClock, Flag, Link2, Wand2, ChevronDown, ChevronUp, Check, Sparkles, Milestone as MilestoneIcon, X } from 'lucide-react';
import { PROMPTS } from '../assistant/prompts';
import { AppData, LongTermGoal } from '../types';
import { generateId, getKeyFromDate } from '../utils';
import { goalProgress } from '../deepStats';
import { goalProjects, HEALTH_LABEL } from '../projects';

interface Props {
  goals: LongTermGoal[];
  onChange: (goals: LongTermGoal[]) => void;
  appData?: AppData; // pour la progression automatique (tâches reliées)
  onAskClaude?: (prompt: string) => void;
  onOpenProjects?: () => void; // les projets qui servent cet objectif
}

const daysUntil = (dateStr?: string): number | null => {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
};

const ink = 'text-[#18181B] dark:text-[#E6E8E6]';
const muted = 'text-[#18181B]/50 dark:text-[#E6E8E6]/50';

const LongTermGoals: React.FC<Props> = ({ goals, onChange, appData, onAskClaude, onOpenProjects }) => {
  const [msDraft, setMsDraft] = useState<Record<string, { title: string; date: string }>>({});
  const [newTitle, setNewTitle] = useState('');
  const [linking, setLinking] = useState<string | null>(null);
  const todayKey = getKeyFromDate(new Date());

  const add = () => {
    if (!newTitle.trim()) return;
    onChange([...goals, { id: generateId(), title: newTitle.trim(), progress: 0, createdAt: new Date().toISOString() }]);
    setNewTitle('');
  };

  const patch = (id: string, p: Partial<LongTermGoal>) =>
    onChange(goals.map((g) => (g.id === id ? { ...g, ...p } : g)));

  // Blocs et tâches du plan, proposés pour la liaison
  const catalog = useMemo(() => {
    const m = new Map<string, { id: string; title: string }[]>();
    (appData?.blocks || []).forEach(b => {
      const list = m.get(b.title) || [];
      b.tasks.forEach(t => { if (!list.some(x => x.id === t.id)) list.push({ id: t.id, title: t.title }); });
      m.set(b.title, list);
    });
    return [...m.entries()].map(([title, tasks]) => ({ title, tasks }));
  }, [appData?.blocks]);

  const auto = useMemo(() => {
    const out: Record<string, ReturnType<typeof goalProgress>> = {};
    if (appData) goals.forEach(g => { if (g.autoProgress) out[g.id] = goalProgress(appData, g, todayKey); });
    return out;
  }, [appData, goals, todayKey]);

  const toggleIn = (arr: string[] | undefined, v: string) => (arr || []).includes(v) ? (arr || []).filter(x => x !== v) : [...(arr || []), v];

  return (
    <div className="glass p-6 rounded-[2rem] space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 font-black uppercase tracking-wider text-sm flex items-center gap-2"><Flag size={16} className="text-accent" /> Objectifs long terme</h2>
        {onAskClaude && <button onClick={() => onAskClaude(PROMPTS.newGoal)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent/10 text-accent text-[10px] font-black uppercase tracking-wider hover:bg-accent hover:text-white transition-all"><Sparkles size={13} /> Objectif guidé par Cady</button>}
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-4 py-3 rounded-xl text-sm font-bold border border-[#18181B]/5 dark:border-[#E6E8E6]/5 outline-none focus:border-accent text-[#18181B] dark:text-[#E6E8E6]"
          placeholder="Nouvel objectif de fond..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button onClick={add} aria-label="Ajouter l'objectif" className="p-3 bg-accent rounded-xl text-white shadow-lg shadow-accent/20 active:scale-95 transition-all"><Plus size={18} /></button>
      </div>

      {goals.length === 0 ? (
        <p className="text-xs text-[#18181B]/50 dark:text-[#E6E8E6]/50 font-medium">Reliez votre discipline quotidienne à un cap : ajoutez un objectif de fond.</p>
      ) : (
        <div className="space-y-3">
          {goals.map((g) => {
            const dLeft = daysUntil(g.targetDate);
            const a = auto[g.id];
            const progress = a ? a.progress : g.progress;
            const nLinks = (g.linkedBlocks?.length || 0) + (g.linkedTasks?.length || 0);
            return (
              <div key={g.id} className="p-4 rounded-2xl bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <input
                    className="flex-1 bg-transparent text-sm font-black outline-none text-[#18181B] dark:text-[#E6E8E6]"
                    value={g.title}
                    onChange={(e) => patch(g.id, { title: e.target.value })}
                  />
                  <button onClick={() => onChange(goals.filter((x) => x.id !== g.id))} aria-label="Supprimer l'objectif" className="text-[#18181B]/40 dark:text-[#E6E8E6]/40 hover:text-[#DF2935] p-1 shrink-0"><Trash2 size={15} /></button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1 h-2.5 rounded-full bg-[#18181B]/10 dark:bg-[#E6E8E6]/10 overflow-hidden">
                    <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }} />
                    {a && a.planned > 0 && g.targetDate && <div className="absolute top-0 bottom-0 w-0.5 bg-[#18181B] dark:bg-white" style={{ left: `${a.expected}%` }} title={`Attendu aujourd'hui : ${a.expected} % du plan écoulé`} />}
                  </div>
                  <span className="text-xs font-black text-accent tabular-nums w-10 text-right">{progress}%</span>
                </div>

                {g.autoProgress ? (
                  <p className={`text-[11px] font-semibold ${muted}`}>
                    {!a || a.planned === 0 ? 'Relie des blocs ou des tâches pour calculer la progression.'
                      : <>{a.done} faites sur {a.planned} prévues{g.targetDate ? ` d'ici le ${new Date(g.targetDate + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : ' depuis la création'}{g.targetDate && a.past > 0 ? (a.done >= a.past * 0.9 ? ' · dans les temps' : ` · ${a.past - a.done} en retard sur le plan`) : ''}</>}
                  </p>
                ) : (
                  <input
                    type="range" min={0} max={100} value={g.progress} aria-label="Progression"
                    onChange={(e) => patch(g.id, { progress: parseInt(e.target.value) })}
                    className="w-full accent-[color:var(--accent)]"
                  />
                )}

                {(() => {
                  // Les projets qui servent cet objectif : leur avancement le nourrit concrètement.
                  const gp = appData ? goalProjects(appData, g.id, todayKey) : { list: [], pct: null };
                  if (!gp.list.length) return null;
                  return (
                    <div className="rounded-xl bg-[#18181B]/[0.04] dark:bg-[#E6E8E6]/[0.04] p-3 space-y-2">
                      <p className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>Projets qui y mènent · {gp.pct} % en moyenne</p>
                      {gp.list.map(({ project, stats }) => (
                        <button key={project.id} onClick={onOpenProjects} className="w-full flex items-center gap-2 text-left group">
                          <span className="flex-1 min-w-0">
                            <span className={`block text-[12px] font-bold truncate ${ink} group-hover:text-accent transition-colors`}>{project.title}</span>
                            <span className="block h-1.5 mt-1 rounded-full bg-[#18181B]/10 dark:bg-[#E6E8E6]/10 overflow-hidden">
                              <span className="block h-full rounded-full transition-all duration-500" style={{ width: `${stats.pct}%`, background: project.color || 'var(--accent)' }} />
                            </span>
                          </span>
                          <span className={`shrink-0 text-[10px] font-black tabular-nums ${stats.health === 'late' ? 'text-[#DF2935]' : stats.health === 'risk' ? 'text-[#B8900A] dark:text-[#FDCA40]' : 'text-accent'}`} title={HEALTH_LABEL[stats.health]}>{stats.pct}%</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <CalendarClock size={13} className="text-[#18181B]/40 dark:text-[#E6E8E6]/40" />
                    <input
                      type="date" aria-label="Échéance"
                      className="bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-2 py-1.5 rounded-lg text-[11px] font-bold border border-[#18181B]/5 dark:border-[#E6E8E6]/5 outline-none [color-scheme:dark] text-[#18181B] dark:text-[#E6E8E6]"
                      value={g.targetDate || ''}
                      onChange={(e) => patch(g.id, { targetDate: e.target.value })}
                    />
                  </div>
                  {dLeft !== null && (
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${dLeft < 0 ? 'bg-[#DF2935]/10 text-[#DF2935]' : dLeft <= 7 ? 'bg-[#FDCA40]/10 text-[#FDCA40]' : 'bg-accent/10 text-accent'}`}>
                      {dLeft < 0 ? `${-dLeft}j de retard` : dLeft === 0 ? "aujourd'hui" : `${dLeft}j restants`}
                    </span>
                  )}
                  {appData && (
                    <>
                      <button onClick={() => patch(g.id, { autoProgress: !g.autoProgress })} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${g.autoProgress ? 'bg-accent text-white' : `bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 ${muted} hover:text-accent`}`}>
                        <Wand2 size={12} /> Auto
                      </button>
                      <button onClick={() => setLinking(linking === g.id ? null : g.id)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 ${muted} hover:text-accent`}>
                        <Link2 size={12} /> Relier{nLinks ? ` (${nLinks})` : ''} {linking === g.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </>
                  )}
                </div>

                {/* Étapes (jalons) */}
                {(g.milestones?.length || 0) > 0 && (
                  <ul className="space-y-1">
                    {g.milestones!.map(m => (
                      <li key={m.id} className="flex items-center gap-2 group">
                        <button onClick={() => patch(g.id, { milestones: g.milestones!.map(x => x.id === m.id ? { ...x, done: !x.done } : x) })} aria-label={m.done ? 'Rouvrir l’étape' : 'Marquer l’étape comme atteinte'} className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${m.done ? 'bg-accent border-accent' : 'border-[#18181B]/25 dark:border-[#E6E8E6]/25'}`}>{m.done && <Check size={9} strokeWidth={4} className="text-white" />}</button>
                        <span className={`flex-1 text-[12px] font-semibold ${m.done ? 'line-through opacity-50' : ink}`}>{m.title}</span>
                        {m.date && <span className={`text-[10px] font-bold ${!m.done && m.date < todayKey ? 'text-[#DF2935]' : muted}`}>{new Date(m.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>}
                        <button onClick={() => patch(g.id, { milestones: g.milestones!.filter(x => x.id !== m.id) })} aria-label="Supprimer l’étape" className={`opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-60 p-0.5 hover:text-[#DF2935] ${muted}`}><X size={12} /></button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center gap-1.5">
                  <MilestoneIcon size={13} className={`shrink-0 ${muted}`} />
                  <input value={msDraft[g.id]?.title || ''} onChange={e => setMsDraft(p => ({ ...p, [g.id]: { title: e.target.value, date: p[g.id]?.date || '' } }))}
                    onKeyDown={e => { if (e.key === 'Enter' && msDraft[g.id]?.title?.trim()) { const dd = msDraft[g.id]; patch(g.id, { milestones: [...(g.milestones || []), { id: generateId(), title: dd.title.trim(), date: dd.date || undefined }].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')) }); setMsDraft(p => ({ ...p, [g.id]: { title: '', date: '' } })); } }}
                    placeholder="Ajouter une étape (Entrée)" aria-label="Nouvelle étape" className={`flex-1 min-w-0 bg-transparent text-[12px] font-semibold outline-none ${ink}`} />
                  <input type="date" value={msDraft[g.id]?.date || ''} onChange={e => setMsDraft(p => ({ ...p, [g.id]: { title: p[g.id]?.title || '', date: e.target.value } }))} aria-label="Date de l'étape" className={`bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-1.5 py-1 rounded-lg text-[10px] font-bold outline-none [color-scheme:dark] ${ink}`} />
                </div>
                {onAskClaude && <button onClick={() => onAskClaude(PROMPTS.goalPlan(g.title, g.targetDate))} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-accent"><Sparkles size={12} /> Plan d'action avec Cady</button>}

                {linking === g.id && (
                  <div className="space-y-2 pt-1">
                    <p className={`text-[10px] font-semibold ${muted}`}>Relie un bloc entier ou seulement certaines tâches. La progression automatique compte les tâches reliées faites, sur celles prévues jusqu'à l'échéance.</p>
                    {catalog.length === 0 && <p className={`text-[11px] ${muted}`}>Ton plan ne contient pas encore de bloc.</p>}
                    {catalog.map(b => {
                      const blockOn = (g.linkedBlocks || []).includes(b.title);
                      return (
                        <div key={b.title} className="rounded-xl bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] p-2.5 space-y-1.5">
                          <button onClick={() => patch(g.id, { linkedBlocks: toggleIn(g.linkedBlocks, b.title), autoProgress: true })} className={`flex items-center gap-2 text-[12px] font-black ${blockOn ? 'text-accent' : ink}`}>
                            <span className={`w-4 h-4 rounded-[5px] border-2 flex items-center justify-center ${blockOn ? 'bg-accent border-accent' : 'border-[#18181B]/25 dark:border-[#E6E8E6]/25'}`}>{blockOn && <Check size={10} strokeWidth={4} className="text-white" />}</span>
                            Bloc « {b.title} » en entier
                          </button>
                          {!blockOn && b.tasks.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pl-6">
                              {b.tasks.map(t => {
                                const on = (g.linkedTasks || []).includes(t.id);
                                return <button key={t.id} onClick={() => patch(g.id, { linkedTasks: toggleIn(g.linkedTasks, t.id), autoProgress: true })} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${on ? 'border-accent bg-accent/10 text-accent' : `border-transparent bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 ${ink}`}`}>{t.title}</button>;
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LongTermGoals;
