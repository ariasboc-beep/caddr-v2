import React, { useState } from 'react';
import { CalendarRange, Sparkles, Loader2, Check } from 'lucide-react';
import { WeeklyReview as WReview } from '../types';
import RichText from './RichText';

interface Props {
  weekKey: string;
  review?: WReview;
  stats: { avg: number; perfectDays: number; totalDone: number };
  onSave: (r: WReview) => void;
  onGenerate: (summary: string) => Promise<{ feedback: string; focusNextWeek: string } | null>;
}

const WeeklyReview: React.FC<Props> = ({ weekKey, review, stats, onSave, onGenerate }) => {
  const [wins, setWins] = useState(review?.wins || '');
  const [improve, setImprove] = useState(review?.improve || '');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ai, setAi] = useState(review?.aiFeedback);

  const persist = (extra: Partial<WReview> = {}) => {
    onSave({ weekKey, wins, improve, reflection: '', aiFeedback: ai, createdAt: new Date().toISOString(), ...extra });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const generate = async () => {
    setLoading(true);
    const summary = `Bilan de la semaine — constance moyenne ${stats.avg}%, ${stats.perfectDays} journées parfaites, ${stats.totalDone} tâches complétées. Réussites: ${wins || 'non précisé'}. À améliorer: ${improve || 'non précisé'}.`;
    const res = await onGenerate(summary);
    setLoading(false);
    if (res) {
      setAi(res);
      persist({ aiFeedback: res });
    }
  };

  const inputCls = 'w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 p-3 rounded-2xl text-xs font-medium border border-[#18181B]/5 dark:border-[#E6E8E6]/5 outline-none focus:border-accent text-[#18181B] dark:text-[#E6E8E6] resize-none';

  return (
    <div className="glass p-6 rounded-[2rem] space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-black uppercase tracking-wider text-sm flex items-center gap-2"><CalendarRange size={16} className="text-accent" /> Revue de la semaine</h2>
        <span className="text-[9px] font-black uppercase tracking-widest text-[#18181B]/40 dark:text-[#E6E8E6]/40">{weekKey}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[{ v: `${stats.avg}%`, l: 'Constance' }, { v: stats.perfectDays, l: 'Jours parfaits' }, { v: stats.totalDone, l: 'Tâches' }].map((s) => (
          <div key={s.l} className="text-center p-3 rounded-2xl bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03]">
            <p className="text-lg font-black text-[#18181B] dark:text-[#E6E8E6] tabular-nums">{s.v}</p>
            <p className="text-[8px] font-black uppercase tracking-widest text-[#18181B]/40 dark:text-[#E6E8E6]/40">{s.l}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <label className="text-[9px] font-black uppercase tracking-widest text-[#18181B]/50 dark:text-[#E6E8E6]/50">Ce qui a marché</label>
        <RichText minHeight={100} value={wins} onChange={setWins} onBlur={() => persist()} placeholder="Vos réussites de la semaine..." />
      </div>
      <div className="space-y-2">
        <label className="text-[9px] font-black uppercase tracking-widest text-[#18181B]/50 dark:text-[#E6E8E6]/50">À améliorer la semaine prochaine</label>
        <RichText minHeight={100} value={improve} onChange={setImprove} onBlur={() => persist()} placeholder="Ce qui a décroché..." />
      </div>

      <button onClick={generate} disabled={loading} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#18181B] dark:bg-[#E6E8E6] text-white dark:text-[#080708] text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {ai ? 'Regénérer le bilan IA' : 'Bilan IA de la semaine'}
      </button>

      {ai && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
          <div className="p-4 bg-accent/10 rounded-2xl border border-accent/10">
            <p className="text-[8px] font-black text-accent uppercase tracking-widest mb-1">Analyse</p>
            <p className="text-xs font-medium text-[#18181B] dark:text-[#E6E8E6]">{ai.feedback}</p>
          </div>
          <div className="p-4 bg-[#FDCA40]/10 rounded-2xl border border-[#FDCA40]/10">
            <p className="text-[8px] font-black text-[#FDCA40] uppercase tracking-widest mb-1">Focus semaine prochaine</p>
            <p className="text-xs font-bold text-[#18181B] dark:text-[#E6E8E6]">{ai.focusNextWeek}</p>
          </div>
        </div>
      )}

      {saved && <p className="text-[9px] font-black text-accent uppercase tracking-widest flex items-center gap-1"><Check size={11} /> Enregistré</p>}
    </div>
  );
};

export default WeeklyReview;
