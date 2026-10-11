// Calculs de l'onglet Analytics.
// Une journée est évaluée exactement comme l'onglet Routine l'affiche :
// copie « figée » du jour si elle existe, sinon le plan ; blocs, tâches et
// sous-tâches filtrés par leur récurrence.
import { AppData, Block, Task, TimeframeType } from './types';
import { getKeyFromDate, isDateInRange } from './utils';

export interface DayTask { id: string; title: string; block: string; done: boolean; isSub: boolean }
export interface DayBlock { title: string; total: number; done: number }
export interface DayStat {
  date: string;
  total: number;
  done: number;
  rate: number | null;   // null = aucune tâche prévue (≠ 0 %)
  future: boolean;
  blocks: DayBlock[];
  tasks: DayTask[];
}

export interface BlockAgg {
  title: string;
  total: number;          // tâches prévues sur la période
  done: number;
  rate: number;           // % de tâches faites
  daysScheduled: number;  // jours où le bloc avait des tâches
  daysComplete: number;   // jours où le bloc a été fait à 100 %
  prevRate: number | null;
  perDay: { date: string; rate: number | null; done: number; total: number; future: boolean }[];
}

export interface HabitAgg {
  id: string;
  title: string;
  block: string;
  current: number;        // série en cours (jours prévus consécutifs réussis)
  best: number;           // meilleure série sur 12 mois
  due: number;            // jours prévus sur la période
  done: number;
  rate: number | null;
  perDay: { date: string; state: 'done' | 'missed' | 'off' | 'future' | 'today' }[];
}

export interface Bucket { key: string; label: string; sub: string; rate: number | null; done: number; total: number; future: boolean; perfect: boolean; days: number }

export interface PeriodRange { start: Date; end: Date; label: string; short: string }

const DAY = 86400000;
const atNoon = (k: string) => new Date(k + 'T12:00:00');

export function resolveDay(appData: AppData, date: Date): Block[] {
  const k = getKeyFromDate(date);
  const frozen = appData.days[k]?.blocks;
  const source = frozen || appData.blocks;
  return source.filter(b => isDateInRange(date, b.recurrence, b.specificDate, b.startDate, b.endDate, b.stopDate));
}

const visible = (tasks: Task[] | undefined, date: Date) =>
  (tasks || []).filter(t => isDateInRange(date, t.recurrence, t.specificDate, t.startDate, t.endDate, t.stopDate));

// Début du suivi : premier jour où une tâche a été cochée (ou un jour personnalisé).
// Avant cette date, le plan n'existait pas encore : on ne compte rien (≠ 0 %).
const sinceCache = new WeakMap<object, string>();
export function trackingStart(appData: AppData): string {
  const hit = sinceCache.get(appData);
  if (hit !== undefined) return hit;
  let min = '9999-99-99';
  const scan = (tasks?: Task[]) => (tasks || []).forEach(t => {
    (t.completedDates || []).forEach(d => { if (d < min) min = d; });
    scan(t.subTasks);
  });
  appData.blocks.forEach(b => scan(b.tasks));
  Object.entries(appData.days).forEach(([k, d]) => {
    if (d.blocks) { if (k < min) min = k; d.blocks.forEach(b => scan(b.tasks)); }
  });
  sinceCache.set(appData, min);
  return min;
}

// Tâches annulées, reportées, affectées ou sautées ce jour-là : elles ne comptent pas dans le taux
const skipCache = new WeakMap<object, Set<string>>();
const skippedSet = (appData: AppData): Set<string> => {
  const hit = skipCache.get(appData); if (hit) return hit;
  const s = new Set((appData.skips || []).map(x => `${x.taskId}|${x.date}`));
  skipCache.set(appData, s); return s;
};

export function computeDay(appData: AppData, dateKey: string, todayKey: string): DayStat {
  const date = atNoon(dateKey);
  const future = dateKey > todayKey;
  if (!future && dateKey < trackingStart(appData)) {
    return { date: dateKey, total: 0, done: 0, rate: null, future: false, blocks: [], tasks: [] };
  }
  const blocks: DayBlock[] = [];
  const tasks: DayTask[] = [];
  let total = 0, done = 0;
  resolveDay(appData, date).forEach(b => {
    let bt = 0, bd = 0;
    const skipped = skippedSet(appData);
    visible(b.tasks, date).filter(t => !skipped.has(`${t.id}|${dateKey}`)).forEach(t => {
      const d = !!t.completedDates?.includes(dateKey);
      bt++; if (d) bd++;
      tasks.push({ id: t.id, title: t.title, block: b.title, done: d, isSub: false });
      visible(t.subTasks, date).forEach(st => {
        const sd = !!st.completedDates?.includes(dateKey);
        bt++; if (sd) bd++;
        tasks.push({ id: st.id, title: st.title, block: b.title, done: sd, isSub: true });
      });
    });
    if (bt > 0) blocks.push({ title: b.title, total: bt, done: bd });
    total += bt; done += bd;
  });
  return { date: dateKey, total, done, rate: total ? Math.round((done / total) * 100) : null, future, blocks, tasks };
}

export function eachDay(start: Date, end: Date): string[] {
  const out: string[] = [];
  const c = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12);
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12);
  while (c <= e) { out.push(getKeyFromDate(c)); c.setDate(c.getDate() + 1); }
  return out;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Période calendaire contenant la date d'ancrage (semaine = lundi → dimanche)
export function getPeriod(tf: TimeframeType, anchor: Date, custom?: { start: string; end: string }): PeriodRange {
  const a = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 12);
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('fr-FR', o);
  if (tf === 'day') {
    return { start: a, end: a, label: cap(fmt(a, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })), short: fmt(a, { day: 'numeric', month: 'short' }) };
  }
  if (tf === 'week') {
    const s = new Date(a); s.setDate(a.getDate() - ((a.getDay() + 6) % 7));
    const e = new Date(s); e.setDate(s.getDate() + 6);
    const sameMonth = s.getMonth() === e.getMonth();
    const label = `Semaine du ${fmt(s, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'long' })} au ${fmt(e, { day: 'numeric', month: 'long', year: 'numeric' })}`;
    return { start: s, end: e, label, short: 'cette semaine' };
  }
  if (tf === 'month') {
    const s = new Date(a.getFullYear(), a.getMonth(), 1, 12);
    const e = new Date(a.getFullYear(), a.getMonth() + 1, 0, 12);
    return { start: s, end: e, label: cap(fmt(s, { month: 'long', year: 'numeric' })), short: 'ce mois' };
  }
  if (tf === 'year') {
    const s = new Date(a.getFullYear(), 0, 1, 12);
    const e = new Date(a.getFullYear(), 11, 31, 12);
    return { start: s, end: e, label: `Année ${a.getFullYear()}`, short: 'cette année' };
  }
  const s = custom?.start ? atNoon(custom.start) : a;
  const e = custom?.end && custom.end >= (custom?.start || '') ? atNoon(custom.end) : s;
  return { start: s, end: e, label: `Du ${fmt(s, { day: 'numeric', month: 'short', year: 'numeric' })} au ${fmt(e, { day: 'numeric', month: 'short', year: 'numeric' })}`, short: 'la période' };
}

export function shiftAnchor(tf: TimeframeType, anchor: Date, dir: -1 | 1): Date {
  const a = new Date(anchor);
  if (tf === 'day') a.setDate(a.getDate() + dir);
  else if (tf === 'week') a.setDate(a.getDate() + 7 * dir);
  else if (tf === 'month') a.setMonth(a.getMonth() + dir, 1);
  else if (tf === 'year') a.setFullYear(a.getFullYear() + dir);
  return a;
}

// Période précédente de même nature (pour la comparaison)
export function previousPeriod(tf: TimeframeType, p: PeriodRange): { start: Date; end: Date } {
  if (tf === 'custom') {
    const len = Math.round((p.end.getTime() - p.start.getTime()) / DAY) + 1;
    const e = new Date(p.start.getTime() - DAY); const s = new Date(e.getTime() - (len - 1) * DAY);
    return { start: s, end: e };
  }
  const prev = getPeriod(tf, shiftAnchor(tf, p.start, -1));
  return { start: prev.start, end: prev.end };
}

const sumRate = (days: DayStat[]) => {
  const t = days.reduce((s, d) => s + (d.future ? 0 : d.total), 0);
  const dn = days.reduce((s, d) => s + (d.future ? 0 : d.done), 0);
  return { total: t, done: dn, rate: t ? Math.round((dn / t) * 100) : null };
};

export function computePeriod(appData: AppData, start: Date, end: Date, todayKey: string) {
  const days = eachDay(start, end).map(k => computeDay(appData, k, todayKey));
  const past = days.filter(d => !d.future);
  const { total, done, rate } = sumRate(days);
  const activeDays = past.filter(d => d.total > 0);
  const perfectDays = activeDays.filter(d => d.rate === 100).length;
  return { days, total, done, rate, activeDays: activeDays.length, perfectDays, elapsed: past.length };
}

export function blockAggregates(days: DayStat[], prevDays: DayStat[]): BlockAgg[] {
  const map = new Map<string, BlockAgg>();
  const titles = new Set<string>();
  days.forEach(d => d.blocks.forEach(b => titles.add(b.title)));
  titles.forEach(title => map.set(title, { title, total: 0, done: 0, rate: 0, daysScheduled: 0, daysComplete: 0, prevRate: null, perDay: [] }));
  days.forEach(d => {
    titles.forEach(title => {
      const agg = map.get(title)!;
      const b = d.blocks.find(x => x.title === title);
      if (!b || d.future) { agg.perDay.push({ date: d.date, rate: null, done: 0, total: 0, future: d.future }); return; }
      agg.total += b.total; agg.done += b.done; agg.daysScheduled++;
      if (b.done === b.total) agg.daysComplete++;
      agg.perDay.push({ date: d.date, rate: Math.round((b.done / b.total) * 100), done: b.done, total: b.total, future: false });
    });
  });
  map.forEach(agg => {
    agg.rate = agg.total ? Math.round((agg.done / agg.total) * 100) : 0;
    let pt = 0, pd = 0;
    prevDays.forEach(d => d.blocks.filter(b => b.title === agg.title).forEach(b => { pt += b.total; pd += b.done; }));
    agg.prevRate = pt ? Math.round((pd / pt) * 100) : null;
  });
  return [...map.values()].filter(a => a.daysScheduled > 0).sort((a, b) => b.rate - a.rate);
}

// Regroupement pour le graphique : jour par jour jusqu'à ~2 mois, sinon par semaine ou par mois
export function buildBuckets(days: DayStat[], tf: TimeframeType): Bucket[] {
  const fmt = (k: string, o: Intl.DateTimeFormatOptions) => atNoon(k).toLocaleDateString('fr-FR', o).replace(/\.$/, '');
  const byMonth = tf === 'year' || days.length > 120;
  const byWeek = !byMonth && days.length > 62;
  if (!byMonth && !byWeek) {
    return days.map(d => ({
      key: d.date,
      label: days.length <= 7 ? cap(fmt(d.date, { weekday: 'short' })) : fmt(d.date, { day: 'numeric' }),
      sub: cap(fmt(d.date, { weekday: 'long', day: 'numeric', month: 'long' })),
      rate: d.future ? null : d.rate, done: d.done, total: d.total, future: d.future,
      perfect: !d.future && d.rate === 100, days: 1,
    }));
  }
  const groups = new Map<string, DayStat[]>();
  days.forEach(d => {
    const dt = atNoon(d.date);
    let key: string;
    if (byMonth) key = d.date.slice(0, 7);
    else { const m = new Date(dt); m.setDate(dt.getDate() - ((dt.getDay() + 6) % 7)); key = getKeyFromDate(m); }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(d);
  });
  return [...groups.entries()].map(([key, list]) => {
    const { total, done, rate } = sumRate(list);
    const allFuture = list.every(d => d.future);
    const label = byMonth ? cap(fmt(key + '-01', { month: 'short' })) : fmt(key, { day: 'numeric', month: 'short' });
    const sub = byMonth ? cap(fmt(key + '-01', { month: 'long', year: 'numeric' })) : `Semaine du ${fmt(key, { day: 'numeric', month: 'long' })}`;
    return { key, label, sub, rate: allFuture ? null : rate, done, total, future: allFuture, perfect: false, days: list.filter(d => !d.future && d.total > 0).length };
  });
}

// Habitudes : tâches marquées « habitude », suivies par identifiant jour après jour
export function collectHabits(appData: AppData): { id: string; title: string; block: string }[] {
  const out = new Map<string, { id: string; title: string; block: string }>();
  const scan = (blocks: Block[] | undefined) => (blocks || []).forEach(b => b.tasks.forEach(t => {
    if (t.isHabit && !out.has(t.id)) out.set(t.id, { id: t.id, title: t.title, block: b.title });
  }));
  scan(appData.blocks);
  Object.values(appData.days).forEach(d => scan(d.blocks));
  // Une habitude retirée du plan ne doit plus apparaître si le plan la connaît sans le drapeau
  appData.blocks.forEach(b => b.tasks.forEach(t => { if (!t.isHabit) out.delete(t.id); }));
  return [...out.values()];
}

function habitStateOn(appData: AppData, habitId: string, dateKey: string): 'done' | 'missed' | 'off' {
  if (dateKey < trackingStart(appData)) return 'off';
  const date = atNoon(dateKey);
  for (const b of resolveDay(appData, date)) {
    const t = visible(b.tasks, date).find(x => x.id === habitId);
    if (t) return t.completedDates?.includes(dateKey) ? 'done' : 'missed';
  }
  return 'off';
}

export function habitAggregates(appData: AppData, periodDays: string[], todayKey: string): HabitAgg[] {
  const habits = collectHabits(appData);
  if (!habits.length) return [];
  const yearKeys = eachDay(new Date(Date.now() - 365 * DAY), atNoon(todayKey));
  return habits.map(h => {
    // Séries sur 12 mois
    let best = 0, run = 0;
    const states = yearKeys.map(k => ({ k, s: habitStateOn(appData, h.id, k) }));
    states.forEach(({ k, s }) => {
      if (s === 'done') { run++; best = Math.max(best, run); }
      else if (s === 'missed' && k !== todayKey) run = 0;
    });
    let current = 0;
    for (let i = states.length - 1; i >= 0; i--) {
      const { k, s } = states[i];
      if (s === 'off') continue;
      if (s === 'done') current++;
      else if (k === todayKey) continue; // la journée n'est pas finie
      else break;
    }
    let due = 0, done = 0;
    const perDay = periodDays.map(k => {
      if (k > todayKey) return { date: k, state: 'future' as const };
      const s = habitStateOn(appData, h.id, k);
      if (s !== 'off') { due++; if (s === 'done') done++; }
      if (k === todayKey && s === 'missed') return { date: k, state: 'today' as const };
      return { date: k, state: s };
    });
    return { ...h, current, best, due, done, rate: due ? Math.round((done / due) * 100) : null, perDay };
  }).sort((a, b) => b.current - a.current);
}

// Série de journées parfaites jusqu'à aujourd'hui (aujourd'hui en cours ne casse pas la série)
export function perfectStreak(appData: AppData, todayKey: string): { current: number; best: number } {
  const keys = eachDay(new Date(Date.now() - 365 * DAY), atNoon(todayKey));
  let best = 0, run = 0;
  const rates = keys.map(k => ({ k, r: computeDay(appData, k, todayKey).rate }));
  rates.forEach(({ k, r }) => {
    if (r === 100) { run++; best = Math.max(best, run); }
    else if (r !== null && k !== todayKey) run = 0;
  });
  let current = 0;
  for (let i = rates.length - 1; i >= 0; i--) {
    const { k, r } = rates[i];
    if (r === null) continue;
    if (r === 100) current++;
    else if (k === todayKey) continue;
    else break;
  }
  return { current, best };
}

// ---------- Objectif prioritaire du jour ----------
// Objectif du jour = texte saisi ce jour-là, sinon l'objectif programmé (récurrent) qui couvre ce jour.
export function objectiveFor(appData: AppData, dateKey: string): { title: string; done: boolean } | null {
  const day = appData.days[dateKey];
  const date = atNoon(dateKey);
  const title = day?.dailyGoalOverride?.trim()
    || (appData.recurringGoals || []).find(g => isDateInRange(date, g.recurrence, g.specificDate, g.startDate, g.endDate, g.stopDate))?.title?.trim()
    || '';
  if (!title) return null;
  return { title, done: !!day?.goalCompleted };
}

export interface ObjectiveStats {
  defined: number; done: number; rate: number | null;
  current: number; best: number;
  list: { date: string; title: string; done: boolean; today: boolean }[];
}

export function objectiveStats(appData: AppData, start: Date, end: Date, todayKey: string): ObjectiveStats {
  const since = trackingStart(appData);
  const list = eachDay(start, end).filter(k => k <= todayKey).map(k => {
    const o = objectiveFor(appData, k);
    if (!o) return null;
    if (k < since && !appData.days[k]) return null; // pas d'historique avant le début du suivi
    return { date: k, title: o.title, done: o.done, today: k === todayKey };
  }).filter(Boolean) as ObjectiveStats['list'];
  const closed = list.filter(o => !o.today || o.done); // aujourd'hui non coché : pas encore un échec
  const done = closed.filter(o => o.done).length;
  // Séries sur 12 mois
  const yearKeys = eachDay(new Date(atNoon(todayKey).getTime() - 365 * DAY), atNoon(todayKey));
  let best = 0, run = 0;
  const states = yearKeys.map(k => { const o = objectiveFor(appData, k); return { k, s: !o ? 'off' : o.done ? 'done' : 'missed' }; });
  states.forEach(({ k, s }) => { if (s === 'done') { run++; best = Math.max(best, run); } else if (s === 'missed' && k !== todayKey) run = 0; });
  let current = 0;
  for (let i = states.length - 1; i >= 0; i--) {
    const { k, s } = states[i];
    if (s === 'off') continue;
    if (s === 'done') current++; else if (k === todayKey) continue; else break;
  }
  return { defined: closed.length, done, rate: closed.length ? Math.round((done / closed.length) * 100) : null, current, best, list: list.reverse() };
}
