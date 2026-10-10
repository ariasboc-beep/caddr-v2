import React, { useMemo, useState } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import {
  GripVertical, Send, Trash2, ChevronDown, ChevronRight, ListPlus, Clock, Calendar,
  Check, Flag, Tag, X, Hourglass, Repeat, StickyNote, RotateCcw,
} from 'lucide-react';
import { Task, PriorityType } from '../types';
import { generateId, getKeyFromDate } from '../utils';
import { Sortable } from './Sortable';
import RichText from './RichText';

interface Props {
  items: Task[];
  onChange: (items: Task[]) => void;
  onTransfer: (task: Task) => void;
  saveToHistory: () => void;
}

type SortMode = 'manual' | 'priority' | 'date';

const PRIORITY: Record<PriorityType, { label: string; text: string; bg: string; rank: number }> = {
  high: { label: 'Haute', text: 'text-[#DF2935]', bg: 'bg-[#DF2935]/10', rank: 0 },
  medium: { label: 'Moyenne', text: 'text-[#FDCA40]', bg: 'bg-[#FDCA40]/10', rank: 1 },
  low: { label: 'Basse', text: 'text-[#18181B]/50 dark:text-[#E6E8E6]/50', bg: 'bg-[#18181B]/5 dark:bg-[#E6E8E6]/5', rank: 2 },
};
const PRIORITY_CYCLE: (PriorityType | undefined)[] = [undefined, 'high', 'medium', 'low'];

const fmtDay = (k?: string) =>
  k ? new Date(k + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\.$/, '') : '';
const weekdayName = (k: string) => new Date(k + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long' });
const stripHtml = (h?: string) => (h || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();

const InboxView: React.FC<Props> = ({ items, onChange, onTransfer, saveToHistory }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    try { return (localStorage.getItem('caddr_inbox_sort') as SortMode) || 'manual'; } catch { return 'manual'; }
  });
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [labelDraft, setLabelDraft] = useState<Record<string, string>>({});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const todayKey = getKeyFromDate(new Date());

  const setSort = (m: SortMode) => { setSortMode(m); try { localStorage.setItem('caddr_inbox_sort', m); } catch {} };

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

  const addLabel = (id: string, raw: string) => {
    const label = raw.trim().replace(/^@/, '').toLowerCase();
    if (!label) return;
    const t = items.find((x) => x.id === id);
    if (!t || (t.labels || []).includes(label)) { setLabelDraft((d) => ({ ...d, [id]: '' })); return; }
    patchItem(id, { labels: [...(t.labels || []), label] });
    setLabelDraft((d) => ({ ...d, [id]: '' }));
  };

  const removeLabel = (id: string, label: string) => {
    const t = items.find((x) => x.id === id);
    if (t) patchItem(id, { labels: (t.labels || []).filter((l) => l !== label) });
  };

  const cyclePriority = (t: Task) => {
    const next = PRIORITY_CYCLE[(PRIORITY_CYCLE.indexOf(t.priority) + 1) % PRIORITY_CYCLE.length];
    patchItem(t.id, { priority: next });
  };

  const toggleDone = (t: Task) => patchItem(t.id, { doneAt: t.doneAt ? undefined : todayKey });

  const active = items.filter((t) => !t.doneAt);
  const done = items.filter((t) => t.doneAt);

  const allLabels = useMemo(() => {
    const counts: Record<string, number> = {};
    active.forEach((t) => (t.labels || []).forEach((l) => { counts[l] = (counts[l] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  const visible = useMemo(() => {
    let list = labelFilter ? active.filter((t) => (t.labels || []).includes(labelFilter)) : active;
    if (sortMode === 'priority') {
      list = [...list].sort((a, b) => (a.priority ? PRIORITY[a.priority].rank : 3) - (b.priority ? PRIORITY[b.priority].rank : 3));
    } else if (sortMode === 'date') {
      const key = (t: Task) => [t.deadline, t.specificDate].filter(Boolean).sort()[0] || '9999-99-99';
      list = [...list].sort((a, b) => key(a).localeCompare(key(b)));
    }
    return list;
  }, [items, sortMode, labelFilter]);

  // Le glisser-déposer n'a de sens qu'en ordre manuel, sans filtre
  const canDrag = sortMode === 'manual' && !labelFilter;

  const onDragEndItems = (e: DragEndEvent) => {
    const { active: a, over } = e;
    if (!over || a.id === over.id) return;
    const oldI = items.findIndex((t) => t.id === a.id);
    const newI = items.findIndex((t) => t.id === over.id);
    if (oldI !== -1 && newI !== -1) onChange(arrayMove(items, oldI, newI));
  };

  const onDragEndSubs = (pid: string) => (e: DragEndEvent) => {
    const { active: a, over } = e;
    if (!over || a.id === over.id) return;
    const parent = items.find((t) => t.id === pid);
    if (!parent?.subTasks) return;
    const oldI = parent.subTasks.findIndex((s) => s.id === a.id);
    const newI = parent.subTasks.findIndex((s) => s.id === over.id);
    if (oldI !== -1 && newI !== -1) patchItem(pid, { subTasks: arrayMove(parent.subTasks, oldI, newI) });
  };

  const inputCls = 'bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-3 py-2 rounded-xl text-xs font-bold border border-[#18181B]/5 dark:border-[#E6E8E6]/5 outline-none focus:border-accent text-[#18181B] dark:text-[#E6E8E6] [color-scheme:dark]';
  const sectionLabel = 'text-[9px] font-black uppercase tracking-widest text-[#18181B]/40 dark:text-[#E6E8E6]/40';
  const chip = (on: boolean) => `px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all ${on ? 'bg-accent text-white border-accent' : 'bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 border-transparent text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent'}`;

  const deadlineBadge = (k: string) => {
    const late = k < todayKey, soon = k === todayKey;
    const cls = late || soon ? 'text-[#DF2935] bg-[#DF2935]/10' : 'text-[#FDCA40] bg-[#FDCA40]/10';
    return (
      <span className={`flex items-center gap-1 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full shrink-0 ${cls}`} title="Échéance">
        <Hourglass size={8} /> {late ? 'En retard · ' : soon ? "Aujourd'hui · " : ''}{fmtDay(k)}
      </span>
    );
  };

  const renderRow = (task: Task, handle?: React.HTMLAttributes<HTMLElement>) => {
    const isOpen = expanded[task.id];
    const subCount = task.subTasks?.length || 0;
    const prio = task.priority ? PRIORITY[task.priority] : null;
    const notes = stripHtml(task.description);
    return (
      <div className="glass p-4 rounded-[2rem] group">
        <div className="flex items-center gap-2">
          {canDrag && handle && (
            <button {...handle} className="cursor-grab active:cursor-grabbing touch-none p-1 text-[#18181B]/30 dark:text-[#E6E8E6]/30 hover:text-accent" title="Glisser pour réordonner">
              <GripVertical size={16} />
            </button>
          )}
          <button
            onClick={() => toggleDone(task)}
            title="Marquer comme réglée"
            aria-label="Marquer comme réglée"
            className="group/ck w-5 h-5 shrink-0 rounded-lg border-2 border-[#18181B]/20 dark:border-[#E6E8E6]/20 hover:border-accent flex items-center justify-center transition-all"
          >
            <Check size={11} strokeWidth={3} className="text-accent opacity-0 group-hover/ck:opacity-100" />
          </button>
          <button onClick={() => setExpanded((e) => ({ ...e, [task.id]: !isOpen }))} className="p-1 text-[#18181B]/40 dark:text-[#E6E8E6]/40 hover:text-accent" title={isOpen ? 'Replier' : 'Déplier les détails'}>
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          <div className="flex-1 min-w-0">
            <input
              className="w-full bg-transparent text-sm font-bold outline-none text-[#18181B] dark:text-[#E6E8E6]"
              value={task.title}
              onChange={(e) => patchItem(task.id, { title: e.target.value })}
            />
            {/* Badges */}
            {(prio || task.specificDate || task.deadline || task.startTime || (task.labels || []).length > 0 || notes || subCount > 0) && (
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                {prio && (
                  <button onClick={() => cyclePriority(task)} title="Changer la priorité" className={`flex items-center gap-1 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${prio.bg} ${prio.text}`}>
                    <Flag size={8} /> {prio.label}
                  </button>
                )}
                {task.recurrence === 'weekly' && task.specificDate ? (
                  <span className="flex items-center gap-1 text-[8px] font-black uppercase text-accent bg-accent/10 px-1.5 py-0.5 rounded-full"><Repeat size={8} /> Chaque {weekdayName(task.specificDate)}</span>
                ) : task.specificDate ? (
                  <span className="flex items-center gap-1 text-[8px] font-black uppercase text-accent bg-accent/10 px-1.5 py-0.5 rounded-full"><Calendar size={8} /> {fmtDay(task.specificDate)}</span>
                ) : null}
                {task.startTime && (
                  <span className="flex items-center gap-1 text-[8px] font-black text-accent uppercase bg-accent/10 px-1.5 py-0.5 rounded-full"><Clock size={8} /> {task.startTime}</span>
                )}
                {task.deadline && deadlineBadge(task.deadline)}
                {(task.labels || []).map((l) => (
                  <button key={l} onClick={() => setLabelFilter(l)} title={`Filtrer sur @${l}`} className="flex items-center gap-0.5 text-[8px] font-black text-[#18181B]/60 dark:text-[#E6E8E6]/60 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-1.5 py-0.5 rounded-full hover:text-accent">
                    @{l}
                  </button>
                ))}
                {notes && <span title={notes.slice(0, 120)} className="text-[#18181B]/40 dark:text-[#E6E8E6]/40"><StickyNote size={10} /></span>}
                {subCount > 0 && (
                  <span className="text-[8px] font-black text-[#18181B]/40 dark:text-[#E6E8E6]/40 uppercase bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-1.5 py-0.5 rounded-full">{subCount} sous-idée{subCount > 1 ? 's' : ''}</span>
                )}
              </div>
            )}
          </div>

          {!prio && (
            <button onClick={() => cyclePriority(task)} title="Ajouter une priorité" className="p-2 rounded-xl text-[#18181B]/30 dark:text-[#E6E8E6]/30 hover:text-accent opacity-60 sm:opacity-0 group-hover:opacity-100 transition-all"><Flag size={14} /></button>
          )}
          <button onClick={() => onTransfer(task)} title="Transférer vers une routine" className="p-2 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-xl text-accent hover:bg-accent hover:text-white transition-all"><Send size={15} /></button>
          <button onClick={() => { saveToHistory(); onChange(items.filter((t) => t.id !== task.id)); }} title="Supprimer" className="p-2 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-xl text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-[#DF2935] transition-all"><Trash2 size={15} /></button>
        </div>

        {isOpen && (
          <div className="mt-4 ml-8 space-y-4 animate-in slide-in-from-top-2">
            {/* Quand */}
            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col gap-1">
                <span className={sectionLabel}>Date prévue</span>
                <span className="flex items-center gap-1.5"><Calendar size={13} className="text-[#18181B]/40 dark:text-[#E6E8E6]/40" />
                  <input type="date" className={inputCls} value={task.specificDate || ''} onChange={(e) => patchItem(task.id, { specificDate: e.target.value || undefined })} /></span>
              </label>
              <label className="flex flex-col gap-1">
                <span className={sectionLabel}>Heure</span>
                <span className="flex items-center gap-1.5"><Clock size={13} className="text-[#18181B]/40 dark:text-[#E6E8E6]/40" />
                  <input type="time" className={inputCls} value={task.startTime || ''} onChange={(e) => patchItem(task.id, { startTime: e.target.value || undefined })} /></span>
              </label>
              <label className="flex flex-col gap-1">
                <span className={sectionLabel}>Durée</span>
                <input type="number" min={0} placeholder="min" className={`${inputCls} w-20`} value={task.duration ?? ''} onChange={(e) => patchItem(task.id, { duration: e.target.value ? parseInt(e.target.value) : undefined })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={sectionLabel}>Échéance</span>
                <span className="flex items-center gap-1.5"><Hourglass size={13} className="text-[#FDCA40]" />
                  <input type="date" className={inputCls} value={task.deadline || ''} onChange={(e) => patchItem(task.id, { deadline: e.target.value || undefined })} /></span>
              </label>
            </div>
            {task.specificDate && (
              <label className="flex items-center gap-2 text-[10px] font-bold text-[#18181B]/60 dark:text-[#E6E8E6]/60 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  className="accent-[var(--accent)]"
                  checked={task.recurrence === 'weekly'}
                  onChange={(e) => patchItem(task.id, { recurrence: e.target.checked ? 'weekly' : 'daily' })}
                />
                Répéter chaque {weekdayName(task.specificDate)}
              </label>
            )}

            {/* Priorité */}
            <div className="space-y-1.5">
              <span className={sectionLabel}>Priorité</span>
              <div className="flex flex-wrap gap-2">
                {(['high', 'medium', 'low'] as PriorityType[]).map((p) => (
                  <button key={p} onClick={() => patchItem(task.id, { priority: task.priority === p ? undefined : p })}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all ${task.priority === p ? `${PRIORITY[p].bg} ${PRIORITY[p].text} border-current` : 'bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 border-transparent text-[#18181B]/60 dark:text-[#E6E8E6]/60'}`}>
                    <Flag size={10} /> {PRIORITY[p].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Étiquettes */}
            <div className="space-y-1.5">
              <span className={sectionLabel}>Étiquettes</span>
              <div className="flex flex-wrap items-center gap-2">
                {(task.labels || []).map((l) => (
                  <span key={l} className="flex items-center gap-1 text-[10px] font-bold text-[#18181B] dark:text-[#E6E8E6] bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 pl-2.5 pr-1 py-1 rounded-xl">
                    @{l}
                    <button onClick={() => removeLabel(task.id, l)} aria-label={`Retirer @${l}`} className="p-0.5 text-[#18181B]/40 dark:text-[#E6E8E6]/40 hover:text-[#DF2935]"><X size={11} /></button>
                  </span>
                ))}
                <span className="flex items-center gap-1">
                  <Tag size={12} className="text-[#18181B]/40 dark:text-[#E6E8E6]/40" />
                  <input
                    className={`${inputCls} w-36`}
                    placeholder="Ajouter (Entrée)"
                    list="caddr-inbox-labels"
                    value={labelDraft[task.id] || ''}
                    onChange={(e) => setLabelDraft((d) => ({ ...d, [task.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addLabel(task.id, labelDraft[task.id] || ''); } }}
                    onBlur={() => addLabel(task.id, labelDraft[task.id] || '')}
                  />
                </span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <span className={sectionLabel}>Notes</span>
              <RichText minHeight={80} placeholder="Détails, liens, contexte…" value={task.description || ''} onChange={(html) => patchItem(task.id, { description: html })} />
            </div>

            {/* Sous-idées (triables) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={sectionLabel}>Sous-idées</span>
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
    );
  };

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-24 glass rounded-[3rem] border-2 border-dashed border-[#18181B]/20 dark:border-[#E6E8E6]/20">
        <p className="text-[#18181B]/40 dark:text-[#E6E8E6]/40 text-sm font-medium">Votre boîte à idées est vide.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <datalist id="caddr-inbox-labels">
        {allLabels.map(([l]) => <option key={l} value={l} />)}
      </datalist>

      {/* Barre : tri + filtre par étiquette */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
        <div className="flex items-center gap-1.5">
          <span className={sectionLabel}>Trier</span>
          {([['manual', 'Manuel'], ['priority', 'Priorité'], ['date', 'Date']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setSort(id)} className={chip(sortMode === id)}>{label}</button>
          ))}
        </div>
        {allLabels.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={sectionLabel}>Étiquette</span>
            <button onClick={() => setLabelFilter(null)} className={chip(!labelFilter)}>Toutes</button>
            {allLabels.map(([l, n]) => (
              <button key={l} onClick={() => setLabelFilter(labelFilter === l ? null : l)} className={chip(labelFilter === l)}>@{l} <span className="opacity-60">{n}</span></button>
            ))}
          </div>
        )}
      </div>

      {visible.length === 0 && (
        <p className="text-center text-[11px] font-medium text-[#18181B]/40 dark:text-[#E6E8E6]/40 py-8">
          {labelFilter ? `Aucune idée avec @${labelFilter}.` : 'Tout est réglé ou déployé. 🎉'}
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEndItems}>
        <SortableContext items={visible.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {visible.map((task) => (
              <Sortable key={task.id} id={task.id} disabled={!canDrag}>
                {(handle) => renderRow(task, handle)}
              </Sortable>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Idées réglées */}
      {done.length > 0 && (
        <div className="pt-2">
          <div className="flex items-center justify-between px-1">
            <button onClick={() => setShowDone((v) => !v)} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#18181B]/50 dark:text-[#E6E8E6]/50 hover:text-accent">
              {showDone ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Réglées ({done.length})
            </button>
            {showDone && (
              <button onClick={() => { saveToHistory(); onChange(items.filter((t) => !t.doneAt)); }} className="text-[9px] font-black uppercase text-[#18181B]/40 dark:text-[#E6E8E6]/40 hover:text-[#DF2935]">Tout effacer</button>
            )}
          </div>
          {showDone && (
            <div className="mt-2 space-y-2">
              {done.map((task) => (
                <div key={task.id} className="glass px-4 py-3 rounded-2xl flex items-center gap-3 opacity-70">
                  <button onClick={() => toggleDone(task)} title="Remettre dans la Boîte" aria-label="Remettre dans la Boîte" className="w-5 h-5 shrink-0 rounded-lg bg-accent border-2 border-accent flex items-center justify-center">
                    <Check size={11} strokeWidth={3} className="text-white" />
                  </button>
                  <span className="flex-1 min-w-0 truncate text-sm font-semibold line-through text-[#18181B]/50 dark:text-[#E6E8E6]/50">{task.title}</span>
                  <span className="text-[9px] font-bold text-[#18181B]/40 dark:text-[#E6E8E6]/40 shrink-0">{fmtDay(task.doneAt)}</span>
                  <button onClick={() => toggleDone(task)} title="Remettre dans la Boîte" className="p-1.5 text-[#18181B]/40 dark:text-[#E6E8E6]/40 hover:text-accent"><RotateCcw size={13} /></button>
                  <button onClick={() => { saveToHistory(); onChange(items.filter((t) => t.id !== task.id)); }} title="Supprimer" className="p-1.5 text-[#18181B]/40 dark:text-[#E6E8E6]/40 hover:text-[#DF2935]"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InboxView;
