import React, { useMemo, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Check, Inbox, Target, Sparkles, Trophy, TrendingUp, TrendingDown, CalendarRange } from 'lucide-react';
import type { AppData, Block, RecurringGoal, WeeklyReview } from '../types';
import { computePeriod, computeDay, trackingStart } from '../analytics';
import { pendingOneOffs, relocateTask, sendToInbox, addOneOff } from '../reschedule';
import { getKeyFromDate, generateId, isDateInRange } from '../utils';
import { getWeekKey } from '../streaks';

interface Props {
  appData: AppData;
  update: (fn: (prev: AppData) => AppData) => void;
  onClose: () => void;
  notify: (msg: string) => void;
  saveToHistory: () => void;
}

const ink = 'text-[#18181B] dark:text-[#E6E8E6]';
const muted = 'text-[#18181B]/55 dark:text-[#E6E8E6]/55';
const faint = 'text-[#18181B]/35 dark:text-[#E6E8E6]/35';
const chip = 'px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all';
const soft = `bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 ${ink} hover:text-accent`;
const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const fmtDur = (m: number) => m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ''}` : `${m} min`;

const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d: Date) => { const m = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m; };

// Semaine relue / semaine planifiée : le lundi, on relit la semaine passée et on
// planifie celle qui commence ; les autres jours, on relit la semaine en cours et
// on planifie la suivante.
export function plannerWeeks(now = new Date()) {
  const mon = mondayOf(now);
  const reviewStart = now.getDay() === 1 ? addDays(mon, -7) : mon;
  const planStart = addDays(reviewStart, 7);
  return { reviewStart, reviewEnd: addDays(reviewStart, 6), planStart, planEnd: addDays(planStart, 6), planKey: getWeekKey(planStart) };
}

const WeekPlanner: React.FC<Props> = ({ appData, update, onClose, notify, saveToHistory }) => {
  const [step, setStep] = useState(0);
  const now = new Date();
  const todayKey = getKeyFromDate(now);
  const W = useMemo(() => plannerWeeks(now), [todayKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const reviewKey = getWeekKey(W.reviewStart);
  const planDays = Array.from({ length: 7 }, (_, i) => addDays(W.planStart, i));
  const range = (a: Date, b: Date) => `${a.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${b.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;

  // ---------- Étape 1 : bilan ----------
  const stats = useMemo(() => computePeriod(appData, W.reviewStart, W.reviewEnd, todayKey), [appData, W, todayKey]);
  const blocksAgg = useMemo(() => {
    const m: Record<string, { total: number; done: number }> = {};
    stats.days.filter(d => !d.future).forEach(d => d.blocks.forEach(b => { m[b.title] = m[b.title] || { total: 0, done: 0 }; m[b.title].total += b.total; m[b.title].done += b.done; }));
    const list = Object.entries(m).filter(([, v]) => v.total >= 2).map(([t, v]) => ({ title: t, rate: Math.round((v.done / v.total) * 100) })).sort((a, b) => b.rate - a.rate);
    return { best: list[0], worst: list.length > 1 ? list[list.length - 1] : undefined };
  }, [stats]);
  const existing: Partial<WeeklyReview> = appData.weeklyReviews?.[reviewKey] || {};
  const [wins, setWins] = useState(existing.wins || '');
  const [improve, setImprove] = useState(existing.improve || '');
  const saveReview = () => {
    if (!wins.trim() && !improve.trim()) return;
    update(prev => ({ ...prev, weeklyReviews: { ...(prev.weeklyReviews || {}), [reviewKey]: { ...(prev.weeklyReviews?.[reviewKey] || { createdAt: new Date().toISOString() }), weekKey: reviewKey, wins: wins.trim(), improve: improve.trim() } as WeeklyReview } }));
  };

  // ---------- Étape 2 : pas terminé ----------
  const pending = useMemo(() => {
    const from = getKeyFromDate(W.reviewStart) > trackingStart(appData) ? getKeyFromDate(W.reviewStart) : trackingStart(appData);
    const to = getKeyFromDate(W.reviewEnd) < todayKey ? getKeyFromDate(W.reviewEnd) : todayKey;
    return from <= to ? pendingOneOffs(appData, from, to) : [];
  }, [appData, W, todayKey]);
  const move = (id: string, d: Date) => { saveToHistory(); update(prev => relocateTask(prev, id, getKeyFromDate(d))); };
  const toInbox = (id: string) => { saveToHistory(); update(prev => sendToInbox(prev, id)); };
  const abandon = (id: string, title: string, date: string) => update(prev => ({ ...prev, skips: [...(prev.skips || []), { id: generateId(), taskId: id, taskTitle: title, date, reason: 'Abandonnée (bilan de la semaine)' }] }));

  // ---------- Étape 3 : semaine suivante ----------
  const planStartKey = getKeyFromDate(W.planStart), planEndKey = getKeyFromDate(W.planEnd);
  const weekGoal = (appData.recurringGoals || []).find(g => g.recurrence === 'week' && g.startDate === planStartKey);
  const [goal, setGoal] = useState(weekGoal?.title || '');
  const load = useMemo(() => planDays.map(d => {
    const k = getKeyFromDate(d);
    const st = computeDay(appData, k, todayKey);
    let minutes = 0;
    const src = appData.days[k]?.blocks || appData.blocks;
    src.filter(b => isDateInRange(d, b.recurrence, b.specificDate, b.startDate, b.endDate, b.stopDate))
      .forEach(b => b.tasks.filter(t => isDateInRange(d, t.recurrence, t.specificDate, t.startDate, t.endDate, t.stopDate)).forEach(t => { if (t.startTime) minutes += t.duration || 30; }));
    return { d, k, tasks: st.total, minutes };
  }), [appData, W, todayKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const maxTasks = Math.max(1, ...load.map(l => l.tasks));
  const avg = load.reduce((s, l) => s + l.tasks, 0) / 7;
  const inbox = (appData.inboxTasks || []).filter(t => !t.doneAt);
  const [schedule, setSchedule] = useState<{ id: string; k: string } | null>(null);
  const blocksOn = (k: string): Block[] => { const d = new Date(k + 'T12:00:00'); return (appData.days[k]?.blocks || appData.blocks).filter(b => isDateInRange(d, b.recurrence, b.specificDate, b.startDate, b.endDate, b.stopDate)); };
  const planInbox = (id: string, k: string, blockId?: string) => {
    const t = (appData.inboxTasks || []).find(x => x.id === id); if (!t) return;
    saveToHistory();
    update(prev => ({ ...addOneOff(prev, { ...t }, k, blockId), inboxTasks: (prev.inboxTasks || []).filter(x => x.id !== id) }));
    setSchedule(null);
  };

  const finish = () => {
    saveReview();
    update(prev => {
      let goals = [...(prev.recurringGoals || [])];
      const idx = goals.findIndex(g => g.recurrence === 'week' && g.startDate === planStartKey);
      if (goal.trim()) {
        const g: RecurringGoal = { id: idx >= 0 ? goals[idx].id : generateId(), title: goal.trim(), recurrence: 'week', startDate: planStartKey, endDate: planEndKey };
        if (idx >= 0) goals[idx] = { ...goals[idx], ...g };
        else goals = [g, ...goals]; // l'objectif de la semaine passe avant les objectifs récurrents généraux
      } else if (idx >= 0) goals.splice(idx, 1);
      return { ...prev, recurringGoals: goals, settings: { ...(prev.settings || {}), weekPlanDone: W.planKey } };
    });
    notify('Semaine planifiée. Belle semaine à toi ✨');
    onClose();
  };

  const steps = ['Bilan', 'Pas terminé', 'Semaine prochaine'];
  const bar = (rate: number | null) => rate === null ? 'bg-[#18181B]/10 dark:bg-[#E6E8E6]/10' : rate >= 80 ? 'bg-[#199e70]' : rate >= 50 ? 'bg-[#c98500]' : 'bg-[#e66767]';

  return (
    <div className="fixed inset-0 z-[125] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="glass bg-[#F4F4F5] dark:bg-[#0f0f10] w-full sm:max-w-xl max-h-[94vh] sm:max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl animate-in slide-in-from-bottom-4" role="dialog" aria-label="Planifier ma semaine">
        {/* En-tête + étapes */}
        <div className="p-5 pb-3 space-y-3 border-b border-[#18181B]/5 dark:border-[#E6E8E6]/5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={`text-base font-black flex items-center gap-2 ${ink}`}><Sparkles size={16} className="text-accent" /> Planifier ma semaine</p>
              <p className={`text-[11px] font-semibold ${muted}`}>3 étapes, environ 3 minutes · semaine du {range(W.planStart, W.planEnd)}</p>
            </div>
            <button onClick={onClose} aria-label="Fermer" className={`p-1.5 rounded-full hover:text-accent ${muted}`}><X size={18} /></button>
          </div>
          <div className="flex gap-1.5" role="tablist">
            {steps.map((s, i) => (
              <button key={s} role="tab" aria-selected={step === i} onClick={() => setStep(i)} className="flex-1 text-left">
                <div className={`h-1 rounded-full mb-1.5 transition-all ${i <= step ? 'bg-accent' : 'bg-[#18181B]/10 dark:bg-[#E6E8E6]/10'}`} />
                <p className={`text-[9px] font-black uppercase tracking-widest ${i === step ? 'text-accent' : faint}`}>{i + 1}. {s}{i === 1 && pending.length ? ` (${pending.length})` : ''}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
          {step === 0 && (
            <>
              <p className={`text-[11px] font-black uppercase tracking-widest ${muted}`}>Semaine du {range(W.reviewStart, W.reviewEnd)}</p>
              <div className="flex items-end gap-4">
                <div>
                  <p className={`text-4xl font-black leading-none ${ink}`}>{stats.total ? `${stats.rate} %` : '—'}</p>
                  <p className={`text-[11px] font-semibold mt-1 ${muted}`}>{stats.done} / {stats.total} tâches · {stats.perfectDays} jour{stats.perfectDays > 1 ? 's' : ''} parfait{stats.perfectDays > 1 ? 's' : ''}</p>
                </div>
                {/* Constance jour par jour */}
                <div className="flex-1 flex gap-1.5 h-16" aria-label="Constance par jour">
                  {stats.days.map((d, i) => (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date} · ${d.rate === null ? (d.future ? 'à venir' : 'rien de prévu') : d.rate + ' %'}`}>
                      <div className="w-full flex-1 flex items-end rounded-md bg-[#18181B]/[0.04] dark:bg-[#E6E8E6]/[0.04] overflow-hidden">
                        <div className={`w-full rounded-md ${bar(d.future ? null : d.rate)}`} style={{ height: `${d.future || d.rate === null ? 6 : Math.max(6, d.rate)}%` }} />
                      </div>
                      <span className={`text-[9px] font-black ${faint}`}>{DAYS[i]}</span>
                    </div>
                  ))}
                </div>
              </div>
              {(blocksAgg.best || blocksAgg.worst) && (
                <div className="grid grid-cols-2 gap-2">
                  {blocksAgg.best && <div className="rounded-2xl p-3 bg-[#199e70]/10 border border-[#199e70]/20"><p className="text-[9px] font-black uppercase tracking-widest text-[#199e70] flex items-center gap-1"><TrendingUp size={11} /> Point fort</p><p className={`text-[13px] font-bold truncate ${ink}`}>{blocksAgg.best.title}</p><p className={`text-[10px] font-semibold ${muted}`}>{blocksAgg.best.rate} % accompli</p></div>}
                  {blocksAgg.worst && <div className="rounded-2xl p-3 bg-[#e66767]/10 border border-[#e66767]/20"><p className="text-[9px] font-black uppercase tracking-widest text-[#e66767] flex items-center gap-1"><TrendingDown size={11} /> À renforcer</p><p className={`text-[13px] font-bold truncate ${ink}`}>{blocksAgg.worst.title}</p><p className={`text-[10px] font-semibold ${muted}`}>{blocksAgg.worst.rate} % accompli</p></div>}
                </div>
              )}
              <label className="block space-y-1.5"><span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${muted}`}><Trophy size={12} className="text-[#FDCA40]" /> Ce qui a marché</span>
                <textarea value={wins} onChange={e => setWins(e.target.value)} rows={2} placeholder="Une victoire, même petite…" className={`w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-3.5 py-2.5 rounded-xl text-sm font-medium border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent resize-none ${ink}`} /></label>
              <label className="block space-y-1.5"><span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${muted}`}><TrendingUp size={12} className="text-accent" /> À améliorer</span>
                <textarea value={improve} onChange={e => setImprove(e.target.value)} rows={2} placeholder="Une seule chose à ajuster la semaine prochaine" className={`w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-3.5 py-2.5 rounded-xl text-sm font-medium border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent resize-none ${ink}`} /></label>
              <p className={`text-[10px] font-medium ${faint}`}>Enregistré dans tes bilans de la semaine (Analytics → Bilans).</p>
            </>
          )}

          {step === 1 && (
            pending.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-[#199e70]/15 flex items-center justify-center"><Check size={22} className="text-[#199e70]" /></div>
                <p className={`text-sm font-black ${ink}`}>Rien en attente</p>
                <p className={`text-xs font-semibold ${muted}`}>Toutes tes tâches ponctuelles de la semaine sont faites, reportées ou abandonnées.</p>
              </div>
            ) : (
              <>
                <p className={`text-xs font-semibold ${muted}`}>Pour chaque tâche non faite : choisis un jour de la semaine prochaine, renvoie-la dans la Boîte, ou abandonne-la.</p>
                <ul className="space-y-2">
                  {pending.map(p => (
                    <li key={p.task.id} className="rounded-2xl bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] border border-[#18181B]/5 dark:border-[#E6E8E6]/5 p-3 space-y-2">
                      <div>
                        <p className={`text-[13px] font-bold truncate ${ink}`}>{p.task.title}</p>
                        <p className={`text-[10px] font-semibold ${muted}`}>Prévue le {new Date(p.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })} · {p.blockTitle}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        {planDays.map((d, i) => <button key={i} onClick={() => move(p.task.id, d)} title={d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })} aria-label={`Reporter au ${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })}`} className={`w-8 h-8 rounded-lg text-[10px] font-black ${soft}`}>{DAYS[i]}</button>)}
                        <span className="w-px h-5 bg-[#18181B]/10 dark:bg-[#E6E8E6]/10 mx-1" />
                        <button onClick={() => toInbox(p.task.id)} className={`${chip} ${soft} flex items-center gap-1`}><Inbox size={12} /> Boîte</button>
                        <button onClick={() => abandon(p.task.id, p.task.title, p.date)} className={`${chip} ${muted} hover:text-[#DF2935]`}>Abandonner</button>
                      </div>
                    </li>
                  ))}
                </ul>
                {pending.length > 1 && <button onClick={() => { saveToHistory(); update(prev => pending.reduce((acc, p) => relocateTask(acc, p.task.id, planStartKey), prev)); }} className="w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-accent/10 text-accent hover:bg-accent hover:text-white transition-all">Tout reporter à lundi</button>}
              </>
            )
          )}

          {step === 2 && (
            <>
              <label className="block space-y-1.5"><span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${muted}`}><Target size={12} className="text-accent" /> Objectif de la semaine</span>
                <input value={goal} onChange={e => setGoal(e.target.value)} placeholder="Ex. Terminer le dossier de certification" className={`w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-3.5 py-3 rounded-xl text-sm font-bold border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent ${ink}`} /></label>
              <p className={`text-[10px] font-medium -mt-2 ${faint}`}>Il s'affichera comme objectif prioritaire chaque jour de cette semaine (sauf objectif propre à un jour).</p>

              <div className="space-y-2">
                <p className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${muted}`}><CalendarRange size={12} /> Charge prévue</p>
                <div className="flex gap-2 h-28" aria-label="Charge par jour">
                  {load.map((l, i) => {
                    const heavy = l.tasks > avg * 1.3 && l.tasks >= 4;
                    return (
                      <div key={l.k} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${l.tasks} tâche(s)${l.minutes ? ` · ${fmtDur(l.minutes)} à heure fixe` : ''}`}>
                        <span className={`text-[10px] font-black ${heavy ? 'text-[#e66767]' : ink}`}>{l.tasks}</span>
                        <div className="w-full flex-1 flex items-end rounded-md bg-[#18181B]/[0.04] dark:bg-[#E6E8E6]/[0.04] overflow-hidden">
                          <div className={`w-full rounded-md ${heavy ? 'bg-[#e66767]' : 'bg-accent'}`} style={{ height: `${Math.max(4, (l.tasks / maxTasks) * 100)}%` }} />
                        </div>
                        <span className={`text-[9px] font-black ${faint}`}>{DAYS[i]} {l.d.getDate()}</span>
                      </div>
                    );
                  })}
                </div>
                {load.some(l => l.tasks > avg * 1.3 && l.tasks >= 4) && <p className="text-[10px] font-bold text-[#e66767]">Un ou plusieurs jours sont nettement plus chargés que les autres : pense à répartir.</p>}
              </div>

              {inbox.length > 0 && (
                <div className="space-y-2">
                  <p className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${muted}`}><Inbox size={12} /> Dans ta Boîte ({inbox.length})</p>
                  <ul className="space-y-2">
                    {inbox.slice(0, 12).map(t => (
                      <li key={t.id} className="rounded-2xl bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] border border-[#18181B]/5 dark:border-[#E6E8E6]/5 p-3 space-y-2">
                        <p className={`text-[13px] font-bold truncate ${ink}`}>{t.title}</p>
                        <div className="flex flex-wrap gap-1">
                          {planDays.map((d, i) => { const k = getKeyFromDate(d); const sel = schedule?.id === t.id && schedule.k === k; return <button key={i} onClick={() => setSchedule(sel ? null : { id: t.id, k })} aria-label={`Planifier le ${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })}`} className={`w-8 h-8 rounded-lg text-[10px] font-black ${sel ? 'bg-accent text-white' : soft}`}>{DAYS[i]}</button>; })}
                        </div>
                        {schedule?.id === t.id && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>Dans le bloc</span>
                            {blocksOn(schedule.k).map(b => <button key={b.id} onClick={() => planInbox(t.id, schedule.k, b.id)} className={`${chip} ${soft} normal-case tracking-normal text-[11px]`}>{b.title}</button>)}
                            {blocksOn(schedule.k).length === 0 && <button onClick={() => planInbox(t.id, schedule.k)} className={`${chip} bg-accent text-white`}>Ajouter ce jour-là</button>}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                  {inbox.length > 12 && <p className={`text-[10px] font-medium ${faint}`}>… et {inbox.length - 12} autre(s) dans l'onglet Boîte.</p>}
                </div>
              )}
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="p-4 border-t border-[#18181B]/5 dark:border-[#E6E8E6]/5 flex items-center gap-2">
          {step > 0 ? <button onClick={() => setStep(step - 1)} className={`flex items-center gap-1 px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-wider ${soft}`}><ChevronLeft size={14} /> Retour</button> : <span />}
          <span className="flex-1" />
          {step < 2
            ? <button onClick={() => { if (step === 0) saveReview(); setStep(step + 1); }} className="flex items-center gap-1 px-5 py-3 rounded-2xl bg-accent text-white text-[11px] font-black uppercase tracking-wider shadow-lg shadow-accent/20">Suivant <ChevronRight size={14} /></button>
            : <button onClick={finish} className="flex items-center gap-1.5 px-5 py-3 rounded-2xl bg-accent text-white text-[11px] font-black uppercase tracking-wider shadow-lg shadow-accent/20"><Check size={14} /> Terminer</button>}
        </div>
      </div>
    </div>
  );
};

export default WeekPlanner;
