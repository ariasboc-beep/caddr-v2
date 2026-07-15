import React, { useMemo } from 'react';
import { Laugh, Smile, Meh, Frown } from 'lucide-react';
import { DayRoutine } from '../types';

interface Props {
  days: { [dateKey: string]: DayRoutine };
  history: { date: string; val: number }[];
}

const MOODS = [
  { key: 'great', label: 'Excellent', Icon: Laugh, color: '#22C55E' },
  { key: 'good', label: 'Bien', Icon: Smile, color: 'var(--accent)' },
  { key: 'neutral', label: 'Neutre', Icon: Meh, color: '#FDCA40' },
  { key: 'bad', label: 'Difficile', Icon: Frown, color: '#EF4444' },
];

// Croise l'humeur du bilan du soir avec la performance du jour.
const MoodPerfChart: React.FC<Props> = ({ days, history }) => {
  const data = useMemo(() => {
    const perfMap = new Map<string, number>(history.map((h) => [h.date, h.val]));
    const buckets: Record<string, { total: number; count: number }> = {};
    (Object.entries(days) as [string, DayRoutine][]).forEach(([key, day]) => {
      if (!day.mood || !perfMap.has(key)) return;
      if (!buckets[day.mood]) buckets[day.mood] = { total: 0, count: 0 };
      buckets[day.mood].total += perfMap.get(key)!;
      buckets[day.mood].count += 1;
    });
    return MOODS.map((m) => ({
      ...m,
      avg: buckets[m.key] ? Math.round(buckets[m.key].total / buckets[m.key].count) : null,
      count: buckets[m.key]?.count || 0,
    }));
  }, [days, history]);

  const hasData = data.some((d) => d.count > 0);

  return (
    <div className="glass p-6 rounded-[2rem] space-y-5">
      <div>
        <h2 className="font-black uppercase tracking-wider text-sm">Humeur × Performance</h2>
        <p className="text-[9px] font-bold uppercase text-[#18181B]/50 dark:text-[#E6E8E6]/50 mt-1">
          Basé sur vos bilans du soir sur la période
        </p>
      </div>

      {!hasData ? (
        <p className="text-xs text-[#18181B]/50 dark:text-[#E6E8E6]/50 font-medium">
          Renseignez votre humeur dans le bilan du soir pour découvrir vos corrélations.
        </p>
      ) : (
        <div className="space-y-3">
          {data.map(({ key, label, Icon, color, avg, count }) => (
            <div key={key} className="flex items-center gap-3">
              <Icon size={20} style={{ color }} className="shrink-0" />
              <div className="flex-1">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-wider mb-1">
                  <span>{label}</span>
                  <span className="text-[#18181B]/50 dark:text-[#E6E8E6]/50">
                    {avg === null ? '—' : `${avg}% · ${count}j`}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${avg || 0}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MoodPerfChart;
