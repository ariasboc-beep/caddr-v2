import React, { useMemo } from 'react';
import { Lightbulb } from 'lucide-react';
import { DayRoutine } from '../types';

interface Props {
  history: { date: string; val: number }[];
  days: { [k: string]: DayRoutine };
  blockStats: { title: string; rate: number }[];
}

const DOW = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOOD_LABEL: Record<string, string> = { great: 'excellente', good: 'bonne', neutral: 'neutre', bad: 'difficile' };

// Observations générées à partir des données, sans appel IA (fiable et instantané).
const Insights: React.FC<Props> = ({ history, days, blockStats }) => {
  const insights = useMemo(() => {
    const out: string[] = [];

    // 1. Meilleur / pire jour de la semaine
    const byDow: Record<number, { sum: number; n: number }> = {};
    history.forEach((h) => {
      const d = new Date(h.date + 'T00:00:00');
      const k = d.getDay();
      if (!byDow[k]) byDow[k] = { sum: 0, n: 0 };
      byDow[k].sum += h.val; byDow[k].n++;
    });
    const dowAvg = Object.entries(byDow).filter(([, v]) => v.n >= 2).map(([k, v]) => ({ k: +k, avg: v.sum / v.n }));
    if (dowAvg.length >= 3) {
      const best = dowAvg.reduce((a, b) => (b.avg > a.avg ? b : a));
      const worst = dowAvg.reduce((a, b) => (b.avg < a.avg ? b : a));
      if (best.k !== worst.k) {
        out.push(`Vous êtes le plus constant le **${DOW[best.k]}** (${Math.round(best.avg)}%) et le moins le **${DOW[worst.k]}** (${Math.round(worst.avg)}%).`);
      }
    }

    // 2. Bloc le plus faible
    if (blockStats.length >= 2) {
      const weak = blockStats.reduce((a, b) => (b.rate < a.rate ? b : a));
      if (weak.rate < 70) out.push(`Votre bloc **${weak.title}** décroche (${weak.rate}% de régularité) — un point à renforcer.`);
    }

    // 3. Corrélation humeur
    const moodPerf: Record<string, { sum: number; n: number }> = {};
    const perfMap = new Map(history.map((h) => [h.date, h.val]));
    Object.entries(days).forEach(([key, day]) => {
      if (day.mood && perfMap.has(key)) {
        if (!moodPerf[day.mood]) moodPerf[day.mood] = { sum: 0, n: 0 };
        moodPerf[day.mood].sum += perfMap.get(key)!; moodPerf[day.mood].n++;
      }
    });
    const moods = Object.entries(moodPerf).filter(([, v]) => v.n >= 2);
    if (moods.length >= 2) {
      const best = moods.reduce((a, b) => (b[1].sum / b[1].n > a[1].sum / a[1].n ? b : a));
      out.push(`Vos journées d'humeur **${MOOD_LABEL[best[0]] || best[0]}** affichent en moyenne ${Math.round(best[1].sum / best[1].n)}% de complétion.`);
    }

    // 4. Tendance récente (14 derniers jours vs 14 précédents)
    const sorted = [...history].sort((a, b) => (a.date < b.date ? -1 : 1));
    if (sorted.length >= 20) {
      const last14 = sorted.slice(-14);
      const prev14 = sorted.slice(-28, -14);
      const avg = (arr: typeof sorted) => arr.reduce((s, x) => s + x.val, 0) / (arr.length || 1);
      const diff = Math.round(avg(last14) - avg(prev14));
      if (Math.abs(diff) >= 5) {
        out.push(diff > 0
          ? `Tendance positive : +${diff} points de constance sur les 2 dernières semaines. 📈`
          : `Attention : ${diff} points de constance sur les 2 dernières semaines. 📉`);
      }
    }

    return out;
  }, [history, days, blockStats]);

  if (insights.length === 0) return null;

  const renderBold = (t: string) =>
    t.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') ? <strong key={i} className="text-[#18181B] dark:text-[#E6E8E6]">{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>
    );

  return (
    <div className="glass p-6 rounded-[2rem] space-y-3">
      <h2 className="font-black uppercase tracking-wider text-sm flex items-center gap-2"><Lightbulb size={16} className="text-accent" /> Observations</h2>
      <div className="space-y-2">
        {insights.map((t, i) => (
          <div key={i} className="flex gap-2 text-xs font-medium text-[#18181B]/70 dark:text-[#E6E8E6]/70 p-3 rounded-2xl bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03]">
            <span className="text-accent shrink-0">›</span>
            <span>{renderBold(t)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Insights;
