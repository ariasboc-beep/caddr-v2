import React, { useMemo } from 'react';
import { Sparkles, Flame, CheckCircle2, Timer, Award } from 'lucide-react';
import { AppData } from '../types';
import { computeHabitStreak } from '../streaks';

interface Props {
  appData: AppData;
  history: { date: string; val: number }[];
}

// Rétrospective annuelle motivante à partir des données existantes.
const AnnualReview: React.FC<Props> = ({ appData, history }) => {
  const data = useMemo(() => {
    const year = new Date().getFullYear();
    const yearHistory = history.filter((h) => h.date.startsWith(String(year)));
    const perfectDays = yearHistory.filter((h) => h.val === 100).length;
    const activeDays = yearHistory.filter((h) => h.val > 0).length;
    const avg = yearHistory.length ? Math.round(yearHistory.reduce((s, h) => s + h.val, 0) / yearHistory.length) : 0;

    // Habitude la mieux tenue
    let bestHabit = { title: '—', best: 0 };
    appData.blocks.forEach((b) => (b.tasks || []).forEach((t) => {
      const s = computeHabitStreak(t);
      if (s.best > bestHabit.best) bestHabit = { title: t.title, best: s.best };
    }));

    const focusMin = (appData.focusSessions || [])
      .filter((s) => s.date.startsWith(String(year)))
      .reduce((sum, s) => sum + s.durationMin, 0);

    return { year, perfectDays, activeDays, avg, bestHabit, focusHours: Math.round(focusMin / 60) };
  }, [appData, history]);

  if (data.activeDays < 3) return null; // Pas assez de données pour un bilan

  const cards = [
    { Icon: CheckCircle2, val: data.perfectDays, label: 'Journées parfaites', color: 'text-accent', bg: 'bg-accent/10' },
    { Icon: Flame, val: `${data.bestHabit.best}j`, label: `Record : ${data.bestHabit.title}`, color: 'text-[#FDCA40]', bg: 'bg-[#FDCA40]/10' },
    { Icon: Award, val: `${data.avg}%`, label: 'Constance moyenne', color: 'text-accent', bg: 'bg-accent/10' },
    { Icon: Timer, val: `${data.focusHours}h`, label: 'Concentration', color: 'text-[#FDCA40]', bg: 'bg-[#FDCA40]/10' },
  ];

  return (
    <div className="glass p-6 rounded-[2rem] space-y-5 border border-accent/20">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-accent" />
        <h2 className="font-black uppercase tracking-wider text-sm">Votre année {data.year}</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c, i) => (
          <div key={i} className={`p-4 rounded-2xl ${c.bg} flex flex-col gap-1`}>
            <c.Icon size={18} className={c.color} />
            <span className="text-2xl font-black text-[#18181B] dark:text-[#E6E8E6] tabular-nums">{c.val}</span>
            <span className="text-[8px] font-black uppercase tracking-widest text-[#18181B]/50 dark:text-[#E6E8E6]/50 truncate">{c.label}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] font-medium text-[#18181B]/50 dark:text-[#E6E8E6]/50 text-center">
        {data.activeDays} jours d'activité cette année. Chaque jour compte. 🌱
      </p>
    </div>
  );
};

export default AnnualReview;
