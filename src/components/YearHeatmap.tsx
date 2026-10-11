import React, { useMemo } from 'react';
import { perfColor } from '../perfScale';
import { Flame } from 'lucide-react';

interface Props {
  history: { date: string; val: number }[];
  streakCount: number;
  days?: number; // fenêtre affichée (par défaut 365)
  title?: string;
  rangeStart?: string; // période fixe (ex. année civile) : AAAA-MM-JJ
  rangeEnd?: string;
}

// Heatmap façon GitHub : un carré par jour, coloré selon la performance.
// La fenêtre (days) est pilotée par le sélecteur de période de l'onglet Analytics.
const YearHeatmap: React.FC<Props> = ({ history, streakCount, days = 365, title = 'Année en un coup d\'œil', rangeStart, rangeEnd }) => {
  const { weeks, monthLabels } = useMemo(() => {
    const perfMap = new Map<string, number>(history.map((h) => [h.date, h.val]));
    const today = new Date();
    const last = rangeEnd ? new Date(rangeEnd + 'T12:00:00') : today;
    const start = rangeStart ? new Date(rangeStart + 'T12:00:00') : new Date(today);
    if (!rangeStart) start.setDate(start.getDate() - (days - 1));
    // Aligner sur un lundi
    while (start.getDay() !== 1) start.setDate(start.getDate() - 1);

    const weeks: { date: string; perf: number | null; future: boolean; outside?: boolean }[][] = [];
    const monthLabels: { index: number; label: string }[] = [];
    const cursor = new Date(start);
    let lastMonth = -1;

    while (cursor <= last || cursor.getDay() !== 1) {
      const weekIndex = weeks.length === 0 ? 0 : weeks.length - (cursor.getDay() === 1 ? 0 : 1);
      if (cursor.getDay() === 1) weeks.push([]);
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      const future = cursor > today;
      weeks[weeks.length - 1].push({
        date: key,
        perf: perfMap.has(key) ? perfMap.get(key)! : null,
        future,
        outside: !!rangeEnd && cursor > last,
      });
      if (cursor.getMonth() !== lastMonth && cursor.getDate() <= 7 && cursor <= last) {
        monthLabels.push({ index: weeks.length - 1, label: cursor.toLocaleDateString('fr-FR', { month: 'short' }) });
        lastMonth = cursor.getMonth();
      }
      cursor.setDate(cursor.getDate() + 1);
      if (weeks.length > 54) break;
    }
    return { weeks, monthLabels };
  }, [history, days, rangeStart, rangeEnd]);

  const colorFor = (perf: number | null, future: boolean) => {
    if (future) return 'transparent';
    if (perf === null) return 'rgba(120,120,128,0.12)';
    return perfColor(perf)!;
  };

  return (
    <div className="glass p-6 rounded-[2rem] space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-black uppercase tracking-wider text-sm">{title}</h2>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#FDCA40]/10 rounded-xl">
          <Flame size={14} className="text-[#FDCA40]" />
          <span className="text-[10px] font-black uppercase tracking-wider text-[#FDCA40]">
            {streakCount} j de série
          </span>
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar pb-2">
        <div className="min-w-[720px]">
          <div className="flex gap-[3px] mb-1 ml-0">
            {weeks.map((_, i) => {
              const label = monthLabels.find((m) => m.index === i);
              return (
                <div key={i} className="w-[11px] text-[8px] font-bold uppercase text-[#18181B]/40 dark:text-[#E6E8E6]/40">
                  {label ? label.label : ''}
                </div>
              );
            })}
          </div>
          <div className="flex gap-[3px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((day) => (
                  <div
                    key={day.date}
                    title={`${new Date(day.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })} — ${day.future ? 'à venir' : day.perf === null ? 'rien de prévu' : day.perf + ' %'}`}
                    className="w-[11px] h-[11px] rounded-[3px]"
                    style={day.outside ? { visibility: 'hidden' } : { backgroundColor: colorFor(day.perf, day.future), boxShadow: day.future ? 'inset 0 0 0 1px rgba(120,120,128,0.18)' : undefined }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1 text-[9px] font-bold uppercase text-[#18181B]/40 dark:text-[#E6E8E6]/40">
        Faible
        {[20, 50, 70, 90].map((p, i) => (
          <div key={i} className="w-[11px] h-[11px] rounded-[3px]" style={{ backgroundColor: colorFor(p, false) }} />
        ))}
        Excellent
      </div>
    </div>
  );
};

export default YearHeatmap;
