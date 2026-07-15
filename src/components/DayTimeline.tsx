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

interface PlacedItem extends TimedItem {
  lane: number;
  lanes: number;
}

// Agenda vertical de la journée : place les tâches horodatées sur une timeline 6h → 23h.
// Les tâches qui se chevauchent sont réparties en colonnes côte à côte (algorithme de « lanes »).
const DayTimeline: React.FC<Props> = ({ blocks, currentTime, dateKey }) => {
  const placed = useMemo<PlacedItem[]>(() => {
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

    // Tri par heure de début (puis par fin)
    list.sort((a, b) =>
      a.startMin - b.startMin || (a.startMin + a.duration) - (b.startMin + b.duration)
    );

    // Répartition en couloirs : chaque cluster de tâches qui se chevauchent
    // reçoit N couloirs, chaque tâche occupe 100/N % de largeur.
    const result: PlacedItem[] = [];
    let cluster: PlacedItem[] = [];
    let clusterEnd = -1;
    const laneEnds: number[] = [];

    const flush = () => {
      const lanes = laneEnds.length;
      cluster.forEach((it) => (it.lanes = lanes));
      result.push(...cluster);
      cluster = [];
      laneEnds.length = 0;
    };

    for (const it of list) {
      const end = it.startMin + it.duration;
      if (cluster.length && it.startMin >= clusterEnd) flush();

      let lane = laneEnds.findIndex((e) => e <= it.startMin);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(end);
      } else {
        laneEnds[lane] = end;
      }

      cluster.push({ ...it, lane, lanes: 1 });
      clusterEnd = cluster.length === 1 ? end : Math.max(clusterEnd, end);
    }
    if (cluster.length) flush();

    return result;
  }, [blocks, dateKey]);

  if (placed.length === 0) {
    return (
      <div className="glass p-6 rounded-[2rem]">
        <h2 className="font-black uppercase tracking-wider text-sm mb-2 flex items-center gap-2">
          <Clock size={16} className="text-[#2FB0A6]" /> Agenda du jour
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
        <Clock size={16} className="text-[#2FB0A6]" /> Agenda du jour
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

        {/* Tâches réparties en couloirs */}
        {placed.map(({ task, blockTitle, startMin, duration, done, lane, lanes }) => {
          const top = (startMin - START_H * 60) * PX_PER_MIN;
          const height = Math.max(duration * PX_PER_MIN, 28);
          if (top + height < 0 || top > totalHeight) return null;
          const widthPct = 100 / lanes;
          const gap = 2; // % d'espace entre colonnes
          return (
            <div
              key={task.id}
              className={`absolute rounded-xl px-3 py-1.5 border overflow-hidden transition-all ${
                done
                  ? 'bg-[#22C55E]/10 border-[#22C55E]/25'
                  : 'bg-[#2FB0A6]/10 border-[#2FB0A6]/25'
              }`}
              style={{
                top: Math.max(top, 0),
                height,
                left: `calc(${lane * widthPct}% + 8px)`,
                width: `calc(${widthPct}% - ${gap + (lanes > 1 ? 4 : 8)}px)`,
              }}
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
