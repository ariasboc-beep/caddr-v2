import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, Loader2, Check, History } from 'lucide-react';
import { AppData, WeeklyReview as Review } from '../types';
import { getKeyFromDate } from '../utils';
import { getWeekKey } from '../streaks';
import { computePeriod, getPeriod, shiftAnchor } from '../analytics';
import RichText from './RichText';

type Kind = 'week' | 'month';

interface Props {
  appData: AppData;
  onSave: (kind: Kind, r: Review) => void;
  onGenerate: (summary: string) => Promise<{ feedback: string; focusNextWeek: string } | null>;
}

const ink = 'text-[#18181B] dark:text-[#E6E8E6]';
const muted = 'text-[#18181B]/50 dark:text-[#E6E8E6]/50';
const stripHtml = (h?: string) => (h || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const keyFor = (kind: Kind, d: Date) => kind === 'week' ? getWeekKey(d) : getKeyFromDate(d).slice(0, 7);

// Retrouve le lundi d'une clé ISO « 2026-W41 » (pour naviguer vers un bilan passé)
const mondayOfWeekKey = (k: string): Date => {
  const [y, w] = k.split('-W').map(Number);
  const jan4 = new Date(y, 0, 4, 12);
  const mon = new Date(jan4); mon.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (w - 1) * 7);
  return mon;
};

const Editor: React.FC<{
  kind: Kind; reviewKey: string; review?: Review; summary: string;
  onSave: (r: Review) => void; onGenerate: Props['onGenerate'];
}> = ({ kind, reviewKey, review, summary, onSave, onGenerate }) => {
  const [wins, setWins] = useState(review?.wins || '');
  const [improve, setImprove] = useState(review?.improve || '');
  const [ai, setAi] = useState(review?.aiFeedback);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const noun = kind === 'week' ? 'semaine' : 'mois';

  const persist = (extra: Partial<Review> = {}) => {
    onSave({ weekKey: reviewKey, wins, improve, reflection: '', aiFeedback: ai, createdAt: review?.createdAt || new Date().toISOString(), ...extra });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const generate = async () => {
    setLoading(true);
    const res = await onGenerate(`${summary} Réussites : ${stripHtml(wins) || 'non précisé'}. À améliorer : ${stripHtml(improve) || 'non précisé'}.`);
    setLoading(false);
    if (res) { setAi(res); persist({ aiFeedback: res }); }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>Ce qui a marché</label>
        <RichText minHeight={90} value={wins} onChange={setWins} onBlur={() => persist()} placeholder={`Tes réussites de ce ${noun}…`} />
      </div>
      <div className="space-y-2">
        <label className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>À améliorer {kind === 'week' ? 'la semaine prochaine' : 'le mois prochain'}</label>
        <RichText minHeight={90} value={improve} onChange={setImprove} onBlur={() => persist()} placeholder="Ce qui a décroché, ce que tu changes…" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => persist()} className="px-5 py-3 rounded-2xl bg-accent text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-accent/20 active:scale-95 transition-all">Enregistrer</button>
        <button onClick={generate} disabled={loading} className={`flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[10px] font-black uppercase tracking-widest ${ink} hover:text-accent disabled:opacity-50`}>
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {ai ? 'Regénérer l’analyse IA' : 'Analyse IA'}
        </button>
        {saved && <span className="text-[9px] font-black text-accent uppercase tracking-widest flex items-center gap-1"><Check size={11} /> Enregistré</span>}
      </div>
      {ai && (
        <div className="grid sm:grid-cols-2 gap-3 animate-in fade-in">
          <div className="p-4 bg-accent/10 rounded-2xl border border-accent/15">
            <p className="text-[8px] font-black text-accent uppercase tracking-widest mb-1">Analyse</p>
            <p className={`text-xs font-medium ${ink}`}>{ai.feedback}</p>
          </div>
          <div className="p-4 bg-accent/5 rounded-2xl border border-accent/15">
            <p className="text-[8px] font-black text-accent uppercase tracking-widest mb-1">Focus {kind === 'week' ? 'semaine prochaine' : 'mois prochain'}</p>
            <p className={`text-xs font-bold ${ink}`}>{ai.focusNextWeek}</p>
          </div>
        </div>
      )}
    </div>
  );
};

const Reviews: React.FC<Props> = ({ appData, onSave, onGenerate }) => {
  const [kind, setKind] = useState<Kind>('week');
  const [anchor, setAnchor] = useState<Date>(new Date());
  const todayKey = getKeyFromDate(new Date());
  const period = useMemo(() => getPeriod(kind, anchor), [kind, anchor]);
  const reviewKey = keyFor(kind, period.start);
  const store: Record<string, Review> = (kind === 'week' ? appData.weeklyReviews : appData.monthlyReviews) || {};
  const review = store[reviewKey];
  const stats = useMemo(() => computePeriod(appData, period.start, period.end, todayKey), [appData, period, todayKey]);
  const isCurrent = reviewKey === keyFor(kind, new Date());
  const canNext = getKeyFromDate(shiftAnchor(kind, period.start, 1)) <= todayKey;

  const summary = `Bilan ${kind === 'week' ? 'de la semaine' : 'du mois'} (${period.label}) : taux de réalisation ${stats.rate ?? 0} %, ${stats.perfectDays} journées parfaites sur ${stats.activeDays}, ${stats.done} tâches faites sur ${stats.total}.`;

  // Bilans enregistrés (non vides), du plus récent au plus ancien
  const history: [string, Review][] = Object.entries(store)
    .filter(([, r]) => stripHtml(r.wins) || stripHtml(r.improve) || r.aiFeedback)
    .sort(([a], [b]) => b.localeCompare(a));

  const labelOf = (k: string) => {
    if (kind === 'month') { const s = new Date(k + '-01T12:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); }
    const mon = mondayOfWeekKey(k); const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return `${mon.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${sun.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
  };
  const goTo = (k: string) => setAnchor(kind === 'week' ? mondayOfWeekKey(k) : new Date(k + '-01T12:00:00'));

  return (
    <div className="space-y-5">
      {/* Semaine / Mois */}
      <div className="flex p-1 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-2xl w-full sm:w-72">
        {(['week', 'month'] as Kind[]).map(k => (
          <button key={k} onClick={() => { setKind(k); setAnchor(new Date()); }} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${kind === k ? 'bg-accent text-white shadow-lg shadow-accent/20' : muted}`}>
            Bilan {k === 'week' ? 'de la semaine' : 'du mois'}
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-2">
        <button onClick={() => setAnchor(shiftAnchor(kind, period.start, -1))} aria-label="Précédent" className={`p-2 rounded-xl hover:bg-accent/10 hover:text-accent ${muted}`}><ChevronLeft size={18} /></button>
        <div className="flex-1 text-center">
          <p className={`text-sm font-black ${ink}`}>{period.label}</p>
          <p className={`text-[10px] font-bold ${muted}`}>{isCurrent ? 'En cours' : review ? 'Bilan enregistré' : 'Pas encore de bilan'}</p>
        </div>
        <button onClick={() => canNext && setAnchor(shiftAnchor(kind, period.start, 1))} disabled={!canNext} aria-label="Suivant" className={`p-2 rounded-xl ${canNext ? `hover:bg-accent/10 hover:text-accent ${muted}` : 'opacity-20 cursor-not-allowed'}`}><ChevronRight size={18} /></button>
        {!isCurrent && <button onClick={() => setAnchor(new Date())} className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider text-accent bg-accent/10 hover:bg-accent hover:text-white transition-all">Actuel</button>}
      </div>

      {/* Chiffres de la période */}
      <div className="grid grid-cols-3 gap-2">
        {[{ v: stats.rate === null ? '—' : `${stats.rate} %`, l: 'Réalisation' }, { v: `${stats.perfectDays}/${stats.activeDays}`, l: 'Jours parfaits' }, { v: `${stats.done}/${stats.total}`, l: 'Tâches faites' }].map(s => (
          <div key={s.l} className="text-center p-3 rounded-2xl bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] border border-[#18181B]/5 dark:border-[#E6E8E6]/5">
            <p className={`text-lg font-black tabular-nums ${ink}`}>{s.v}</p>
            <p className={`text-[8px] font-black uppercase tracking-widest ${muted}`}>{s.l}</p>
          </div>
        ))}
      </div>

      <Editor key={`${kind}-${reviewKey}`} kind={kind} reviewKey={reviewKey} review={review} summary={summary} onSave={(r) => onSave(kind, r)} onGenerate={onGenerate} />

      {/* Bilans précédents */}
      <div className="pt-2 space-y-2">
        <p className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest ${muted}`}><History size={12} /> Bilans {kind === 'week' ? 'des semaines' : 'des mois'} précédents</p>
        {history.length === 0 ? (
          <p className={`text-[11px] font-medium ${muted}`}>Aucun bilan enregistré pour l'instant. Ceux que tu remplis restent ici, même quand une nouvelle {kind === 'week' ? 'semaine' : 'période'} commence.</p>
        ) : (
          <div className="space-y-2">
            {history.map(([k, r]) => (
              <button key={k} onClick={() => goTo(k)}
                className={`w-full text-left p-3 rounded-2xl border transition-all ${k === reviewKey ? 'border-accent bg-accent/10' : 'border-[#18181B]/5 dark:border-[#E6E8E6]/5 bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] hover:border-accent/50'}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-[11px] font-black ${ink}`}>{kind === 'week' ? `Semaine ${k.split('-W')[1]} · ` : ''}{labelOf(k)}</span>
                  {r.aiFeedback && <Sparkles size={11} className="text-accent shrink-0" />}
                </div>
                <p className={`text-[11px] font-medium mt-0.5 line-clamp-1 ${muted}`}>{stripHtml(r.wins) || stripHtml(r.improve) || r.aiFeedback?.feedback}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Reviews;
