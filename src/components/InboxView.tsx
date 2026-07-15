import React, { useState } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import {
  GripVertical, Send, Trash2, ChevronDown, ChevronRight, ListPlus, Clock, Calendar,
} from 'lucide-react';
import { Task } from '../types';
import { generateId } from '../utils';
import { Sortable } from './Sortable';

interface Props {
  items: Task[];
  onChange: (items: Task[]) => void;
  onTransfer: (task: Task) => void;
  saveToHistory: () => void;
}

const InboxView: React.FC<Props> = ({ items, onChange, onTransfer, saveToHistory }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const patchItem = (id: string, patch: Partial<Task>) =>
    onChange(items.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const patchSub = (pid: string, sid: string, patch: Partial<Task>) =>
    onChange(items.map((t) => t.id === pid
      ? { ...t, subTasks: (t.subTasks || []).map((s) => (s.id === sid ? { ...s, ...patch } : s)) }
      : t));

  const addSub = (pid: string) => {
    setExpanded((e) => ({ ...e, [pid]: true }));
    onChange(items.map((t) => t.id === pid
      ? { ...t, subTasks: [...(t.subTasks || []), { id: generateId(), title: 'Nouvelle sous-idée', completedDates: [], recurrence: 'daily' as const, subTasks: [] }] }
      : t));
  };

  const deleteSub = (pid: string, sid: string) => {
    saveToHistory();
    onChange(items.map((t) => t.id === pid
      ? { ...t, subTasks: (t.subTasks || []).filter((s) => s.id !== sid) }
      : t));
  };

  const onDragEndItems = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldI = items.findIndex((t) => t.id === active.id);
    const newI = items.findIndex((t) => t.id === over.id);
    if (oldI !== -1 && newI !== -1) onChange(arrayMove(items, oldI, newI));
  };

  const onDragEndSubs = (pid: string) => (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const parent = items.find((t) => t.id === pid);
    if (!parent?.subTasks) return;
    const oldI = parent.subTasks.findIndex((s) => s.id === active.id);
    const newI = parent.subTasks.findIndex((s) => s.id === over.id);
    if (oldI !== -1 && newI !== -1) patchItem(pid, { subTasks: arrayMove(parent.subTasks, oldI, newI) });
  };

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-24 glass rounded-[3rem] border-2 border-dashed border-[#18181B]/20 dark:border-[#E6E8E6]/20">
        <p className="text-[#18181B]/40 dark:text-[#E6E8E6]/40 text-sm font-medium">Votre boîte à idées est vide.</p>
      </div>
    );
  }

  const inputCls = 'bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-3 py-2 rounded-xl text-xs font-bold border border-[#18181B]/5 dark:border-[#E6E8E6]/5 outline-none focus:border-accent text-[#18181B] dark:text-[#E6E8E6] [color-scheme:dark]';

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEndItems}>
      <SortableContext items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {items.map((task) => {
            const isOpen = expanded[task.id];
            const subCount = task.subTasks?.length || 0;
            return (
              <Sortable key={task.id} id={task.id}>
                {(handle) => (
                  <div className="glass p-4 rounded-[2rem] group">
                    <div className="flex items-center gap-2">
                      <button {...handle} className="cursor-grab active:cursor-grabbing touch-none p-1 text-[#18181B]/30 dark:text-[#E6E8E6]/30 hover:text-accent" title="Glisser pour réordonner">
                        <GripVertical size={16} />
                      </button>

                      <button onClick={() => setExpanded((e) => ({ ...e, [task.id]: !isOpen }))} className="p-1 text-[#18181B]/40 dark:text-[#E6E8E6]/40 hover:text-accent">
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>

                      <input
                        className="flex-1 bg-transparent text-sm font-bold outline-none text-[#18181B] dark:text-[#E6E8E6]"
                        value={task.title}
                        onChange={(e) => patchItem(task.id, { title: e.target.value })}
                      />

                      {task.startTime && (
                        <span className="hidden sm:flex items-center gap-1 text-[8px] font-black text-accent uppercase bg-accent/10 px-1.5 py-0.5 rounded-full"><Clock size={8} /> {task.startTime}</span>
                      )}
                      {subCount > 0 && (
                        <span className="text-[8px] font-black text-[#18181B]/40 dark:text-[#E6E8E6]/40 uppercase bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-1.5 py-0.5 rounded-full">{subCount}</span>
                      )}

                      <button onClick={() => onTransfer(task)} title="Transférer vers une routine" className="p-2 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-xl text-accent hover:bg-accent hover:text-white transition-all"><Send size={15} /></button>
                      <button onClick={() => { saveToHistory(); onChange(items.filter((t) => t.id !== task.id)); }} title="Supprimer" className="p-2 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-xl text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-[#DF2935] transition-all"><Trash2 size={15} /></button>
                    </div>

                    {isOpen && (
                      <div className="mt-3 ml-8 space-y-3 animate-in slide-in-from-top-2">
                        {/* Date + heure */}
                        <div className="flex flex-wrap gap-2">
                          <div className="flex items-center gap-1.5">
                            <Calendar size={13} className="text-[#18181B]/40 dark:text-[#E6E8E6]/40" />
                            <input type="date" className={inputCls} value={task.specificDate || ''} onChange={(e) => patchItem(task.id, { specificDate: e.target.value })} />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock size={13} className="text-[#18181B]/40 dark:text-[#E6E8E6]/40" />
                            <input type="time" className={inputCls} value={task.startTime || ''} onChange={(e) => patchItem(task.id, { startTime: e.target.value })} />
                          </div>
                          <input type="number" min={0} placeholder="min" className={`${inputCls} w-20`} value={task.duration ?? ''} onChange={(e) => patchItem(task.id, { duration: e.target.value ? parseInt(e.target.value) : undefined })} />
                        </div>

                        {/* Sous-idées (triables) */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase tracking-widest text-[#18181B]/40 dark:text-[#E6E8E6]/40">Sous-idées</span>
                            <button onClick={() => addSub(task.id)} className="flex items-center gap-1 text-[9px] font-black uppercase text-accent hover:opacity-70"><ListPlus size={12} /> Ajouter</button>
                          </div>

                          {subCount > 0 && (
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEndSubs(task.id)}>
                              <SortableContext items={(task.subTasks || []).map((s) => s.id)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-1.5">
                                  {(task.subTasks || []).map((sub) => (
                                    <Sortable key={sub.id} id={sub.id}>
                                      {(subHandle) => (
                                        <div className="flex items-center gap-2 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-xl px-2 py-1.5">
                                          <button {...subHandle} className="cursor-grab active:cursor-grabbing touch-none text-[#18181B]/30 dark:text-[#E6E8E6]/30 hover:text-accent"><GripVertical size={13} /></button>
                                          <input className="flex-1 bg-transparent text-[11px] font-medium outline-none text-[#18181B] dark:text-[#E6E8E6]" value={sub.title} onChange={(e) => patchSub(task.id, sub.id, { title: e.target.value })} />
                                          <button onClick={() => deleteSub(task.id, sub.id)} className="text-[#18181B]/40 dark:text-[#E6E8E6]/40 hover:text-[#DF2935] p-0.5"><Trash2 size={13} /></button>
                                        </div>
                                      )}
                                    </Sortable>
                                  ))}
                                </div>
                              </SortableContext>
                            </DndContext>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Sortable>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default InboxView;
