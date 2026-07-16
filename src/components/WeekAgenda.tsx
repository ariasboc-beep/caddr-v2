import React, { useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, closestCenter, DragStartEvent, DragEndEvent,
} from '@dnd-kit/core';
import { CalendarRange, GripVertical } from 'lucide-react';
import { AppData, Block } from '../types';
import { getKeyFromDate, isDateInRange } from '../utils';

interface Props {
  appData: AppData;
  currentTime: Date;
  onReschedule: (taskId: string, targetDateKey: string, startTime: string) => void;
}

const START_H = 6;
const END_H = 23;
const PX_PER_MIN = 0.6;
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

interface Item { taskId: string; chipId: string; title: string; startMin: number; duration: number; done: boolean; }

// Cellule horaire (zone de dépôt)
const HourCell: React.FC<{ id: string; top: number; height: number }> = ({ id, top, height }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} className={`absolute left-0 right-0 ${isOver ? 'bg-accent/20' : ''}`} style={{ top, height }} />;
};

// Chip de tâche (déplaçable)
const Chip: React.FC<{ item: Item; top: number; height: number }> = ({ item, top, height }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.chipId });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      title={`${item.title} — ${Math.floor(item.startMin / 60)}h${String(item.startMin % 60).padStart(2, '0')}`}
      className={`absolute left-0.5 right-0.5 rounded-md px-1 py-0.5 overflow-hidden border cursor-grab active:cursor-grabbing touch-none ${item.done ? 'bg-[#22C55E]/10 border-[#22C55E]/25' : 'bg-accent/10 border-accent/25'} ${isDragging ? 'opacity-30' : ''}`}
      style={{ top: Math.max(top, 0), height }}
    >
      <p className={`text-[8px] font-black leading-none truncate ${item.done ? 'line-through opacity-60' : ''}`}>{item.title}</p>
    </div>
  );
};

const WeekAgenda: React.FC<Props> = ({ appData, currentTime, onReschedule }) => {
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const week = useMemo(() => {
    const monday = new Date();
    monday.setHours(0, 0, 0, 0);
    const dow = monday.getDay() || 7;
    monday.setDate(monday.getDate() - (dow - 1));

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(date.getDate() + i);
      const key = getKeyFromDate(date);
      const blocks: Block[] = appData.days[key]?.blocks
        ? appData.days[key].blocks!
        : appData.blocks.filter((b) => isDateInRange(date, b.recurrence, b.specificDate, b.startDate, b.endDate));

      const items: Item[] = [];
      blocks.forEach((b) => {
        (b.tasks || []).forEach((t) => {
          if (!t.startTime || !isDateInRange(date, t.recurrence, t.specificDate, t.startDate, t.endDate)) return;
          const [h, m] = t.startTime.split(':').map(Number);
          items.push({ taskId: t.id, chipId: `${t.id}__${key}`, title: t.title, startMin: h * 60 + m, duration: t.duration || 30, done: (t.completedDates || []).includes(key) });
        });
      });
      return { date, key, items };
    });
  }, [appData]);

  const totalHeight = (END_H - START_H) * 60 * PX_PER_MIN;
  const todayKey = getKeyFromDate(new Date());
  const nowMin = currentTime.getHours() * 60 + currentTime.getMinutes();
  const nowY = (nowMin - START_H * 60) * PX_PER_MIN;
  const showNow = nowMin >= START_H * 60 && nowMin <= END_H * 60;

  const onDragStart = (e: DragStartEvent) => {
    for (const d of week) {
      const it = d.items.find((x) => x.chipId === e.active.id);
      if (it) { setActiveItem(it); return; }
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveItem(null);
    if (!e.over) return;
    const [taskId] = String(e.active.id).split('__');
    const [targetDateKey, hourStr] = String(e.over.id).split('##');
    if (!targetDateKey || hourStr === undefined) return;
    const startTime = `${String(parseInt(hourStr)).padStart(2, '0')}:00`;
    onReschedule(taskId, targetDateKey, startTime);
  };

  return (
    <div className="glass p-6 rounded-[2rem]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-black uppercase tracking-wider text-sm flex items-center gap-2"><CalendarRange size={16} className="text-accent" /> Semaine</h2>
        <span className="text-[8px] font-bold uppercase tracking-widest text-[#18181B]/40 dark:text-[#E6E8E6]/40">Glissez une tâche pour la reprogrammer</span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="overflow-x-auto custom-scrollbar">
          <div className="min-w-[600px]">
            <div className="grid grid-cols-[28px_repeat(7,1fr)] gap-1 mb-1">
              <div />
              {week.map((d) => (
                <div key={d.key} className={`text-center text-[9px] font-black uppercase tracking-widest py-1 rounded-lg ${d.key === todayKey ? 'bg-accent/10 text-accent' : 'text-[#18181B]/40 dark:text-[#E6E8E6]/40'}`}>
                  {DAYS[(d.date.getDay() || 7) - 1]} {d.date.getDate()}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-[28px_repeat(7,1fr)] gap-1 relative" style={{ height: totalHeight }}>
              {/* Colonne des heures */}
              <div className="relative">
                {Array.from({ length: END_H - START_H + 1 }, (_, i) => (
                  <span key={i} className="absolute right-1 text-[8px] font-black text-[#18181B]/30 dark:text-[#E6E8E6]/30 tabular-nums" style={{ top: i * 60 * PX_PER_MIN - 4 }}>{START_H + i}h</span>
                ))}
              </div>

              {week.map((d) => (
                <div key={d.key} className="relative rounded-lg bg-[#18181B]/[0.02] dark:bg-[#E6E8E6]/[0.02]">
                  {/* Zones de dépôt horaires */}
                  {Array.from({ length: END_H - START_H }, (_, i) => (
                    <HourCell key={i} id={`${d.key}##${START_H + i}`} top={i * 60 * PX_PER_MIN} height={60 * PX_PER_MIN} />
                  ))}
                  {/* Curseur "maintenant" */}
                  {d.key === todayKey && showNow && (
                    <div className="absolute left-0 right-0 z-10 border-t-2 border-[#DF2935] pointer-events-none" style={{ top: nowY }} />
                  )}
                  {/* Chips */}
                  {d.items.map((it) => (
                    <Chip key={it.chipId} item={it} top={(it.startMin - START_H * 60) * PX_PER_MIN} height={Math.max(it.duration * PX_PER_MIN, 14)} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <DragOverlay>
          {activeItem ? (
            <div className="rounded-md px-1 py-0.5 border bg-accent/30 border-accent shadow-lg flex items-center gap-1">
              <GripVertical size={10} className="text-accent" />
              <p className="text-[8px] font-black leading-none truncate">{activeItem.title}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default WeekAgenda;
