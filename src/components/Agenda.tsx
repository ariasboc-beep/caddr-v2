import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Check, Plus, AlertTriangle, CalendarClock, X, Target, GripHorizontal } from 'lucide-react';
import { AppData, Task } from '../types';
import { getKeyFromDate, isDateInRange } from '../utils';
import { resolveDay } from '../analytics';

// Palette catégorielle validée (ordre fixe, couleur = bloc, jamais le rang)
const BLOCK_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];

interface Props {
  appData: AppData;
  date: Date;                       // jour affiché (partagé avec l'en-tête de l'app)
  now: Date;
  view: 'day' | 'week';
  onViewChange: (v: 'day' | 'week') => void;
  onDateChange: (d: Date) => void;
  onToggle: (blockId: string, taskId: string) => void;            // jour affiché uniquement
  onOpenTask: (blockId: string, taskId: string) => void;
  onSetTime: (blockId: string, taskId: string, patch: { startTime?: string; duration?: number }, dateKey: string) => void;
  onMoveTask: (taskId: string, dateKey: string, startTime: string) => void;    // vue semaine : changer de jour
  onQuickAdd: (blockId: string, title: string, startTime: string, duration: number, dateKey: string) => void;
}

interface Item { task: Task; blockId: string; blockTitle: string; color: string; start: number; dur: number; done: boolean; lane: number; lanes: number; conflict: boolean }

const ink = 'text-[#18181B] dark:text-[#E6E8E6]';
const muted = 'text-[#18181B]/55 dark:text-[#E6E8E6]/55';
const faint = 'text-[#18181B]/35 dark:text-[#E6E8E6]/35';
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const label = (min: number) => `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}`;
const fmtDur = (m: number) => m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ''}` : `${m} min`;
const parse = (t?: string) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return isNaN(h) ? null : h * 60 + (m || 0); };
const SNAP = 15;

// Tâches d'un jour, réparties en couloirs quand elles se chevauchent
function dayItems(appData: AppData, date: Date, colorOf: (title: string) => string) {
  const k = getKeyFromDate(date);
  const timed: Item[] = []; const untimed: { task: Task; blockId: string; blockTitle: string; color: string; done: boolean }[] = [];
  resolveDay(appData, date).forEach(b => {
    (b.tasks || []).filter(t => isDateInRange(date, t.recurrence, t.specificDate, t.startDate, t.endDate, t.stopDate)).forEach(t => {
      const done = !!t.completedDates?.includes(k);
      const s = parse(t.startTime);
      if (s === null) untimed.push({ task: t, blockId: b.id, blockTitle: b.title, color: colorOf(b.title), done });
      else timed.push({ task: t, blockId: b.id, blockTitle: b.title, color: colorOf(b.title), start: s, dur: Math.max(10, t.duration || 30), done, lane: 0, lanes: 1, conflict: false });
    });
  });
  timed.sort((a, b) => a.start - b.start || (a.start + a.dur) - (b.start + b.dur));
  let cluster: Item[] = []; let end = -1; const laneEnds: number[] = [];
  const flush = () => { cluster.forEach(it => { it.lanes = laneEnds.length; it.conflict = laneEnds.length > 1; }); cluster = []; laneEnds.length = 0; };
  timed.forEach(it => {
    if (cluster.length && it.start >= end) flush();
    let lane = laneEnds.findIndex(e => e <= it.start);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(it.start + it.dur); } else laneEnds[lane] = it.start + it.dur;
    it.lane = lane; cluster.push(it); end = Math.max(end, it.start + it.dur);
  });
  if (cluster.length) flush();
  return { timed, untimed };
}

const Agenda: React.FC<Props> = (props) => {
  const { appData, date, now, view, onViewChange, onDateChange, onToggle, onOpenTask, onSetTime, onMoveTask, onQuickAdd } = props;
  const todayKey = getKeyFromDate(now);
  const dateKey = getKeyFromDate(date);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Couleur stable par nom de bloc (ordre du plan)
  const colorOf = useMemo(() => {
    const titles: string[] = [];
    appData.blocks.forEach(b => { if (!titles.includes(b.title)) titles.push(b.title); });
    (Object.values(appData.days) as { blocks?: { title: string }[] }[]).forEach(d => d.blocks?.forEach(b => { if (!titles.includes(b.title)) titles.push(b.title); }));
    return (t: string) => BLOCK_COLORS[Math.max(0, titles.indexOf(t)) % BLOCK_COLORS.length];
  }, [appData.blocks, appData.days]);

  const day = useMemo(() => dayItems(appData, date, colorOf), [appData, date, colorOf]);

  // Semaine (lundi → dimanche) contenant le jour affiché
  const week = useMemo(() => {
    const mon = new Date(date); mon.setHours(12, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return { date: d, key: getKeyFromDate(d), ...dayItems(appData, d, colorOf) }; });
  }, [appData, date, colorOf]);

  // Plage horaire automatique (au moins 7h → 22h, élargie si besoin)
  const all = view === 'day' ? day.timed : week.flatMap(w => w.timed);
  const startH = Math.min(7, ...all.map(i => Math.floor(i.start / 60)));
  const endH = Math.max(22, ...all.map(i => Math.ceil((i.start + i.dur) / 60)));
  const PX = view === 'day' ? 1.1 : 0.75; // pixels par minute
  const height = (endH - startH) * 60 * PX;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowY = (nowMin - startH * 60) * PX;

  // Défilement initial vers l'heure actuelle (ou la première tâche)
  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const target = dateKey === todayKey ? nowY - 120 : ((all[0]?.start ?? startH * 60 + 60) - startH * 60) * PX - 40;
    el.scrollTop = Math.max(0, target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, dateKey]);

  // ---------- Glisser pour déplacer / redimensionner (pas de 15 min) ----------
  const [drag, setDrag] = useState<{ id: string; mode: 'move' | 'resize'; dy: number; dx: number; col?: number } | null>(null);
  const dragInfo = useRef<{ item: Item; mode: 'move' | 'resize'; y0: number; x0: number; moved: boolean; dayKey: string; colW: number; col: number } | null>(null);

  const startDrag = (e: React.PointerEvent, item: Item, mode: 'move' | 'resize', dayKey: string, col = 0) => {
    e.stopPropagation();
    const grid = (e.currentTarget as HTMLElement).closest('[data-grid]') as HTMLElement | null;
    const colW = grid ? grid.getBoundingClientRect().width / (view === 'week' ? 7 : 1) : 1;
    dragInfo.current = { item, mode, y0: e.clientY, x0: e.clientX, moved: false, dayKey, colW, col };
    const move = (ev: PointerEvent) => {
      const d = dragInfo.current; if (!d) return;
      const dy = ev.clientY - d.y0, dx = ev.clientX - d.x0;
      if (!d.moved && Math.abs(dy) < 5 && Math.abs(dx) < 5) return;
      d.moved = true;
      const colShift = view === 'week' && d.mode === 'move' ? Math.round(dx / d.colW) : 0;
      setDrag({ id: d.item.task.id + d.dayKey, mode: d.mode, dy, dx, col: Math.min(6, Math.max(0, d.col + colShift)) });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      const d = dragInfo.current; dragInfo.current = null; setDrag(null);
      if (!d) return;
      if (!d.moved) { onOpenTask(d.item.blockId, d.item.task.id); return; }
      const deltaMin = Math.round((ev.clientY - d.y0) / PX / SNAP) * SNAP;
      if (d.mode === 'resize') {
        const dur = Math.max(SNAP, d.item.dur + deltaMin);
        if (dur !== d.item.dur) onSetTime(d.item.blockId, d.item.task.id, { duration: dur }, d.dayKey);
        return;
      }
      const start = Math.min(23 * 60 + 45, Math.max(0, d.item.start + deltaMin));
      if (view === 'week') {
        const col = Math.min(6, Math.max(0, d.col + Math.round((ev.clientX - d.x0) / d.colW)));
        const targetKey = week[col].key;
        if (targetKey !== d.dayKey) { onMoveTask(d.item.task.id, targetKey, toHHMM(start)); return; }
      }
      if (start !== d.item.start) onSetTime(d.item.blockId, d.item.task.id, { startTime: toHHMM(start) }, d.dayKey);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  // ---------- Ajout rapide sur un créneau vide ----------
  const [quick, setQuick] = useState<{ start: number; dayKey: string; title: string; blockId: string; dur: number } | null>(null);
  const dayBlocks = (k: string) => resolveDay(appData, new Date(k + 'T12:00:00'));
  const openQuick = (e: React.MouseEvent, k: string) => {
    if ((e.target as HTMLElement).closest('[data-event]')) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const min = Math.floor(((e.clientY - rect.top) / PX + startH * 60) / SNAP) * SNAP;
    const blocks = dayBlocks(k);
    setQuick({ start: min, dayKey: k, title: '', blockId: blocks[0]?.id || '', dur: 30 });
  };
  const submitQuick = () => {
    if (!quick || !quick.title.trim() || !quick.blockId) return;
    onQuickAdd(quick.blockId, quick.title.trim(), toHHMM(quick.start), quick.dur, quick.dayKey);
    setQuick(null);
  };

  // ---------- Rendu d'un événement ----------
  const renderEvent = (it: Item, k: string, compact: boolean, col = 0) => {
    const id = it.task.id + k;
    const dragging = drag?.id === id;
    let top = (it.start - startH * 60) * PX;
    let h = Math.max(compact ? 18 : 26, it.dur * PX);
    let leftCol = col;
    if (dragging && drag) {
      if (drag.mode === 'move') { top += Math.round(drag.dy / PX / SNAP) * SNAP * PX; leftCol = drag.col ?? col; }
      else h = Math.max(SNAP * PX, h + Math.round(drag.dy / PX / SNAP) * SNAP * PX);
    }
    const previewStart = dragging && drag?.mode === 'move' ? it.start + Math.round(drag.dy / PX / SNAP) * SNAP : it.start;
    const previewDur = dragging && drag?.mode === 'resize' ? Math.max(SNAP, it.dur + Math.round(drag.dy / PX / SNAP) * SNAP) : it.dur;
    const w = 100 / it.lanes;
    const style: React.CSSProperties = view === 'week'
      ? { top, height: h, left: `calc(${(leftCol + (it.lane * w) / 100) * (100 / 7)}% + 2px)`, width: `calc(${w / 7}% - 4px)` }
      : { top, height: h, left: `calc(${it.lane * w}% + 6px)`, width: `calc(${w}% - 10px)` };
    return (
      <div key={id} data-event
        onPointerDown={(e) => startDrag(e, it, 'move', k, col)}
        className={`group absolute rounded-lg overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing transition-shadow ${dragging ? 'z-30 shadow-2xl ring-2 ring-white/40' : 'z-10 hover:z-20 hover:shadow-lg'}`}
        style={{ ...style, backgroundColor: `${it.color}${it.done ? '22' : '33'}`, boxShadow: `inset 3px 0 0 ${it.conflict && !it.done ? '#e66767' : it.color}` }}
        title={`${it.task.title} · ${label(it.start)}–${label(it.start + it.dur)} · ${it.blockTitle}${it.conflict ? ' · chevauchement' : ''}`}>
        <div className={`h-full flex ${compact ? 'px-1 py-0.5' : 'pl-2.5 pr-1.5 py-1'} gap-1.5`}>
          {!compact && k === dateKey && (
            <button onPointerDown={e => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onToggle(it.blockId, it.task.id); }}
              aria-label={it.done ? 'Marquer comme non faite' : 'Marquer comme faite'}
              className="mt-0.5 w-4 h-4 shrink-0 rounded-[5px] flex items-center justify-center border-2 transition-all"
              style={{ borderColor: it.color, backgroundColor: it.done ? it.color : 'transparent' }}>
              {it.done && <Check size={10} strokeWidth={4} className="text-white" />}
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className={`${compact ? 'text-[9px]' : 'text-[12px]'} font-bold leading-tight truncate ${ink} ${it.done ? 'line-through opacity-60' : ''}`}>{it.task.title}</p>
            {!compact && h >= 38 && (
              <p className={`text-[10px] font-semibold truncate ${muted}`}>{label(previewStart)}–{label(previewStart + previewDur)} · {it.blockTitle}</p>
            )}
            {compact && h >= 34 && <p className={`text-[8px] font-semibold truncate ${muted}`}>{label(previewStart)}</p>}
          </div>
          {it.conflict && !it.done && !compact && <AlertTriangle size={12} className="text-[#e66767] shrink-0 mt-0.5" aria-label="Chevauchement" />}
        </div>
        {/* Poignée de durée */}
        <div onPointerDown={(e) => startDrag(e, it, 'resize', k, col)} title="Glisser pour changer la durée"
          className="absolute left-0 right-0 bottom-0 h-2 cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-60">
          <GripHorizontal size={10} className={muted} />
        </div>
      </div>
    );
  };

  const hours = Array.from({ length: endH - startH + 1 }, (_, i) => startH + i);
  const gridBg = (
    <>
      {hours.map((hh, i) => (
        <div key={hh} className="absolute left-0 right-0 pointer-events-none" style={{ top: i * 60 * PX }}>
          <div className="border-t border-[#18181B]/[0.07] dark:border-[#E6E8E6]/[0.07]" />
          {i < hours.length - 1 && <div className="border-t border-dashed border-[#18181B]/[0.04] dark:border-[#E6E8E6]/[0.04]" style={{ marginTop: 30 * PX }} />}
        </div>
      ))}
    </>
  );
  const hourLabels = (
    <div className="relative w-11 shrink-0" style={{ height }}>
      {hours.map((hh, i) => <span key={hh} className={`absolute right-2 -translate-y-1/2 text-[10px] font-bold tabular-nums ${faint}`} style={{ top: i * 60 * PX }}>{String(hh).padStart(2, '0')}h</span>)}
    </div>
  );
  const nowLine = (
    <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center" style={{ top: nowY }}>
      <span className="absolute -left-[46px] px-1 rounded bg-[#e66767] text-white text-[9px] font-black tabular-nums">{toHHMM(nowMin)}</span>
      <span className="w-2 h-2 rounded-full bg-[#e66767] -ml-1" /><span className="flex-1 border-t-2 border-[#e66767]" />
    </div>
  );

  // ---------- Résumé ----------
  const planned = day.timed.reduce((s, i) => s + i.dur, 0);
  const doneMin = day.timed.filter(i => i.done).reduce((s, i) => s + i.dur, 0);
  const conflicts = day.timed.filter(i => i.conflict).length;
  const next = dateKey === todayKey ? day.timed.find(i => !i.done && i.start + i.dur > nowMin) : undefined;
  const objective = (() => { const d = appData.days[dateKey]; return d?.dailyGoalOverride || (appData.recurringGoals || []).find(g => isDateInRange(date, g.recurrence, g.specificDate, g.startDate, g.endDate, g.stopDate))?.title || ''; })();

  const shift = (n: number) => { const d = new Date(date); d.setDate(d.getDate() + n * (view === 'week' ? 7 : 1)); onDateChange(d); };
  const title = view === 'day'
    ? date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    : `${week[0].date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${week[6].date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <div className="glass rounded-[2rem] p-4 sm:p-6 space-y-4">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className={`font-black uppercase tracking-wider text-sm flex items-center gap-2 mr-auto ${ink}`}><CalendarClock size={16} className="text-accent" /> Agenda</h2>
        <div className="flex p-1 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-xl">
          {(['day', 'week'] as const).map(v => <button key={v} onClick={() => onViewChange(v)} className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${view === v ? 'bg-accent text-white shadow' : muted}`}>{v === 'day' ? 'Jour' : 'Semaine'}</button>)}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => shift(-1)} aria-label="Précédent" className={`p-2 rounded-xl hover:bg-accent/10 hover:text-accent ${muted}`}><ChevronLeft size={18} /></button>
        <p className={`flex-1 text-center text-sm font-black capitalize ${ink}`}>{title}</p>
        <button onClick={() => shift(1)} aria-label="Suivant" className={`p-2 rounded-xl hover:bg-accent/10 hover:text-accent ${muted}`}><ChevronRight size={18} /></button>
        {(view === 'day' ? dateKey !== todayKey : !week.some(w => w.key === todayKey)) && <button onClick={() => onDateChange(new Date())} className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider text-accent bg-accent/10 hover:bg-accent hover:text-white transition-all">Aujourd'hui</button>}
      </div>

      {view === 'day' && (
        <>
          {objective && <p className={`flex items-center gap-2 text-xs font-bold ${ink}`}><Target size={14} className="text-accent shrink-0" /><span className="truncate">Objectif : {objective}</span></p>}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { l: 'Planifié', v: fmtDur(planned), s: `${day.timed.length} tâche${day.timed.length > 1 ? 's' : ''} à heure fixe` },
              { l: 'Accompli', v: planned ? `${Math.round((doneMin / planned) * 100)} %` : '—', s: `${fmtDur(doneMin)} sur ${fmtDur(planned)}` },
              { l: next ? 'Prochaine' : 'Sans horaire', v: next ? label(next.start) : String(day.untimed.length), s: next ? next.task.title : 'tâche(s) à placer' },
              { l: 'Chevauchements', v: String(conflicts), s: conflicts ? 'tâches en même temps' : 'aucun conflit' },
            ].map(c => (
              <div key={c.l} className="rounded-2xl bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] border border-[#18181B]/5 dark:border-[#E6E8E6]/5 px-3 py-2.5 min-w-0">
                <p className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>{c.l}</p>
                <p className={`text-lg font-black leading-tight ${c.l === 'Chevauchements' && conflicts ? 'text-[#e66767]' : ink}`}>{c.v}</p>
                <p className={`text-[10px] font-semibold truncate ${muted}`}>{c.s}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Grille */}
      <div ref={scrollRef} className="relative max-h-[62vh] overflow-y-auto overflow-x-auto custom-scrollbar rounded-2xl border border-[#18181B]/5 dark:border-[#E6E8E6]/5">
        {view === 'week' && (
          <div className="sticky top-0 z-30 flex bg-[#F4F4F5]/95 dark:bg-[#0d0d0d]/95 backdrop-blur border-b border-[#18181B]/5 dark:border-[#E6E8E6]/5 min-w-[640px]">
            <div className="w-11 shrink-0" />
            {week.map(w => (
              <button key={w.key} onClick={() => { onDateChange(w.date); onViewChange('day'); }} className="flex-1 py-2 text-center hover:bg-accent/10 transition-colors" title="Voir ce jour">
                <p className={`text-[9px] font-black uppercase ${w.key === todayKey ? 'text-accent' : muted}`}>{w.date.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}</p>
                <p className={`text-sm font-black ${w.key === todayKey ? 'text-accent' : ink}`}>{w.date.getDate()}</p>
                <p className={`text-[8px] font-bold ${faint}`}>{w.timed.length ? fmtDur(w.timed.reduce((s, i) => s + i.dur, 0)) : '—'}</p>
              </button>
            ))}
          </div>
        )}
        <div className={`flex pt-3 pb-3 ${view === 'week' ? 'min-w-[640px]' : ''}`}>
          {hourLabels}
          <div data-grid className="relative flex-1 cursor-copy" style={{ height }} onClick={view === 'day' ? (e) => openQuick(e, dateKey) : undefined}>
            {gridBg}
            {view === 'week' && (
              <div className="absolute inset-0 flex">
                {week.map(w => <div key={w.key} onClick={(e) => openQuick(e, w.key)} className={`flex-1 h-full border-l border-[#18181B]/[0.05] dark:border-[#E6E8E6]/[0.05] ${w.key === todayKey ? 'bg-accent/[0.05]' : ''}`} />)}
              </div>
            )}
            {(view === 'day' ? dateKey === todayKey : week.some(w => w.key === todayKey)) && nowMin >= startH * 60 && nowMin <= endH * 60 && nowLine}
            {view === 'day'
              ? day.timed.map(it => renderEvent(it, dateKey, false))
              : week.flatMap((w, ci) => w.timed.map(it => renderEvent(it, w.key, true, ci)))}
            {view === 'day' && day.timed.length === 0 && (
              <p className={`absolute inset-x-0 top-16 text-center text-xs font-semibold px-6 pointer-events-none ${muted}`}>Aucune tâche à heure fixe ce jour-là.<br />Touche un créneau pour en ajouter une, ou planifie une tâche ci-dessous.</p>
            )}
          </div>
        </div>
      </div>
      <p className={`text-[10px] font-medium ${faint}`}>Touche un créneau vide pour ajouter une tâche · fais glisser une tâche pour la déplacer (par 15 min{view === 'week' ? ', ou vers un autre jour' : ''}) · tire son bord bas pour changer la durée · touche-la pour la configurer.</p>

      {/* Sans horaire */}
      {view === 'day' && day.untimed.length > 0 && (
        <div className="space-y-2">
          <p className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${muted}`}><Clock size={12} /> Sans horaire ({day.untimed.length})</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {day.untimed.map(u => (
              <div key={u.task.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] border border-[#18181B]/5 dark:border-[#E6E8E6]/5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: u.color }} />
                <button onClick={() => onOpenTask(u.blockId, u.task.id)} className={`flex-1 min-w-0 text-left ${u.done ? 'line-through opacity-60' : ''}`}>
                  <span className={`block text-[12px] font-bold truncate ${ink}`}>{u.task.title}</span>
                  <span className={`block text-[10px] font-semibold truncate ${muted}`}>{u.blockTitle}</span>
                </button>
                <input type="time" aria-label={`Heure pour ${u.task.title}`} step={900}
                  onChange={e => e.target.value && onSetTime(u.blockId, u.task.id, { startTime: e.target.value, duration: u.task.duration || 30 }, dateKey)}
                  className={`w-[88px] bg-transparent text-[11px] font-bold rounded-lg px-1.5 py-1 border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent [color-scheme:dark] ${ink}`} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Légende des blocs */}
      {(() => {
        const titles = [...new Set((view === 'day' ? [...day.timed, ...day.untimed] : week.flatMap(w => w.timed)).map(i => i.blockTitle))];
        return titles.length > 0 && (
          <div className={`flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold ${muted}`}>
            {titles.map(t => <span key={t} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: colorOf(t) }} />{t}</span>)}
            {day.timed.some(i => i.conflict) && view === 'day' && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] bg-[#e66767]" />Chevauchement</span>}
          </div>
        );
      })()}

      {/* Ajout rapide */}
      {quick && (
        <div className="fixed inset-0 z-[130] bg-black/40 flex items-end sm:items-center justify-center p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) setQuick(null); }}>
          <div className="glass bg-[#F4F4F5] dark:bg-[#111] w-full max-w-sm rounded-3xl p-5 space-y-4 animate-in slide-in-from-bottom-4" onKeyDown={e => { if (e.key === 'Escape') setQuick(null); }}>
            <div className="flex items-center justify-between">
              <p className={`text-sm font-black ${ink}`}>Nouvelle tâche · {new Date(quick.dayKey + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
              <button onClick={() => setQuick(null)} aria-label="Fermer" className={`p-1.5 rounded-full hover:text-accent ${muted}`}><X size={16} /></button>
            </div>
            <input autoFocus value={quick.title} onChange={e => setQuick({ ...quick, title: e.target.value })} onKeyDown={e => e.key === 'Enter' && submitQuick()} placeholder="Titre de la tâche"
              className={`w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-4 py-3 rounded-xl text-sm font-bold border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent ${ink}`} />
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1"><span className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>Début</span>
                <input type="time" step={900} value={toHHMM(quick.start)} onChange={e => { const v = parse(e.target.value); if (v !== null) setQuick({ ...quick, start: v }); }} className={`w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-3 py-2.5 rounded-xl text-sm font-bold border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent [color-scheme:dark] ${ink}`} /></label>
              <label className="space-y-1"><span className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>Durée</span>
                <select value={quick.dur} onChange={e => setQuick({ ...quick, dur: Number(e.target.value) })} className={`w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-3 py-2.5 rounded-xl text-sm font-bold border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent ${ink}`}>
                  {[15, 30, 45, 60, 90, 120, 180].map(m => <option key={m} value={m}>{fmtDur(m)}</option>)}
                </select></label>
            </div>
            <div className="space-y-1.5">
              <span className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>Bloc</span>
              {dayBlocks(quick.dayKey).length === 0 ? <p className={`text-[11px] ${muted}`}>Aucun bloc ce jour-là : crée d'abord un bloc dans le Planning.</p> : (
                <div className="flex flex-wrap gap-2">
                  {dayBlocks(quick.dayKey).map(b => (
                    <button key={b.id} onClick={() => setQuick({ ...quick, blockId: b.id })} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold border transition-all ${quick.blockId === b.id ? 'border-accent bg-accent/10 text-accent' : `border-transparent bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 ${ink}`}`}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorOf(b.title) }} />{b.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={submitQuick} disabled={!quick.title.trim() || !quick.blockId} className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all ${quick.title.trim() && quick.blockId ? 'bg-accent text-white shadow-lg shadow-accent/20' : `bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 ${faint}`}`}><Plus size={14} /> Ajouter ce jour-là</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Agenda;
