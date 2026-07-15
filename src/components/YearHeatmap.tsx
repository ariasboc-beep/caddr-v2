import React, { useMemo } from 'react';
import { Flame } from 'lucide-react';

interface Props {
  history: { date: string; val: number }[];
  streakCount: number;
  days?: number; // fenêtre affichée (par défaut 365)
  title?: string;
}

// Heatmap façon GitHub : un carré par jour, coloré selon la performance.
// La fenêtre (days) est pilotée par le sélecteur de période de l'onglet Analytics.
const YearHeatmap: React.FC<Props> = ({ history, streakCount, days = 365, title = 'Année en un coup d\'œil' }) => {
  const { weeks, monthLabels } = useMemo(() => {
    const perfMap = new Map<string, number>(history.map((h) => [h.date, h.val]));
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    // Aligner sur un lundi
    while (start.getDay() !== 1) start.setDate(start.getDate() - 1);

    const weeks: { date: string; perf: number | null; future: boolean }[][] = [];
    const monthLabels: { index: number; label: string }[] = [];
    const cursor = new Date(start);
    let lastMonth = -1;

    while (cursor <= today || cursor.getDay() !== 1) {
      const weekIndex = weeks.length === 0 ? 0 : weeks.length - (cursor.getDay() === 1 ? 0 : 1);
      if (cursor.getDay() === 1) weeks.push([]);
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      const future = cursor > today;
      weeks[weeks.length - 1].push({
        date: key,
        perf: perfMap.has(key) ? perfMap.get(key)! : null,
        future,
      });
      if (cursor.getMonth() !== lastMonth && cursor.getDate() <= 7 && !future) {
        monthLabels.push({ index: weeks.length - 1, label: cursor.toLocaleDateString('fr-FR', { month: 'short' }) });
        lastMonth = cursor.getMonth();
      }
      cursor.setDate(cursor.getDate() + 1);
      if (weeks.length > 54) break;
    }
    return { weeks, monthLabels };
  }, [history, days]);

  const colorFor = (perf: number | null, future: boolean) => {
    if (future) return 'transparent';
    if (perf === null || perf === 0) return 'rgba(120,120,128,0.12)';
    if (perf < 34) return 'rgba(47, 176, 166,0.25)';
    if (perf < 67) return 'rgba(47, 176, 166,0.55)';
    if (perf < 100) return 'rgba(47, 176, 166,0.8)';
    return '#2FB0A6';
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
                    title={day.future ? '' : `${day.date} — ${day.perf === null ? 'aucune donnée' : day.perf + '%'}`}
                    className="w-[11px] h-[11px] rounded-[3px]"
                    style={{ backgroundColor: colorFor(day.perf, day.future) }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1 text-[9px] font-bold uppercase text-[#18181B]/40 dark:text-[#E6E8E6]/40">
        Moins
        {[null, 20, 50, 80, 100].map((p, i) => (
          <div key={i} className="w-[11px] h-[11px] rounded-[3px]" style={{ backgroundColor: colorFor(p, false) }} />
        ))}
        Plus
      </div>
    </div>
  );
};

export default YearHeatmap;
