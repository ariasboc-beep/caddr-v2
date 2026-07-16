import React, { useMemo } from 'react';
import { Flame, Target } from 'lucide-react';
import { Block, Task } from '../types';
import { computeHabitStreak } from '../streaks';

interface Props {
  blocks: Block[];
}

const REPEATING = new Set(['daily', 'weekdays', 'weekends', 'week', 'period']);

// Liste toutes les habitudes récurrentes avec leur série et leur régularité.
const HabitStreaks: React.FC<Props> = ({ blocks }) => {
  const habits = useMemo(() => {
    const list: { task: Task; blockTitle: string }[] = [];
    blocks.forEach((b) => {
      (b.tasks || []).forEach((t) => {
        if (REPEATING.has(t.recurrence)) list.push({ task: t, blockTitle: b.title });
      });
    });
    return list
      .map(({ task, blockTitle }) => ({ task, blockTitle, streak: computeHabitStreak(task) }))
      .sort((a, b) => b.streak.current - a.streak.current);
  }, [blocks]);

  if (habits.length === 0) {
    return (
      <div className="glass p-6 rounded-[2rem]">
        <h2 className="font-black uppercase tracking-wider text-sm flex items-center gap-2"><Flame size={16} className="text-accent" /> Séries par habitude</h2>
        <p className="text-xs text-[#18181B]/50 dark:text-[#E6E8E6]/50 font-medium mt-2">Aucune habitude récurrente pour l'instant.</p>
      </div>
    );
  }

  return (
    <div className="glass p-6 rounded-[2rem] space-y-4">
      <h2 className="font-black uppercase tracking-wider text-sm flex items-center gap-2"><Flame size={16} className="text-accent" /> Séries par habitude</h2>
      <div className="space-y-2">
        {habits.map(({ task, blockTitle, streak }) => (
          <div key={task.id} className="flex items-center gap-3 p-3 rounded-2xl bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03]">
            <div className="flex items-center gap-1.5 w-14 shrink-0">
              <Flame size={16} className={streak.current > 0 ? 'text-[#FDCA40]' : 'text-[#18181B]/25 dark:text-[#E6E8E6]/25'} />
              <span className="text-sm font-black tabular-nums text-[#18181B] dark:text-[#E6E8E6]">{streak.current}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#18181B] dark:text-[#E6E8E6] truncate">{task.title}</p>
              <p className="text-[8px] font-black uppercase tracking-widest text-[#18181B]/40 dark:text-[#E6E8E6]/40 truncate">{blockTitle}</p>
            </div>
            <div className="text-right shrink-0">
              <div className="flex items-center gap-1 justify-end text-[9px] font-black text-[#18181B]/50 dark:text-[#E6E8E6]/50 uppercase">
                <Target size={9} /> record {streak.best}
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <div className="w-16 h-1.5 rounded-full bg-[#18181B]/10 dark:bg-[#E6E8E6]/10 overflow-hidden">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${streak.rate30}%` }} />
                </div>
                <span className="text-[9px] font-black text-accent tabular-nums w-8">{streak.rate30}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[9px] font-medium text-[#18181B]/40 dark:text-[#E6E8E6]/40">Barre = régularité sur 30 jours. 🔥 = série en cours.</p>
    </div>
  );
};

export default HabitStreaks;
