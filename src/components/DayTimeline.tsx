import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { Block, Task } from '../types';

interface Props {
  blocks: Block[];
  currentTime: Date;
  dateKey: string;
}

const START_H = 6;
const END_H = 23;
const PX_PER_MIN = 0.9;

interface TimedItem {
  task: Task;
  blockTitle: string;
  startMin: number;
  duration: number;
  done: boolean;
}

// Agenda vertical de la journée : place les tâches horodatées sur une timeline 6h → 23h.
const DayTimeline: React.FC<Props> = ({ blocks, currentTime, dateKey }) => {
  const items = useMemo<TimedItem[]>(() => {
    const list: TimedItem[] = [];
    blocks.forEach((b) => {
      (b.tasks || []).forEach((t) => {
        if (!t.startTime) return;
        const [h, m] = t.startTime.split(':').map(Number);
        list.push({
          task: t,
          blockTitle: b.title,
          startMin: h * 60 + m,
          duration: t.duration || 30,
          done: (t.completedDates || []).includes(dateKey),
        });
      });
    });
    return list.sort((a, b) => a.startMin - b.startMin);
  }, [blocks, dateKey]);

  if (items.length === 0) {
    return (
      <div className="glass p-6 rounded-[2rem]">
        <h2 className="font-black uppercase tracking-wider text-sm mb-2 flex items-center gap-2">
          <Clock size={16} className="text-[#3772FF]" /> Agenda du jour
        </h2>
        <p className="text-xs text-[#18181B]/50 dark:text-[#E6E8E6]/50 font-medium">
          Ajoutez une heure de début à vos tâches pour les voir apparaître sur la timeline.
        </p>
      </div>
    );
  }

  const totalHeight = (END_H - START_H) * 60 * PX_PER_MIN;
  const nowMin = currentTime.getHours() * 60 + currentTime.getMinutes();
  const nowY = (nowMin - START_H * 60) * PX_PER_MIN;
  const showNow = nowMin >= START_H * 60 && nowMin <= END_H * 60;

  return (
    <div className="glass p-6 rounded-[2rem]">
      <h2 className="font-black uppercase tracking-wider text-sm mb-4 flex items-center gap-2">
        <Clock size={16} className="text-[#3772FF]" /> Agenda du jour
      </h2>
      <div className="relative ml-10" style={{ height: totalHeight }}>
        {/* Lignes horaires */}
        {Array.from({ length: END_H - START_H + 1 }, (_, i) => {
          const y = i * 60 * PX_PER_MIN;
          return (
            <div key={i} className="absolute left-0 right-0" style={{ top: y }}>
              <span className="absolute -left-10 -top-2 text-[9px] font-black text-[#18181B]/30 dark:text-[#E6E8E6]/30 tabular-nums">
                {String(START_H + i).padStart(2, '0')}h
              </span>
              <div className="border-t border-[#18181B]/5 dark:border-[#E6E8E6]/5" />
            </div>
          );
        })}

        {/* Curseur "maintenant" */}
        {showNow && (
          <div className="absolute left-0 right-0 z-10 flex items-center" style={{ top: nowY }}>
            <div className="w-2 h-2 rounded-full bg-[#EF4444] -ml-1" />
            <div className="flex-1 border-t-2 border-[#EF4444]" />
          </div>
        )}

        {/* Tâches */}
        {items.map(({ task, blockTitle, startMin, duration, done }) => {
          const top = (startMin - START_H * 60) * PX_PER_MIN;
          const height = Math.max(duration * PX_PER_MIN, 28);
          if (top + height < 0 || top > totalHeight) return null;
          return (
            <div
              key={task.id}
              className={`absolute left-2 right-0 rounded-xl px-3 py-1.5 border overflow-hidden transition-all ${
                done
                  ? 'bg-[#22C55E]/10 border-[#22C55E]/25'
                  : 'bg-[#3772FF]/10 border-[#3772FF]/25'
              }`}
              style={{ top: Math.max(top, 0), height }}
            >
              <p className={`text-[11px] font-black leading-tight truncate ${done ? 'line-through opacity-60' : ''}`}>
                {task.title}
              </p>
              <p className="text-[8px] font-bold uppercase tracking-wider opacity-50 truncate">
                {blockTitle} · {Math.floor(startMin / 60)}h{String(startMin % 60).padStart(2, '0')} · {duration}min
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DayTimeline;
