import React, { useMemo, useState } from 'react';
import { X, Moon, Check, ArrowRight, Minus, ChevronLeft, ChevronRight, Frown, Meh, Smile, Laugh, HandHeart, Trophy, Sparkles, Loader2, Zap, RefreshCw } from 'lucide-react';
import type { AppData, Task, JournalEntry } from '../types';
import { getKeyFromDate, isDateInRange } from '../utils';
import { resolveDay } from '../analytics';
import { executeTool } from '../assistant/tools';

interface Props {
  appData: AppData;
  onFinish: (data: AppData, summary: string) => void;
  onClose: () => void;
  onAskClaude?: () => void;
  /** Analyse gratuite de la journée (Gemini). Absente si l'utilisateur n'est pas connecté. */
  onAnalyze?: (input: DayInput) => Promise<{ feedback: string; focusTomorrow: string } | null>;
  priority?: string;
}

export interface DayInput { tasks: string[]; missed: string[]; postponed: string[]; habits: string[]; performance: number; reflection: string; mood: string; gratitude: string[]; pride: string[]; priority: string }

const ink = 'text-[#18181B] dark:text-[#E6E8E6]';
const muted = 'text-[#18181B]/55 dark:text-[#E6E8E6]/55';
const field = `w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-3.5 py-2.5 rounded-xl text-sm font-medium border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent ${ink}`;
type Choice = 'done' | 'later' | 'leave';
const MOODS = [{ id: 'bad', icon: Frown, label: 'Difficile' }, { id: 'neutral', icon: Meh, label: 'Moyenne' }, { id: 'good', icon: Smile, label: 'Bonne' }, { id: 'great', icon: Laugh, label: 'Excellente' }];

// Bilan du soir en 3 étapes : la journée, le ressenti, le journal
const EveningReview: React.FC<Props> = ({ appData, onFinish, onClose, onAskClaude, onAnalyze, priority = '' }) => {
  const now = new Date();
  const k = getKeyFromDate(now);
  const d = new Date(k + 'T12:00:00');
  const tomorrow = getKeyFromDate(new Date(d.getTime() + 86400000));
  const planIds = useMemo(() => new Set(appData.blocks.flatMap(b => b.tasks.map(t => t.id))), [appData.blocks]);
  const { open, doneCount, doneTitles } = useMemo(() => {
    const skipped = new Set((appData.skips || []).filter(s => s.date === k).map(s => s.taskId));
    const all: { t: Task; block: string }[] = [];
    resolveDay(appData, d).forEach(b => b.tasks.filter(t => isDateInRange(d, t.recurrence, t.specificDate, t.startDate, t.endDate, t.stopDate) && !skipped.has(t.id)).forEach(t => all.push({ t, block: b.title })));
    return { open: all.filter(x => !x.t.completedDates?.includes(k)), doneCount: all.filter(x => x.t.completedDates?.includes(k)).length, doneTitles: all.filter(x => x.t.completedDates?.includes(k)).map(x => x.t.title) };
  }, [appData]); // eslint-disable-line react-hooks/exhaustive-deps

  const [step, setStep] = useState(0);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [mood, setMood] = useState(appData.days[k]?.mood || '');
  const [reflection, setReflection] = useState(appData.days[k]?.reflection || '');
  const je = appData.journal?.[k];
  const [grat, setGrat] = useState<string[]>([0, 1, 2].map(i => je?.gratitude?.[i] || ''));
  const [pride, setPride] = useState<string[]>([0, 1, 2].map(i => je?.pride?.[i] || ''));
  const [ai, setAi] = useState<{ feedback: string; focusTomorrow: string } | null>(appData.days[k]?.aiFeedback || null);
  const [aiBusy, setAiBusy] = useState(false);
  const analyze = async () => {
    if (!onAnalyze || aiBusy) return;
    const pick = (c: Choice) => open.filter(x => choices[x.t.id] === c).map(x => x.t.title);
    const tasks = [...doneTitles, ...pick('done')];
    const total = doneCount + open.length;
    const habits = (appData.habits || []).filter(h => !h.deleted && h.entries?.[k]?.s).map(h => `${h.name} (${h.entries?.[k]?.s === 'done' ? 'tenue' : 'manquée'})`);
    setAiBusy(true);
    const res = await onAnalyze({
      tasks, missed: open.filter(x => !choices[x.t.id] || choices[x.t.id] === 'leave').map(x => x.t.title), postponed: pick('later'), habits,
      performance: total ? Math.round(tasks.length / total * 100) : 0, reflection: reflection.trim(),
      mood: MOODS.find(m => m.id === mood)?.label || '', gratitude: grat.filter(x => x.trim()), pride: pride.filter(x => x.trim()), priority,
    });
    setAiBusy(false);
    if (res?.feedback) setAi(res);
  };
  const oneOff = (t: Task) => t.recurrence === 'specific' || t.recurrence === 'once' || !planIds.has(t.id);

  const finish = () => {
    let data = appData; let done = 0, later = 0;
    const ctx = { now };
    Object.entries(choices).forEach(([id, c]) => {
      const item = open.find(x => x.t.id === id); if (!item) return;
      if (c === 'done') { data = executeTool(data, 'set_task_done', { task_id: id, date: k, done: true }, ctx).data; done++; }
      if (c === 'later') {
        data = executeTool(data, 'reschedule_task', { task_id: id, date: tomorrow }, ctx).data; // récurrente : reportée pour demain, la récurrence continue
        later++;
      }
    });
    const day = data.days[k] || { goalCompleted: false, note: '' };
    data = { ...data, days: { ...data.days, [k]: { ...day, mood: mood || day.mood, reflection: reflection.trim() || day.reflection, ...(ai ? { aiFeedback: ai } : {}) } } };
    if (grat.some(x => x.trim()) || pride.some(x => x.trim())) {
      const entry: JournalEntry = { ...(data.journal?.[k] || {}), gratitude: grat, pride, updatedAt: new Date().toISOString() } as JournalEntry;
      data = { ...data, journal: { ...(data.journal || {}), [k]: entry } };
    }
    data = { ...data, settings: { ...(data.settings || {}), eveningDoneOn: k } };
    onFinish(data, `Bilan du soir enregistré${done ? ` · ${done} cochée${done > 1 ? 's' : ''}` : ''}${later ? ` · ${later} reportée${later > 1 ? 's' : ''}` : ''}. Bonne soirée 🌙`);
  };

  const steps = ['Ma journée', 'Mon ressenti', 'Mon journal'];
  const pill = (active: boolean, color: string) => `flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${active ? `${color} text-white border-transparent` : `bg-transparent border-[#18181B]/10 dark:border-[#E6E8E6]/10 ${muted}`}`;

  return (
    <div className="fixed inset-0 z-[125] bg-black/50 flex items-end sm:items-center justify-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="glass bg-[#F4F4F5] dark:bg-[#0f0f10] w-full sm:max-w-lg max-h-[94vh] flex flex-col rounded-t-3xl sm:rounded-3xl animate-in slide-in-from-bottom-4" role="dialog" aria-label="Bilan du soir">
        <div className="p-5 pb-3 space-y-3 border-b border-[#18181B]/5 dark:border-[#E6E8E6]/5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={`text-base font-black flex items-center gap-2 ${ink}`}><Moon size={16} className="text-accent" /> Bilan du soir</p>
              <p className={`text-[11px] font-semibold ${muted}`}>Trois étapes pour clore la journée l'esprit léger.</p>
            </div>
            <button onClick={onClose} aria-label="Fermer" className={`p-1.5 rounded-full hover:text-accent ${muted}`}><X size={18} /></button>
          </div>
          <div className="flex gap-1.5">
            {steps.map((s, i) => (
              <button key={s} onClick={() => setStep(i)} className="flex-1 text-left">
                <div className={`h-1 rounded-full mb-1.5 ${i <= step ? 'bg-accent' : 'bg-[#18181B]/10 dark:bg-[#E6E8E6]/10'}`} />
                <p className={`text-[9px] font-black uppercase tracking-widest ${i === step ? 'text-accent' : muted}`}>{i + 1}. {s}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-3">
          {step === 0 && (
            <>
              <p className={`text-sm font-black ${ink}`}>{doneCount} tâche{doneCount > 1 ? 's' : ''} faite{doneCount > 1 ? 's' : ''} aujourd'hui 👏</p>
              {open.length === 0 ? <p className={`text-xs font-semibold ${muted}`}>Tout est fait : bravo !</p> : (
                <>
                  <p className={`text-xs font-semibold ${muted}`}>Pour chaque tâche restante : l'as-tu faite ? Sinon, reporte-la ou laisse-la.</p>
                  <ul className="space-y-2">
                    {open.map(({ t, block }) => {
                      const c = choices[t.id];
                      const set = (v: Choice) => setChoices(p => ({ ...p, [t.id]: p[t.id] === v ? undefined as unknown as Choice : v }));
                      return (
                        <li key={t.id} className="rounded-2xl bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] border border-[#18181B]/5 dark:border-[#E6E8E6]/5 p-3 space-y-2">
                          <div><p className={`text-[13px] font-bold ${ink}`}>{t.title}</p><p className={`text-[10px] font-semibold ${muted}`}>{block}{t.startTime ? ` · ${t.startTime}` : ''}</p></div>
                          <div className="flex flex-wrap gap-1.5">
                            <button onClick={() => set('done')} className={pill(c === 'done', 'bg-accent')}><Check size={12} /> Faite</button>
                            <button onClick={() => set('later')} className={pill(c === 'later', 'bg-accent')}><ArrowRight size={12} /> Demain</button>
                            <button onClick={() => set('leave')} className={pill(c === 'leave', 'bg-[#18181B]/60')}><Minus size={12} /> Laisser</button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </>
          )}
          {step === 1 && (
            <>
              <p className={`text-sm font-black ${ink}`}>Comment s'est passée ta journée ?</p>
              <div className="grid grid-cols-4 gap-2">
                {MOODS.map(m => (
                  <button key={m.id} onClick={() => setMood(m.id)} className={`flex flex-col items-center gap-1 py-3 rounded-2xl border transition-all ${mood === m.id ? 'bg-accent text-white border-transparent shadow-lg shadow-accent/20' : `border-[#18181B]/10 dark:border-[#E6E8E6]/10 ${muted}`}`}>
                    <m.icon size={22} /><span className="text-[10px] font-black">{m.label}</span>
                  </button>
                ))}
              </div>
              <label className="block space-y-1.5"><span className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>Ce que je retiens de ma journée</span>
                <textarea rows={4} value={reflection} onChange={e => setReflection(e.target.value)} placeholder="Ce qui a marché, ce qui m'a freinée, ce que je change demain…" className={`${field} resize-none`} /></label>
            </>
          )}
          {step === 2 && (
            <>
              <p className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 text-[#B8900A] dark:text-[#FDCA40]`}><HandHeart size={13} /> 3 gratitudes</p>
              {grat.map((v, i) => <input key={'g' + i} value={v} onChange={e => setGrat(g => g.map((x, j) => j === i ? e.target.value : x))} placeholder={i === 0 ? 'Merci pour…' : ''} aria-label={`Gratitude ${i + 1}`} className={field} />)}
              <p className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 pt-2 text-accent`}><Trophy size={13} /> 3 fiertés</p>
              {pride.map((v, i) => <input key={'p' + i} value={v} onChange={e => setPride(g => g.map((x, j) => j === i ? e.target.value : x))} placeholder={i === 0 ? 'J’ai réussi à…' : ''} aria-label={`Fierté ${i + 1}`} className={field} />)}
              {onAnalyze && (
                <div className="mt-3 rounded-2xl border border-accent/20 bg-accent/[0.06] p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 text-accent`}><Sparkles size={13} /> Analyse de ma journée</p>
                    {ai && !aiBusy && <button onClick={analyze} aria-label="Relancer l'analyse" title="Relancer" className={`p-1 rounded-lg hover:text-accent ${muted}`}><RefreshCw size={13} /></button>}
                  </div>
                  {aiBusy ? <p className={`flex items-center gap-2 text-[12px] font-semibold ${muted}`}><Loader2 size={14} className="animate-spin text-accent" /> Analyse en cours…</p>
                    : ai ? (
                      <>
                        <p className={`text-[13px] font-medium leading-snug ${ink}`}>{ai.feedback}</p>
                        <p className={`text-[12px] font-bold flex items-start gap-2 ${ink}`}><Zap size={14} className="text-[#B8900A] dark:text-[#FDCA40] shrink-0 mt-0.5" /> <span><span className={`block text-[9px] font-black uppercase tracking-widest ${muted}`}>Demain</span>{ai.focusTomorrow}</span></p>
                      </>
                    ) : (
                      <>
                        <p className={`text-[11px] font-semibold ${muted}`}>Un regard extérieur sur ce qui a marché, ce qui a freiné, et une action pour demain.</p>
                        <button onClick={analyze} className="w-full py-2.5 rounded-xl bg-accent text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5"><Sparkles size={13} /> Analyser ma journée</button>
                      </>
                    )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t border-[#18181B]/5 dark:border-[#E6E8E6]/5 flex items-center gap-2">
          {step > 0 ? <button onClick={() => setStep(step - 1)} className={`flex items-center gap-1 px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-wider bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 ${ink}`}><ChevronLeft size={14} /> Retour</button>
            : onAskClaude ? <button onClick={onAskClaude} className={`flex items-center gap-1.5 px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-wider bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 hover:text-accent ${ink}`}><Sparkles size={14} /> Avec Cady</button> : null}
          <span className="flex-1" />
          {step < 2
            ? <button onClick={() => setStep(step + 1)} className="flex items-center gap-1 px-5 py-3 rounded-2xl bg-accent text-white text-[11px] font-black uppercase tracking-wider shadow-lg shadow-accent/20">Suivant <ChevronRight size={14} /></button>
            : <button onClick={finish} className="flex items-center gap-1.5 px-5 py-3 rounded-2xl bg-accent text-white text-[11px] font-black uppercase tracking-wider shadow-lg shadow-accent/20"><Check size={14} /> Terminer</button>}
        </div>
      </div>
    </div>
  );
};

export default EveningReview;
