import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Check, Plus, AlertTriangle, CalendarClock, X, Target, GripHorizontal, CalendarPlus, MapPin, Hand, Sparkles } from 'lucide-react';
import { AppData, Task, ExternalCalendar, ExtEventRaw } from '../types';
import { getKeyFromDate, isDateInRange } from '../utils';
import { resolveDay } from '../analytics';
import { occurrencesBetween, Occurrence } from '../icsImport';

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
  calendars?: ExternalCalendar[];
  eventsOf?: (c: ExternalCalendar) => ExtEventRaw[];
  calVersion?: number;
  onOpenCalendars?: () => void;
  onPlanWeek?: () => void;
}

interface Item { key: string; task?: Task; ext?: Occurrence; blockId: string; blockTitle: string; color: string; start: number; dur: number; done: boolean; lane: number; lanes: number; conflict: boolean }
interface Untimed { task: Task; blockId: string; blockTitle: string; color: string; done: boolean }

const ink = 'text-[#18181B] dark:text-[#E6E8E6]';
const muted = 'text-[#18181B]/55 dark:text-[#E6E8E6]/55';
const faint = 'text-[#18181B]/35 dark:text-[#E6E8E6]/35';
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const label = (min: number) => `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}`;
const fmtDur = (m: number) => m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ''}` : `${m} min`;
const parse = (t?: string) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return isNaN(h) ? null : h * 60 + (m || 0); };
const SNAP = 15;
const LONG_PRESS_MS = 350;

// Tâches + rendez-vous externes d'un jour, répartis en couloirs quand ils se chevauchent
function dayItems(appData: AppData, date: Date, colorOf: (title: string) => string, occs: Occurrence[]) {
  const k = getKeyFromDate(date);
  const timed: Item[] = []; const untimed: Untimed[] = []; const allDay: Occurrence[] = [];
  resolveDay(appData, date).forEach(b => {
    (b.tasks || []).filter(t => isDateInRange(date, t.recurrence, t.specificDate, t.startDate, t.endDate, t.stopDate)).forEach(t => {
      const done = !!t.completedDates?.includes(k);
      const s = parse(t.startTime);
      if (s === null) untimed.push({ task: t, blockId: b.id, blockTitle: b.title, color: colorOf(b.title), done });
      else timed.push({ key: t.id + k, task: t, blockId: b.id, blockTitle: b.title, color: colorOf(b.title), start: s, dur: Math.max(10, t.duration || 30), done, lane: 0, lanes: 1, conflict: false });
    });
  });
  const d0 = new Date(date); d0.setHours(0, 0, 0, 0); const d1 = new Date(d0); d1.setDate(d0.getDate() + 1);
  occs.forEach(o => {
    if (o.end <= d0 || o.start >= d1) return;
    if (o.allDay || o.end.getTime() - o.start.getTime() >= 20 * 3600000) { allDay.push(o); return; }
    const s = o.start < d0 ? 0 : o.start.getHours() * 60 + o.start.getMinutes();
    const e = o.end > d1 ? 24 * 60 : o.end.getHours() * 60 + o.end.getMinutes();
    timed.push({ key: o.uid + k, ext: o, blockId: '', blockTitle: o.calendarName, color: o.color, start: s, dur: Math.max(15, e - s), done: o.end.getTime() < Date.now(), lane: 0, lanes: 1, conflict: false });
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
  return { timed, untimed, allDay };
}

// Appui : souris = glisser dès 5 px ; tactile = appui long (350 ms) puis glisser,
// sinon le doigt fait défiler l'agenda normalement.
interface PressHandlers { onTap?: () => void; onStart: () => void; onMove: (ev: PointerEvent) => void; onEnd: (ev: PointerEvent | null) => void }
function beginPress(e: React.PointerEvent, h: PressHandlers) {
  const touch = e.pointerType === 'touch';
  const x0 = e.clientX, y0 = e.clientY;
  let active = false, cancelled = false;
  let timer: number | undefined;
  const prevent = (ev: TouchEvent) => { if (active) ev.preventDefault(); };
  const cleanup = () => {
    window.clearTimeout(timer);
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('touchmove', prevent);
  };
  const activate = () => { active = true; if (touch) { try { navigator.vibrate?.(12); } catch { /* non supporté */ } } h.onStart(); };
  if (touch) {
    window.addEventListener('touchmove', prevent, { passive: false });
    timer = window.setTimeout(() => { if (!cancelled) activate(); }, LONG_PRESS_MS);
  }
  const move = (ev: PointerEvent) => {
    const dist = Math.hypot(ev.clientX - x0, ev.clientY - y0);
    if (!active) {
      if (touch) { if (dist > 8) { cancelled = true; cleanup(); } return; }
      if (dist < 5) return;
      activate();
    }
    h.onMove(ev);
  };
  const up = (ev: PointerEvent) => { cleanup(); if (active) h.onEnd(ev); else if (!cancelled) h.onTap?.(); };
  const cancel = () => { cleanup(); if (active) h.onEnd(null); };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel);
}

const Agenda: React.FC<Props> = (props) => {
  const { appData, date, now, view, onViewChange, onDateChange, onToggle, onOpenTask, onSetTime, onMoveTask, onQuickAdd, calendars = [], eventsOf, calVersion = 0, onOpenCalendars, onPlanWeek } = props;
  const todayKey = getKeyFromDate(now);
  const dateKey = getKeyFromDate(date);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Couleur stable par nom de bloc (ordre du plan)
  const colorOf = useMemo(() => {
    const titles: string[] = [];
    appData.blocks.forEach(b => { if (!titles.includes(b.title)) titles.push(b.title); });
    (Object.values(appData.days) as { blocks?: { title: string }[] }[]).forEach(d => d.blocks?.forEach(b => { if (!titles.includes(b.title)) titles.push(b.title); }));
    return (t: string) => BLOCK_COLORS[Math.max(0, titles.indexOf(t)) % BLOCK_COLORS.length];
  }, [appData.blocks, appData.days]);

  // Semaine (lundi → dimanche) contenant le jour affiché
  const mondayKey = (() => { const m = new Date(date); m.setHours(12, 0, 0, 0); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return getKeyFromDate(m); })();
  const monday = useMemo(() => new Date(mondayKey + 'T12:00:00'), [mondayKey]);
  const occs = useMemo(() => {
    if (!eventsOf || !calendars.length) return [];
    const from = new Date(monday); from.setHours(0, 0, 0, 0); const to = new Date(from); to.setDate(from.getDate() + 7);
    return occurrencesBetween(calendars, eventsOf, from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendars, eventsOf, calVersion, monday]);

  const day = useMemo(() => dayItems(appData, date, colorOf, occs), [appData, date, colorOf, occs]);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return { date: d, key: getKeyFromDate(d), ...dayItems(appData, d, colorOf, occs) }; }), [appData, monday, colorOf, occs]);

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

  // Défilement automatique quand on glisse près du bord de l'agenda
  const autoScroll = useRef<{ y: number; timer?: number }>({ y: -1 });
  const startAutoScroll = () => {
    window.clearInterval(autoScroll.current.timer);
    autoScroll.current.timer = window.setInterval(() => {
      const el = scrollRef.current; const y = autoScroll.current.y; if (!el || y < 0) return;
      const r = el.getBoundingClientRect(); const edge = 48;
      // Seulement quand le pointeur est dans la bande haute / basse de l'agenda
      if (y >= r.top && y < r.top + edge) el.scrollTop -= Math.ceil((r.top + edge - y) / 4);
      else if (y <= r.bottom && y > r.bottom - edge) el.scrollTop += Math.ceil((y - (r.bottom - edge)) / 4);
    }, 16);
  };
  const stopAutoScroll = () => { window.clearInterval(autoScroll.current.timer); autoScroll.current.y = -1; };
  useEffect(() => () => window.clearInterval(autoScroll.current.timer), []);
  const minuteAt = (clientY: number) => {
    const g = gridRef.current; if (!g) return 0;
    const r = g.getBoundingClientRect();
    return Math.min(23 * 60 + 45, Math.max(0, Math.floor(((clientY - r.top) / PX + startH * 60) / SNAP) * SNAP));
  };

  // ---------- Glisser pour déplacer / redimensionner (pas de 15 min) ----------
  const [drag, setDrag] = useState<{ id: string; mode: 'move' | 'resize'; dmin: number; col?: number } | null>(null);

  const startDrag = (e: React.PointerEvent, item: Item, mode: 'move' | 'resize', dayKey: string, col = 0) => {
    e.stopPropagation();
    if (!item.task) return;
    const colW = gridRef.current ? gridRef.current.getBoundingClientRect().width / (view === 'week' ? 7 : 1) : 1;
    const x0 = e.clientX, y0 = e.clientY; const s0 = scrollRef.current?.scrollTop || 0;
    const calc = (ev: PointerEvent) => {
      const dy = ev.clientY - y0 + ((scrollRef.current?.scrollTop || 0) - s0);
      const dmin = Math.round(dy / PX / SNAP) * SNAP;
      const c = view === 'week' && mode === 'move' ? Math.min(6, Math.max(0, col + Math.round((ev.clientX - x0) / colW))) : col;
      return { dmin, c };
    };
    beginPress(e, {
      onTap: () => onOpenTask(item.blockId, item.task!.id),
      onStart: () => { setDrag({ id: item.key, mode, dmin: 0, col }); startAutoScroll(); },
      onMove: (ev) => { autoScroll.current.y = ev.clientY; const { dmin, c } = calc(ev); setDrag({ id: item.key, mode, dmin, col: c }); },
      onEnd: (ev) => {
        stopAutoScroll(); setDrag(null);
        if (!ev) return;
        const { dmin, c } = calc(ev);
        if (mode === 'resize') {
          const dur = Math.max(SNAP, item.dur + dmin);
          if (dur !== item.dur) onSetTime(item.blockId, item.task!.id, { duration: dur }, dayKey);
          return;
        }
        const start = Math.min(23 * 60 + 45, Math.max(0, item.start + dmin));
        if (view === 'week' && week[c].key !== dayKey) { onMoveTask(item.task!.id, week[c].key, toHHMM(start)); return; }
        if (start !== item.start) onSetTime(item.blockId, item.task!.id, { startTime: toHHMM(start) }, dayKey);
      },
    });
  };

  // ---------- Glisser une tâche « à placer » sur la grille ----------
  const [ghost, setGhost] = useState<{ u: Untimed; x: number; y: number; min: number | null } | null>(null);
  const ghostRef = useRef<typeof ghost>(null);
  const setG = (g: typeof ghost) => { ghostRef.current = g; setGhost(g); };
  const startPlace = (e: React.PointerEvent, u: Untimed) => {
    const x0 = e.clientX, y0 = e.clientY;
    beginPress(e, {
      onTap: () => onOpenTask(u.blockId, u.task.id),
      onStart: () => { setG({ u, x: x0, y: y0, min: null }); startAutoScroll(); },
      onMove: (ev) => {
        autoScroll.current.y = ev.clientY;
        const r = gridRef.current?.getBoundingClientRect(); const sr = scrollRef.current?.getBoundingClientRect();
        const over = !!r && !!sr && ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= Math.max(r.top, sr.top) && ev.clientY <= Math.min(r.bottom, sr.bottom);
        setG({ u, x: ev.clientX, y: ev.clientY, min: over ? minuteAt(ev.clientY) : null });
      },
      onEnd: (ev) => {
        stopAutoScroll();
        const g = ghostRef.current; setG(null);
        if (ev && g && g.min !== null) onSetTime(u.blockId, u.task.id, { startTime: toHHMM(g.min), duration: u.task.duration || 30 }, dateKey);
      },
    });
  };

  // ---------- Ajout rapide sur un créneau vide ----------
  const [quick, setQuick] = useState<{ start: number; dayKey: string; title: string; blockId: string; dur: number } | null>(null);
  const [info, setInfo] = useState<Occurrence | null>(null);
  const dayBlocks = (k: string) => resolveDay(appData, new Date(k + 'T12:00:00'));
  const openQuick = (e: React.MouseEvent, k: string) => {
    if ((e.target as HTMLElement).closest('[data-event]')) return;
    const blocks = dayBlocks(k);
    setQuick({ start: minuteAt(e.clientY), dayKey: k, title: '', blockId: blocks[0]?.id || '', dur: 30 });
  };
  const submitQuick = () => {
    if (!quick || !quick.title.trim()) return;
    onQuickAdd(quick.blockId, quick.title.trim(), toHHMM(quick.start), quick.dur, quick.dayKey);
    setQuick(null);
  };

  // ---------- Rendu d'un événement ----------
  const renderEvent = (it: Item, k: string, compact: boolean, col = 0) => {
    const dragging = drag?.id === it.key;
    let top = (it.start - startH * 60) * PX;
    let h = Math.max(compact ? 18 : 26, it.dur * PX);
    let leftCol = col;
    if (dragging && drag) {
      if (drag.mode === 'move') { top += drag.dmin * PX; leftCol = drag.col ?? col; }
      else h = Math.max(SNAP * PX, h + drag.dmin * PX);
    }
    const previewStart = dragging && drag?.mode === 'move' ? it.start + drag.dmin : it.start;
    const previewDur = dragging && drag?.mode === 'resize' ? Math.max(SNAP, it.dur + drag.dmin) : it.dur;
    const w = 100 / it.lanes;
    const style: React.CSSProperties = view === 'week'
      ? { top, height: h, left: `calc(${(leftCol + (it.lane * w) / 100) * (100 / 7)}% + 2px)`, width: `calc(${w / 7}% - 4px)` }
      : { top, height: h, left: `calc(${it.lane * w}% + 6px)`, width: `calc(${w}% - 10px)` };
    const timeTxt = `${label(previewStart)}–${label(previewStart + previewDur)}`;

    if (it.ext) {
      const o = it.ext;
      return (
        <div key={it.key} data-event data-ext onClick={(e) => { e.stopPropagation(); setInfo(o); }}
          className="absolute rounded-lg overflow-hidden select-none cursor-pointer z-[5] hover:z-20 hover:shadow-lg"
          style={{ ...style, backgroundColor: `${it.color}1f`, backgroundImage: `repeating-linear-gradient(135deg, ${it.color}22 0 6px, transparent 6px 12px)`, boxShadow: `inset 0 0 0 1px ${it.color}66` }}
          title={`${o.title} · ${timeTxt} · ${o.calendarName} (agenda externe)`}>
          <div className={`h-full ${compact ? 'px-1 py-0.5' : 'px-2 py-1'} ${it.done ? 'opacity-60' : ''}`}>
            <p className={`${compact ? 'text-[9px]' : 'text-[12px]'} font-bold leading-tight truncate ${ink}`}>{o.title}</p>
            {!compact && h >= 38 && <p className={`text-[10px] font-semibold truncate ${muted}`}>{timeTxt} · {o.calendarName}</p>}
          </div>
        </div>
      );
    }

    return (
      <div key={it.key} data-event
        onPointerDown={(e) => startDrag(e, it, 'move', k, col)}
        onContextMenu={e => e.preventDefault()}
        className={`group absolute rounded-lg overflow-hidden select-none touch-manipulation [-webkit-touch-callout:none] cursor-grab active:cursor-grabbing transition-shadow ${dragging ? 'z-30 shadow-2xl ring-2 ring-white/40' : 'z-10 hover:z-20 hover:shadow-lg'}`}
        style={{ ...style, backgroundColor: `${it.color}${it.done ? '22' : '33'}`, boxShadow: `inset 3px 0 0 ${it.conflict && !it.done ? '#e66767' : it.color}` }}
        title={`${it.task!.title} · ${timeTxt} · ${it.blockTitle}${it.conflict ? ' · chevauchement' : ''}`}>
        <div className={`h-full flex ${compact ? 'px-1 py-0.5' : 'pl-2.5 pr-1.5 py-1'} gap-1.5`}>
          {!compact && k === dateKey && (
            <button onPointerDown={e => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onToggle(it.blockId, it.task!.id); }}
              aria-label={it.done ? 'Marquer comme non faite' : 'Marquer comme faite'}
              className="mt-0.5 w-4 h-4 shrink-0 rounded-[5px] flex items-center justify-center border-2 transition-all"
              style={{ borderColor: it.color, backgroundColor: it.done ? it.color : 'transparent' }}>
              {it.done && <Check size={10} strokeWidth={4} className="text-white" />}
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className={`${compact ? 'text-[9px]' : 'text-[12px]'} font-bold leading-tight truncate ${ink} ${it.done ? 'line-through opacity-60' : ''}`}>{it.task!.title}</p>
            {!compact && h >= 38 && <p className={`text-[10px] font-semibold truncate ${muted}`}>{timeTxt} · {it.blockTitle}</p>}
            {compact && h >= 34 && <p className={`text-[8px] font-semibold truncate ${muted}`}>{label(previewStart)}</p>}
          </div>
          {it.conflict && !it.done && !compact && <AlertTriangle size={12} className="text-[#e66767] shrink-0 mt-0.5" aria-label="Chevauchement" />}
        </div>
        {/* Poignée de durée */}
        <div onPointerDown={(e) => startDrag(e, it, 'resize', k, col)} title="Glisser pour changer la durée"
          className="absolute left-0 right-0 bottom-0 h-2.5 cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-60">
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
  const tasksTimed = day.timed.filter(i => i.task);
  const meetings = day.timed.filter(i => i.ext);
  const planned = tasksTimed.reduce((s, i) => s + i.dur, 0);
  const doneMin = tasksTimed.filter(i => i.done).reduce((s, i) => s + i.dur, 0);
  const conflicts = day.timed.filter(i => i.conflict).length;
  const next = dateKey === todayKey ? day.timed.find(i => !i.done && i.start + i.dur > nowMin) : undefined;
  const objective = (() => { const d = appData.days[dateKey]; return d?.dailyGoalOverride || (appData.recurringGoals || []).find(g => isDateInRange(date, g.recurrence, g.specificDate, g.startDate, g.endDate, g.stopDate))?.title || ''; })();

  const shift = (n: number) => { const d = new Date(date); d.setDate(d.getDate() + n * (view === 'week' ? 7 : 1)); onDateChange(d); };
  const title = view === 'day'
    ? date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    : `${week[0].date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${week[6].date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const todo = day.untimed.filter(u => !u.done);
  const allDayChip = (o: Occurrence, compact = false) => (
    <button key={o.uid} onClick={() => setInfo(o)} className={`max-w-full truncate rounded-md text-left font-bold ${compact ? 'px-1 py-0.5 text-[8px]' : 'px-2 py-1 text-[11px]'} ${ink}`} style={{ backgroundColor: `${o.color}2e`, boxShadow: `inset 2px 0 0 ${o.color}` }} title={`${o.title} · ${o.calendarName}`}>{o.title}</button>
  );
  const visibleCals = calendars.filter(c => !c.hidden);

  return (
    <div className="glass rounded-[2rem] p-4 sm:p-6 space-y-4">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className={`font-black uppercase tracking-wider text-sm flex items-center gap-2 mr-auto ${ink}`}><CalendarClock size={16} className="text-accent" /> Agenda</h2>
        {onPlanWeek && <button onClick={onPlanWeek} title="Planifier ma semaine" aria-label="Planifier ma semaine" className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 hover:text-accent transition-all ${muted}`}><Sparkles size={13} /><span className="hidden sm:inline">Planifier la semaine</span></button>}
        {onOpenCalendars && <button onClick={onOpenCalendars} title="Agendas externes (Google, Outlook, iCloud)" aria-label="Agendas externes" className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 hover:text-accent transition-all ${muted}`}><CalendarPlus size={13} /><span className="hidden sm:inline">Agendas</span>{visibleCals.length > 0 && <span className="px-1.5 rounded-full bg-accent text-white text-[9px]">{visibleCals.length}</span>}</button>}
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
              { l: 'Planifié', v: fmtDur(planned), s: `${tasksTimed.length} tâche${tasksTimed.length > 1 ? 's' : ''}${meetings.length ? ` · ${meetings.length} rdv` : ' à heure fixe'}` },
              { l: 'Accompli', v: planned ? `${Math.round((doneMin / planned) * 100)} %` : '—', s: `${fmtDur(doneMin)} sur ${fmtDur(planned)}` },
              { l: next ? 'Prochaine' : 'À placer', v: next ? label(next.start) : String(todo.length), s: next ? (next.task?.title || next.ext?.title || '') : 'tâche(s) sans horaire' },
              { l: 'Chevauchements', v: String(conflicts), s: conflicts ? 'éléments en même temps' : 'aucun conflit' },
            ].map(c => (
              <div key={c.l} className="rounded-2xl bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] border border-[#18181B]/5 dark:border-[#E6E8E6]/5 px-3 py-2.5 min-w-0">
                <p className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>{c.l}</p>
                <p className={`text-lg font-black leading-tight ${c.l === 'Chevauchements' && conflicts ? 'text-[#e66767]' : ink}`}>{c.v}</p>
                <p className={`text-[10px] font-semibold truncate ${muted}`}>{c.s}</p>
              </div>
            ))}
          </div>

          {/* À placer : tâches sans horaire, à glisser sur la grille */}
          {todo.length > 0 && (
            <div className="space-y-2" aria-label="Tâches à placer">
              <p className={`text-[10px] font-black uppercase tracking-widest flex flex-wrap items-center gap-1.5 ${muted}`}><Clock size={12} /> À placer ({todo.length}) <span className={`normal-case tracking-normal font-semibold ${faint}`}><span className="[@media(hover:none)]:hidden">· glisse-les sur un créneau</span><span className="hidden [@media(hover:none)]:inline">· appui long, puis glisse sur un créneau</span></span></p>
              <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                {todo.map(u => (
                  <div key={u.task.id} data-place={u.task.id} onPointerDown={(e) => startPlace(e, u)} onContextMenu={e => e.preventDefault()}
                    className={`shrink-0 max-w-[240px] flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-xl border select-none touch-manipulation [-webkit-touch-callout:none] cursor-grab active:cursor-grabbing transition-all ${ghost?.u.task.id === u.task.id ? 'opacity-40' : ''} bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] border-[#18181B]/5 dark:border-[#E6E8E6]/5 hover:border-accent/40`}>
                    <Hand size={12} className={`shrink-0 ${faint}`} />
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: u.color }} />
                    <span className="min-w-0">
                      <span className={`block text-[12px] font-bold truncate ${ink}`}>{u.task.title}</span>
                      <span className={`block text-[9px] font-semibold truncate ${muted}`}>{u.blockTitle}{u.task.duration ? ` · ${fmtDur(u.task.duration)}` : ''}</span>
                    </span>
                    <input type="time" aria-label={`Heure pour ${u.task.title}`} step={900} onPointerDown={e => e.stopPropagation()}
                      onChange={e => e.target.value && onSetTime(u.blockId, u.task.id, { startTime: e.target.value, duration: u.task.duration || 30 }, dateKey)}
                      className={`w-[74px] shrink-0 bg-transparent text-[10px] font-bold rounded-lg px-1 py-1 border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent [color-scheme:dark] ${ink}`} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {day.allDay.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5"><span className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>Toute la journée</span>{day.allDay.map(o => allDayChip(o))}</div>
          )}
        </>
      )}

      {/* Grille */}
      <div ref={scrollRef} className="relative max-h-[62vh] overflow-y-auto overflow-x-auto custom-scrollbar rounded-2xl border border-[#18181B]/5 dark:border-[#E6E8E6]/5">
        {view === 'week' && (
          <div className="sticky top-0 z-30 bg-[#F4F4F5]/95 dark:bg-[#0d0d0d]/95 backdrop-blur border-b border-[#18181B]/5 dark:border-[#E6E8E6]/5 min-w-[640px]">
            <div className="flex">
              <div className="w-11 shrink-0" />
              {week.map(w => (
                <button key={w.key} onClick={() => { onDateChange(w.date); onViewChange('day'); }} className="flex-1 py-2 text-center hover:bg-accent/10 transition-colors" title="Voir ce jour">
                  <p className={`text-[9px] font-black uppercase ${w.key === todayKey ? 'text-accent' : muted}`}>{w.date.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}</p>
                  <p className={`text-sm font-black ${w.key === todayKey ? 'text-accent' : ink}`}>{w.date.getDate()}</p>
                  <p className={`text-[8px] font-bold ${faint}`}>{(() => { const m = w.timed.filter(i => i.task).reduce((s, i) => s + i.dur, 0); const n = w.untimed.filter(u => !u.done).length; return m ? fmtDur(m) + (n ? ` +${n}` : '') : n ? `${n} sans h.` : '—'; })()}</p>
                </button>
              ))}
            </div>
            {week.some(w => w.allDay.length) && (
              <div className="flex border-t border-[#18181B]/5 dark:border-[#E6E8E6]/5">
                <div className="w-11 shrink-0" />
                {week.map(w => <div key={w.key} className="flex-1 min-w-0 p-0.5 space-y-0.5 flex flex-col">{w.allDay.slice(0, 2).map(o => allDayChip(o, true))}{w.allDay.length > 2 && <span className={`text-[8px] font-bold px-1 ${muted}`}>+{w.allDay.length - 2}</span>}</div>)}
              </div>
            )}
          </div>
        )}
        <div className={`flex pt-3 pb-3 ${view === 'week' ? 'min-w-[640px]' : ''}`}>
          {hourLabels}
          <div ref={gridRef} data-grid className="relative flex-1 cursor-copy" style={{ height }} onClick={view === 'day' ? (e) => openQuick(e, dateKey) : undefined}>
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
            {/* Aperçu de dépôt d'une tâche à placer */}
            {ghost && ghost.min !== null && view === 'day' && (
              <div data-drop-preview className="absolute left-1.5 right-1.5 z-30 rounded-lg border-2 border-dashed pointer-events-none flex items-start px-2 py-1"
                style={{ top: (ghost.min - startH * 60) * PX, height: Math.max(22, (ghost.u.task.duration || 30) * PX), borderColor: ghost.u.color, backgroundColor: `${ghost.u.color}22` }}>
                <span className={`text-[11px] font-black ${ink}`}>{label(ghost.min)} · {ghost.u.task.title}</span>
              </div>
            )}
            {view === 'day' && day.timed.length === 0 && (
              <p className={`absolute inset-x-0 top-16 text-center text-xs font-semibold px-6 pointer-events-none ${muted}`}>Aucune tâche à heure fixe ce jour-là.<br />Touche un créneau pour en ajouter une{todo.length ? ', ou glisse une tâche « à placer »' : ''}.</p>
            )}
          </div>
        </div>
      </div>
      <p className={`text-[10px] font-medium ${faint}`}>
        <span className="[@media(hover:none)]:hidden">Clique un créneau vide pour ajouter une tâche · fais glisser une tâche pour la déplacer (par 15 min{view === 'week' ? ', ou vers un autre jour' : ''}) · tire son bord bas pour changer la durée · clique-la pour la configurer.</span>
        <span className="hidden [@media(hover:none)]:inline">Touche un créneau vide pour ajouter une tâche · appui long sur une tâche puis glisse pour la déplacer{view === 'week' ? ' (ou vers un autre jour)' : ''} · appui long sur son bord bas pour la durée · touche-la pour la configurer.</span>
        {visibleCals.length > 0 && ' Les rendez-vous hachurés viennent de tes agendas externes (lecture seule).'}
      </p>

      {/* Légende des blocs et agendas */}
      {(() => {
        const items = view === 'day' ? day.timed : week.flatMap(w => w.timed);
        const titles = [...new Set((view === 'day' ? [...day.timed.filter(i => i.task), ...day.untimed] : items.filter(i => i.task)).map(i => i.blockTitle))];
        const cals = visibleCals.filter(c => items.some(i => i.ext?.calendarId === c.id));
        return (titles.length > 0 || cals.length > 0) && (
          <div className={`flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold ${muted}`}>
            {titles.map(t => <span key={t} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: colorOf(t) }} />{t}</span>)}
            {cals.map(c => <span key={c.id} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundImage: `repeating-linear-gradient(135deg, ${c.color} 0 2px, transparent 2px 4px)`, boxShadow: `inset 0 0 0 1px ${c.color}` }} />{c.name}</span>)}
            {day.timed.some(i => i.conflict) && view === 'day' && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] bg-[#e66767]" />Chevauchement</span>}
          </div>
        );
      })()}

      {/* Fantôme qui suit le doigt / la souris */}
      {ghost && (
        <div className="fixed z-[140] pointer-events-none -translate-x-1/2 -translate-y-[130%] px-3 py-2 rounded-xl shadow-2xl text-[12px] font-black text-white whitespace-nowrap" style={{ left: ghost.x, top: ghost.y, backgroundColor: ghost.u.color }}>
          {ghost.u.task.title}{ghost.min !== null ? ` · ${label(ghost.min)}` : ''}
        </div>
      )}

      {/* Détail d'un rendez-vous externe */}
      {info && (
        <div className="fixed inset-0 z-[130] bg-black/40 flex items-end sm:items-center justify-center p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) setInfo(null); }}>
          <div className="glass bg-[#F4F4F5] dark:bg-[#111] w-full max-w-sm rounded-3xl p-5 space-y-3 animate-in slide-in-from-bottom-4">
            <div className="flex items-start justify-between gap-3">
              <p className={`text-base font-black ${ink}`}>{info.title}</p>
              <button onClick={() => setInfo(null)} aria-label="Fermer" className={`p-1.5 rounded-full hover:text-accent ${muted}`}><X size={16} /></button>
            </div>
            <p className={`text-xs font-bold capitalize-first ${ink}`}>{info.start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}{info.allDay ? ' · toute la journée' : ` · ${toHHMM(info.start.getHours() * 60 + info.start.getMinutes())} – ${toHHMM(info.end.getHours() * 60 + info.end.getMinutes())}`}</p>
            {info.location && <p className={`flex items-start gap-1.5 text-xs font-semibold ${muted}`}><MapPin size={13} className="shrink-0 mt-0.5" />{info.location}</p>}
            <p className={`flex items-center gap-1.5 text-[11px] font-bold ${muted}`}><span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: info.color }} />{info.calendarName} · lecture seule</p>
            <p className={`text-[10px] font-medium ${faint}`}>Pour le modifier, ouvre ton agenda d'origine ; Caddr se met à jour automatiquement.</p>
          </div>
        </div>
      )}

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
              {dayBlocks(quick.dayKey).length === 0 ? <p className={`text-[11px] ${muted}`}>Aucun bloc ce jour-là : un bloc « Tâches du jour » sera créé.</p> : (
                <div className="flex flex-wrap gap-2">
                  {dayBlocks(quick.dayKey).map(b => (
                    <button key={b.id} onClick={() => setQuick({ ...quick, blockId: b.id })} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold border transition-all ${quick.blockId === b.id ? 'border-accent bg-accent/10 text-accent' : `border-transparent bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 ${ink}`}`}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorOf(b.title) }} />{b.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={submitQuick} disabled={!quick.title.trim()} className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all ${quick.title.trim() ? 'bg-accent text-white shadow-lg shadow-accent/20' : `bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 ${faint}`}`}><Plus size={14} /> Ajouter ce jour-là</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Agenda;
