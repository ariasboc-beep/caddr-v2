import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip, Cell } from 'recharts';
import {
  ChevronLeft, ChevronRight, ChevronDown, FileText, TrendingUp, TrendingDown, Minus,
  Flame, Trophy, Target, Layers, Repeat, Check, CalendarDays, Star, ListChecks, Settings2, Loader2,
} from 'lucide-react';
import { AppData, TimeframeType } from '../types';
import { getKeyFromDate } from '../utils';
import {
  getPeriod, shiftAnchor, previousPeriod, computePeriod, blockAggregates, buildBuckets,
  habitAggregates, perfectStreak, eachDay, objectiveStats,
} from '../analytics';
import { activeHabits, habitStats as standaloneStats, stateOn as standaloneState } from '../habits';
import YearHeatmap from './YearHeatmap';
import DeepStats from './DeepStats';
import { Microscope } from 'lucide-react';
import { perfColor, perfStyle, perfLevel, perfFill, PERF_LEGEND } from '../perfScale';

import { Section } from './Section';
export { Section };

// ---------- Petits éléments ----------
const ink = 'text-[#18181B] dark:text-[#E6E8E6]';
const muted = 'text-[#18181B]/50 dark:text-[#E6E8E6]/50';
const faint = 'text-[#18181B]/35 dark:text-[#E6E8E6]/35';

const Delta: React.FC<{ now: number | null; prev: number | null; label?: string }> = ({ now, prev, label }) => {
  if (now === null || prev === null) return <span className={`text-[10px] font-bold ${faint}`}>Pas de comparaison</span>;
  const d = now - prev;
  const Icon = d > 0 ? TrendingUp : d < 0 ? TrendingDown : Minus;
  const color = d > 0 ? 'text-accent' : d < 0 ? 'text-[#DF2935]' : muted;
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1 text-[10px] font-black ${color}`} title={label}>
      <Icon size={12} /> {d > 0 ? '+' : ''}{d} pt{Math.abs(d) > 1 ? 's' : ''}
      {label && <span className={`font-bold ${muted}`}>&nbsp;{label}</span>}
    </span>
  );
};

const Tile: React.FC<{ label: string; value: React.ReactNode; foot?: React.ReactNode; icon: React.ReactNode; rate?: number | null }> = ({ label, value, foot, icon, rate }) => (
  <div className="rounded-2xl bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] border border-[#18181B]/5 dark:border-[#E6E8E6]/5 p-4 flex flex-col gap-1.5 min-w-0">
    <span className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest ${muted}`}>{icon}{label}</span>
    <span className={`text-2xl font-black leading-none ${ink}`} style={perfStyle(rate)}>{value}{rate !== undefined && perfLevel(rate) && <span className="ml-1.5 align-middle text-[9px] font-black uppercase tracking-wider">{perfLevel(rate)!.label}</span>}</span>
    {foot && <span className="text-[10px] font-bold min-h-[14px]">{foot}</span>}
  </div>
);

// Couleur d'une case : même échelle que les chiffres (rouge → orange → vert clair → vert)
const cellStyle = (rate: number | null, _accent?: string): React.CSSProperties => {
  if (rate === null) return {};
  if (rate === 0) return { backgroundColor: 'transparent', boxShadow: `inset 0 0 0 1.5px ${perfColor(0)}` };
  return { backgroundColor: perfColor(rate) };
};

// Légende des couleurs, commune à tout l'onglet
const PerfLegend: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-bold ${muted} ${className}`}>
    {PERF_LEGEND.map(l => <span key={l.name} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} /><span className={`font-black ${ink}`}>{l.name}</span> {l.label}</span>)}
  </div>
);

// Pourcentage coloré selon l'échelle
const Pct: React.FC<{ v: number | null | undefined; className?: string }> = ({ v, className = '' }) =>
  <span className={`font-black ${className}`} style={perfStyle(v)}>{v === null || v === undefined ? '—' : `${v} %`}</span>;

const fmtDay = (k: string, o: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  new Date(k + 'T12:00:00').toLocaleDateString('fr-FR', o).replace(/\.$/, '');

// Info-bulle flottante partagée (survol des cases)
type Tip = { x: number; y: number; lines: string[] } | null;

interface Props {
  appData: AppData;
  accentHex: string;
  onToggleHabit: (taskId: string, value: boolean) => void;
  onDownloadPDF: (tf: TimeframeType, period: ReturnType<typeof getPeriod>) => void | Promise<void>;
  children?: React.ReactNode; // sections complémentaires (rendues en bas)
  onOpenHabits?: () => void;
}

const TF_LABEL: Record<TimeframeType, string> = { day: 'Jour', week: 'Semaine', month: 'Mois', year: 'Année', custom: 'Période' };
const REPORT_NAME: Record<TimeframeType, string> = { day: 'rapport du jour', week: 'rapport hebdomadaire', month: 'rapport mensuel', year: 'rapport annuel', custom: 'rapport de la période' };

const Analytics: React.FC<Props> = ({ appData, accentHex, onToggleHabit, onDownloadPDF, children, onOpenHabits }) => {
  const todayKey = getKeyFromDate(new Date());
  const [tf, setTf] = useState<TimeframeType>(() => { try { return (localStorage.getItem('caddr_analytics_tf') as TimeframeType) || 'week'; } catch { return 'week'; } });
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [custom, setCustom] = useState<{ start: string; end: string }>(() => {
    const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 13);
    return { start: getKeyFromDate(s), end: getKeyFromDate(e) };
  });
  const [tip, setTip] = useState<Tip>(null);
  const [chooseHabits, setChooseHabits] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const chooseTf = (t: TimeframeType) => { setTf(t); setAnchor(new Date()); try { localStorage.setItem('caddr_analytics_tf', t); } catch {} };

  const period = useMemo(() => getPeriod(tf, anchor, custom), [tf, anchor, custom]);
  const isCurrent = period.start.getTime() <= Date.now() && Date.now() <= period.end.getTime() + 86400000;
  const canGoNext = tf !== 'custom' && getKeyFromDate(shiftAnchor(tf, period.start, 1)) <= todayKey;

  const stats = useMemo(() => computePeriod(appData, period.start, period.end, todayKey), [appData, period, todayKey]);
  const prev = useMemo(() => { const p = previousPeriod(tf, period); return computePeriod(appData, p.start, p.end, todayKey); }, [appData, period, tf, todayKey]);
  const blocks = useMemo(() => blockAggregates(stats.days, prev.days), [stats, prev]);
  const buckets = useMemo(() => buildBuckets(stats.days, tf), [stats, tf]);
  const habits = useMemo(() => habitAggregates(appData, eachDay(period.start, period.end), todayKey), [appData, period, todayKey]);
  const streak = useMemo(() => perfectStreak(appData, todayKey), [appData, todayKey]);
  const objective = useMemo(() => objectiveStats(appData, period.start, period.end, todayKey), [appData, period, todayKey]);
  // Habitudes indépendantes (onglet Habitudes), présentées comme les habitudes de tâches
  const standalone = useMemo(() => {
    const from = getKeyFromDate(period.start), to = getKeyFromDate(period.end);
    return activeHabits(appData.habits).map(h => {
      const all = standaloneStats(h);
      const per = standaloneStats(h, from, to);
      const perDay = eachDay(period.start, period.end).map(k => {
        const st = standaloneState(h, k, todayKey);
        const state = st === 'done' ? 'done' : st === 'fail' ? 'missed' : st === 'open' ? (k === todayKey ? 'today' : 'missed') : st === 'future' ? 'future' : 'off';
        return { date: k, state: state as 'done' | 'missed' | 'off' | 'future' | 'today' };
      });
      const due = per.done + per.fail + per.open;
      return { id: h.id, title: h.name, block: h.kind === 'quit' ? 'Habitude à arrêter' : 'Habitude indépendante', current: all.current, best: all.best, due, done: per.done, rate: due ? Math.round((per.done / due) * 100) : null, perDay, color: h.color, since: h.kind === 'quit' ? all.sinceLastFail : undefined };
    });
  }, [appData.habits, period, todayKey]);
  const allHabits: (typeof habits[number] & { color?: string; since?: number })[] = [...standalone, ...habits];
  const thisYear = new Date().getFullYear();
  const yearHistory = useMemo(() => {
    return computePeriod(appData, new Date(thisYear, 0, 1, 12), new Date(), todayKey).days.filter(d => d.rate !== null).map(d => ({ date: d.date, val: d.rate as number }));
  }, [appData, todayKey, thisYear]);

  const prevLabel = tf === 'week' ? 'vs semaine préc.' : tf === 'month' ? 'vs mois préc.' : tf === 'year' ? 'vs année préc.' : tf === 'day' ? 'vs veille' : 'vs période préc.';
  const avg = stats.rate;
  const withData = buckets.filter(b => b.rate !== null);
  const best = withData.length ? withData.reduce((a, b) => ((b.rate ?? 0) > (a.rate ?? 0) ? b : a)) : null;
  // Aujourd'hui n'est pas terminé : on ne le désigne pas comme « plus faible »
  const closed = withData.filter(b => b.key !== todayKey);
  const worst = closed.length > 1 ? closed.reduce((a, b) => ((b.rate ?? 0) < (a.rate ?? 0) ? b : a)) : null;
  const unit = tf === 'year' || stats.days.length > 120 ? 'mois' : stats.days.length > 62 ? 'semaine' : 'jour';
  const day = tf === 'day' ? stats.days[0] : null;

  const showTip = (e: React.MouseEvent, lines: string[]) => setTip({ x: e.clientX, y: e.clientY, lines });
  const hideTip = () => setTip(null);

  // Cases d'une bande (jour par jour jusqu'à 31 jours, sinon par mois)
  const strip = (perDay: { date: string; rate: number | null; done: number; total: number; future: boolean }[], label: string) => {
    let cells = perDay.map(p => ({ key: p.date, rate: p.rate, future: p.future, lines: [fmtDay(p.date), p.future ? 'À venir' : p.rate === null ? 'Pas prévu ce jour-là' : `${p.rate} % · ${p.done}/${p.total} tâche${p.total > 1 ? 's' : ''}`] }));
    if (perDay.length > 31) {
      const m = new Map<string, typeof perDay>();
      perDay.forEach(p => { const k = p.date.slice(0, 7); if (!m.has(k)) m.set(k, []); m.get(k)!.push(p); });
      cells = [...m.entries()].map(([k, list]) => {
        const t = list.reduce((s, x) => s + x.total, 0), dn = list.reduce((s, x) => s + x.done, 0);
        const rate = t ? Math.round((dn / t) * 100) : null;
        const fut = list.every(x => x.future);
        return { key: k, rate, future: fut, lines: [fmtDay(k + '-01', { month: 'long', year: 'numeric' }), fut ? 'À venir' : rate === null ? 'Pas prévu' : `${rate} % · ${dn}/${t} tâches`] };
      });
    }
    return (
      <div className="flex flex-wrap gap-[3px]" role="img" aria-label={`Détail jour par jour : ${label}`}>
        {cells.map(c => (
          <span
            key={c.key}
            onMouseEnter={(e) => showTip(e, [label, ...c.lines])}
            onMouseMove={(e) => showTip(e, [label, ...c.lines])}
            onMouseLeave={hideTip}
            className={`w-3.5 h-3.5 rounded-[4px] ${c.rate === null ? (c.future ? 'border border-dashed border-[#18181B]/10 dark:border-[#E6E8E6]/10' : 'bg-[#18181B]/[0.06] dark:bg-[#E6E8E6]/[0.06]') : ''}`}
            style={cellStyle(c.rate, accentHex)}
          />
        ))}
      </div>
    );
  };

  const stripLegend = (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-bold ${muted}`}>
      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-[3px]" style={cellStyle(0)} /> 0 %</span>
      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-[3px]" style={cellStyle(20)} /> 1–49 %</span>
      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-[3px]" style={cellStyle(60)} /> 50–79 %</span>
      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-[3px]" style={cellStyle(90)} /> 80–100 %</span>
      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-[3px] bg-[#18181B]/[0.06] dark:bg-[#E6E8E6]/[0.06]" /> Pas prévu</span>
    </div>
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-20">
      {/* En-tête */}
      <div className="px-2">
        <h1 className={`text-2xl font-black ${ink}`}>Analytics</h1>
        <p className={`text-xs font-bold mt-1 ${muted}`}>Ta discipline, mesurée.</p>
      </div>

      {/* Période : type + navigation */}
      <div className="glass rounded-[2rem] p-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 p-1 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-2xl" role="tablist" aria-label="Type de période">
            {(['day', 'week', 'month', 'year', 'custom'] as TimeframeType[]).map(t => (
              <button key={t} role="tab" aria-selected={tf === t} onClick={() => chooseTf(t)}
                className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${tf === t ? 'bg-accent text-white shadow-lg shadow-accent/20' : muted}`}>
                {TF_LABEL[t]}
              </button>
            ))}
          </div>
          <button onClick={async () => { setPdfBusy(true); try { await onDownloadPDF(tf, period); } finally { setPdfBusy(false); } }} disabled={pdfBusy} title={`Télécharger le ${REPORT_NAME[tf]} (PDF)`} aria-label={`Télécharger le ${REPORT_NAME[tf]} en PDF`}
            className={`p-3 rounded-2xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 ${muted} hover:text-white hover:bg-accent transition-all`}>
            {pdfBusy ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
          </button>
        </div>
        {tf !== 'custom' ? (
          <div className="flex items-center gap-2 px-1">
            <button onClick={() => setAnchor(shiftAnchor(tf, period.start, -1))} aria-label="Période précédente" className={`p-2 rounded-xl hover:bg-accent/10 hover:text-accent ${muted}`}><ChevronLeft size={18} /></button>
            <div className="flex-1 text-center">
              <p className={`text-sm font-black ${ink}`}>{period.label}</p>
              {isCurrent && tf !== 'day' && <p className={`text-[10px] font-bold ${muted}`}>En cours · {stats.elapsed} jour{stats.elapsed > 1 ? 's' : ''} écoulé{stats.elapsed > 1 ? 's' : ''} sur {stats.days.length}</p>}
            </div>
            <button onClick={() => canGoNext && setAnchor(shiftAnchor(tf, period.start, 1))} disabled={!canGoNext} aria-label="Période suivante" className={`p-2 rounded-xl ${canGoNext ? `hover:bg-accent/10 hover:text-accent ${muted}` : 'opacity-20 cursor-not-allowed'}`}><ChevronRight size={18} /></button>
            {!isCurrent && <button onClick={() => setAnchor(new Date())} className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider text-accent bg-accent/10 hover:bg-accent hover:text-white transition-all">Aujourd'hui</button>}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 px-1">
            {(['start', 'end'] as const).map(k => (
              <label key={k} className="space-y-1">
                <span className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>{k === 'start' ? 'Début' : 'Fin'}</span>
                <input type="date" value={custom[k]} min={k === 'end' ? custom.start : undefined} onChange={e => setCustom(c => ({ ...c, [k]: e.target.value }))}
                  className={`w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 p-3 rounded-xl text-xs font-bold border border-[#18181B]/5 dark:border-[#E6E8E6]/5 outline-none focus:border-accent [color-scheme:dark] ${ink}`} />
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 1. Résumé */}
      <Section id="summary" title="Résumé" icon={<Target size={16} />} subtitle={period.label}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile icon={<TrendingUp size={11} />} label="Taux de réalisation" rate={avg} value={avg === null ? '—' : `${avg} %`} foot={<Delta now={avg} prev={prev.rate} label={prevLabel} />} />
          <Tile icon={<ListChecks size={11} />} label="Tâches faites" value={<>{stats.done}<span className={`text-base ${faint}`}> / {stats.total}</span></>}
            foot={<span className={muted}>{stats.total - stats.done > 0 ? `${stats.total - stats.done} non faite${stats.total - stats.done > 1 ? 's' : ''}` : stats.total ? 'Tout est fait' : 'Rien de prévu'}</span>} />
          {day ? (
            <Tile icon={<Layers size={11} />} label="Blocs terminés" value={<>{day.blocks.filter(b => b.done === b.total).length}<span className={`text-base ${faint}`}> / {day.blocks.length}</span></>}
              foot={<span className={muted}>{day.rate === 100 ? 'Journée parfaite' : 'Bloc fait à 100 %'}</span>} />
          ) : (
            <Tile icon={<Star size={11} className="text-[#FDCA40]" />} label="Journées parfaites" value={<>{stats.perfectDays}<span className={`text-base ${faint}`}> / {stats.activeDays}</span></>}
              foot={<span className={muted}>jours avec des tâches</span>} />
          )}
          <Tile icon={<Flame size={11} className="text-[#FDCA40]" />} label="Série en cours" value={`${streak.current} j`} foot={<span className={muted}>Record : {streak.best} j de suite à 100 %</span>} />
        </div>
        <PerfLegend className="mt-3" />
      </Section>

      {/* Objectif prioritaire */}
      <Section id="objective" title="Objectif prioritaire" icon={<Target size={16} />} subtitle={tf === 'day' ? "L'objectif de la journée" : 'Chaque jour, ton objectif n°1 : atteint ou non'}>
        {objective.list.length === 0 ? (
          <p className={`text-xs font-medium py-4 ${muted}`}>Aucun objectif prioritaire sur cette période. Écris-le chaque jour en haut de l'onglet Routine, puis coche-le quand il est atteint.</p>
        ) : (
          <div className="space-y-4">
            {tf !== 'day' && (
              <div className="grid grid-cols-3 gap-3">
                <Tile icon={<Check size={11} />} label="Atteint" value={<>{objective.done}<span className={`text-base ${faint}`}> / {objective.defined}</span></>} foot={<span className={muted}>jours avec un objectif</span>} />
                <Tile icon={<TrendingUp size={11} />} label="Taux" rate={objective.rate} value={objective.rate === null ? '—' : `${objective.rate} %`} foot={<span className={muted}>des objectifs atteints</span>} />
                <Tile icon={<Flame size={11} />} label="Série" value={`${objective.current} j`} foot={<span className={muted}>Record : {objective.best} j</span>} />
              </div>
            )}
            {(() => {
              const rows = objective.list;
              if (rows.length > 31) {
                const m = new Map<string, { done: number; total: number }>();
                rows.forEach(o => { if (o.today && !o.done) return; const k = o.date.slice(0, 7); const v = m.get(k) || { done: 0, total: 0 }; v.total++; if (o.done) v.done++; m.set(k, v); });
                return (
                  <div className="space-y-2">
                    {[...m.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([k, v]) => {
                      const r = v.total ? Math.round((v.done / v.total) * 100) : 0;
                      return (
                        <div key={k} className="flex items-center gap-3">
                          <span className={`w-28 shrink-0 text-[11px] font-bold ${ink}`}>{fmtDay(k + '-01', { month: 'long', year: 'numeric' })}</span>
                          <div className="flex-1 h-2 rounded-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${r}%`, backgroundColor: perfColor(r) }} /></div>
                          <span className={`w-20 shrink-0 text-right text-[11px] font-black ${ink}`}>{v.done}/{v.total} · <Pct v={r} /></span>
                        </div>
                      );
                    })}
                  </div>
                );
              }
              return (
                <ul className="divide-y divide-[#18181B]/5 dark:divide-[#E6E8E6]/5">
                  {rows.map(o => (
                    <li key={o.date} className="flex items-center gap-3 py-2.5">
                      <span className={`w-5 h-5 rounded-md shrink-0 flex items-center justify-center ${o.done ? 'bg-accent' : o.today ? 'border-2 border-dashed border-accent' : 'border-2 border-[#DF2935]/60'}`}>{o.done && <Check size={12} strokeWidth={3} className="text-white" />}</span>
                      <span className={`w-24 shrink-0 text-[10px] font-black uppercase tracking-wider ${muted}`}>{fmtDay(o.date)}</span>
                      <span className={`flex-1 min-w-0 text-sm font-semibold ${ink}`}>{o.title}</span>
                      <span className={`shrink-0 text-[9px] font-black uppercase tracking-wider ${o.done ? 'text-accent' : o.today ? muted : 'text-[#DF2935]'}`}>{o.done ? 'Atteint' : o.today ? 'En cours' : 'Non atteint'}</span>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
        )}
      </Section>

      {/* 2. Constance dans le temps */}
      {tf !== 'day' && (
        <Section id="consistency" title={`Constance par ${unit}`} icon={<CalendarDays size={16} />}
          subtitle="Part des tâches prévues que tu as faites"
          action={avg !== null ? <span className={`hidden sm:flex items-center gap-2 text-[10px] font-bold ${muted}`}><span className="w-5 border-t-2 border-dashed" style={{ borderColor: accentHex }} /> Moyenne <Pct v={avg} /></span> : undefined}>
          {withData.length === 0 ? (
            <p className={`text-xs font-medium py-10 text-center ${muted}`}>Aucune tâche prévue sur cette période.</p>
          ) : (
            <>
              <div className="h-56 w-full -ml-2">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={buckets.map(b => ({ ...b, value: b.rate === 0 ? 1.5 : b.rate }))} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
                    <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.08} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} interval={buckets.length > 16 ? 'preserveStartEnd' : 0} minTickGap={4}
                      tick={{ fontSize: 10, fontWeight: 700, fill: 'currentColor', opacity: 0.55 }} />
                    <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} width={40} tickLine={false} axisLine={false}
                      tick={{ fontSize: 10, fontWeight: 700, fill: 'currentColor', opacity: 0.45 }} />
                    {avg !== null && <ReferenceLine y={avg} stroke={accentHex} strokeDasharray="5 4" strokeWidth={1.5} ifOverflow="extendDomain" />}
                    <Tooltip
                      cursor={{ fill: 'currentColor', fillOpacity: 0.05 }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const b = payload[0].payload as typeof buckets[number];
                        return (
                          <div className="bg-white dark:bg-[#141414] border border-[#18181B]/10 dark:border-[#E6E8E6]/10 px-3 py-2.5 rounded-xl shadow-xl space-y-0.5">
                            <p className={`text-[10px] font-black uppercase tracking-wider ${muted}`}>{b.sub}{b.key === todayKey ? ' · en cours' : ''}</p>
                            {b.future ? <p className={`text-xs font-bold ${ink}`}>À venir</p>
                              : b.rate === null ? <p className={`text-xs font-bold ${ink}`}>Aucune tâche prévue</p>
                              : <>
                                  <p className="text-base font-black" style={perfStyle(b.rate)}>{b.rate} % · {perfLevel(b.rate)?.label}</p>
                                  <p className={`text-[11px] font-bold ${muted}`}>{b.done} tâche{b.done > 1 ? 's' : ''} faite{b.done > 1 ? 's' : ''} sur {b.total}</p>
                                  {b.perfect && <p className="text-[11px] font-bold text-[#B8900A] dark:text-[#FDCA40]">★ Journée parfaite</p>}
                                  {b.days > 1 && <p className={`text-[11px] font-bold ${muted}`}>{b.days} jours avec des tâches</p>}
                                </>}
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={34} isAnimationActive={false}>
                      {buckets.map(b => <Cell key={b.key} fill={perfFill(b.rate, accentHex) || accentHex} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className={`mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[10px] font-bold ${muted}`}>
                {best && <span>Meilleur {unit} : <span className={ink}>{best.sub}</span> · <Pct v={best.rate} /></span>}
                {worst && worst.key !== best?.key && <span>Plus faible : <span className={ink}>{worst.sub}</span> · <Pct v={worst.rate} /></span>}
                <span className={faint}>Pas de barre = rien de prévu ou à venir · la couleur de chaque barre suit l'échelle ci-dessous.</span>
              </div>
              <PerfLegend className="mt-2" />
            </>
          )}
        </Section>
      )}

      {/* 3. Constance par bloc */}
      <Section id="blocks" title="Constance par bloc" icon={<Layers size={16} />}
        subtitle={day ? 'Le détail de la journée, bloc par bloc' : 'Tâches faites dans chaque bloc, et jours où le bloc a été bouclé'}>
        {day ? (
          day.blocks.length === 0 ? <p className={`text-xs font-medium py-6 text-center ${muted}`}>Aucune tâche prévue ce jour-là.</p> : (
            <div className="space-y-4">
              {day.blocks.map(b => {
                const r = Math.round((b.done / b.total) * 100);
                return (
                  <div key={b.title} className="space-y-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className={`text-xs font-black uppercase tracking-wider ${ink}`}>{b.title}</span>
                      <span className="text-sm font-black"><Pct v={r} /> <span className={`text-[10px] font-bold ${muted}`}>· {b.done}/{b.total}</span></span>
                    </div>
                    <div className="h-2 rounded-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${r}%`, backgroundColor: perfColor(r) }} /></div>
                    <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
                      {day.tasks.filter(t => t.block === b.title).map(t => (
                        <li key={t.id} className={`flex items-center gap-2 text-[11px] font-semibold ${t.done ? ink : muted} ${t.isSub ? 'pl-4' : ''}`}>
                          <span className={`w-3.5 h-3.5 rounded-[4px] flex items-center justify-center shrink-0 ${t.done ? 'bg-accent' : 'border border-[#18181B]/20 dark:border-[#E6E8E6]/20'}`}>{t.done && <Check size={10} strokeWidth={3} className="text-white" />}</span>
                          <span className="truncate">{t.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )
        ) : blocks.length === 0 ? (
          <p className={`text-xs font-medium py-6 text-center ${muted}`}>Aucune donnée de bloc sur cette période.</p>
        ) : (
          <div className="space-y-5">
            {blocks.length > 1 && (
              <div className={`flex flex-wrap gap-x-5 gap-y-1 text-[10px] font-bold ${muted}`}>
                <span className="flex items-center gap-1"><Trophy size={11} className="text-[#FDCA40]" /> Point fort : <span className={ink}>{blocks[0].title}</span> · <Pct v={blocks[0].rate} /></span>
                <span className="flex items-center gap-1"><Target size={11} /> À renforcer : <span className={ink}>{blocks[blocks.length - 1].title}</span> · <Pct v={blocks[blocks.length - 1].rate} /></span>
              </div>
            )}
            {blocks.map(b => (
              <div key={b.title} className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className={`text-xs font-black uppercase tracking-wider truncate ${ink}`}>{b.title}</span>
                  <span className="flex items-baseline gap-2 shrink-0">
                    <Delta now={b.rate} prev={b.prevRate} />
                    <Pct v={b.rate} className="text-sm" />
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${b.rate}%`, backgroundColor: perfColor(b.rate) }} /></div>
                <p className={`text-[10px] font-bold ${muted}`}>
                  {b.done} tâche{b.done > 1 ? 's' : ''} faite{b.done > 1 ? 's' : ''} sur {b.total} · bloc bouclé à 100 % <span className={ink}>{b.daysComplete} jour{b.daysComplete > 1 ? 's' : ''}</span> sur {b.daysScheduled}
                </p>
                {strip(b.perDay, b.title)}
              </div>
            ))}
            <div className="pt-1">{stripLegend}</div>
          </div>
        )}
      </Section>

      {/* 4. Habitudes */}
      <Section id="deep" title="Analyse fine" icon={<Microscope size={16} />} subtitle="Discipline pondérée, heures productives, ponctualité, prévu vs réalisé" defaultOpen={false}>
        <DeepStats appData={appData} start={period.start} end={period.end} todayKey={todayKey} accentHex={accentHex} />
      </Section>

      <Section id="habits" title="Habitudes" icon={<Repeat size={16} />}
        subtitle={allHabits.length ? `${allHabits.length} habitude${allHabits.length > 1 ? 's' : ''} suivie${allHabits.length > 1 ? 's' : ''}` : 'Choisis les tâches à suivre comme habitudes'}
        action={<button onClick={() => setChooseHabits(v => !v)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${chooseHabits ? 'bg-accent text-white' : 'bg-accent/10 text-accent hover:bg-accent hover:text-white'}`}><Settings2 size={12} /> {chooseHabits ? 'Terminé' : 'Choisir'}</button>}>
        {chooseHabits && (
          <div className="mb-5 p-4 rounded-2xl border border-accent/30 bg-accent/5 space-y-3">
            <p className={`text-[11px] font-bold ${muted}`}>Coche les tâches qui sont de vraies habitudes. Les autres ne seront pas suivies ici.</p>
            {appData.blocks.filter(b => b.tasks.length).map(b => (
              <div key={b.id} className="space-y-1.5">
                <p className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>{b.title}</p>
                <div className="flex flex-wrap gap-2">
                  {b.tasks.map(t => {
                    const on = !!t.isHabit;
                    return (
                      <button key={t.id} onClick={() => onToggleHabit(t.id, !on)} aria-pressed={on}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold border transition-all ${on ? 'bg-accent text-white border-accent' : `bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 border-transparent ${ink} hover:border-accent/50`}`}>
                        <span className={`w-3.5 h-3.5 rounded-[4px] flex items-center justify-center ${on ? 'bg-white/25' : 'border border-[#18181B]/25 dark:border-[#E6E8E6]/25'}`}>{on && <Check size={10} strokeWidth={3} />}</span>
                        {t.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {appData.blocks.every(b => !b.tasks.length) && <p className={`text-[11px] ${muted}`}>Aucune tâche dans ton planning pour l'instant.</p>}
          </div>
        )}
        {allHabits.length === 0 ? (
          !chooseHabits && <p className={`text-xs font-medium py-4 ${muted}`}>Aucune habitude suivie. Clique sur « Choisir » pour sélectionner des tâches à suivre, ou crée une habitude indépendante dans l'onglet Habitudes{onOpenHabits ? <> (<button onClick={onOpenHabits} className="text-accent font-bold">ouvrir</button>)</> : null}.</p>
        ) : (
          <div className="divide-y divide-[#18181B]/5 dark:divide-[#E6E8E6]/5">
            {allHabits.map(h => (
              <div key={h.id} className="py-4 first:pt-0 last:pb-0 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
                  <div className="min-w-0">
                    <p className={`text-sm font-bold ${ink}`}>{h.title}</p>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${faint}`}>{h.block}{h.since !== undefined ? ` · ${h.since} j sans rechute` : ''}</p>
                  </div>
                  <div className="flex items-center gap-5 sm:gap-4 shrink-0 sm:text-right">
                    <div><p className={`text-lg font-black leading-none flex items-center gap-1 sm:justify-end ${ink}`}><Flame size={14} className={h.current ? 'text-[#FDCA40]' : faint} />{h.current} j</p><p className={`text-[9px] font-bold uppercase ${faint}`}>en cours</p></div>
                    <div><p className={`text-lg font-black leading-none ${ink}`}>{h.best} j</p><p className={`text-[9px] font-bold uppercase ${faint}`}>record</p></div>
                    <div><p className={`text-lg font-black leading-none ${ink}`}><Pct v={h.rate} /></p><p className={`text-[9px] font-bold uppercase ${faint}`}>{h.done}/{h.due} {period.short}</p></div>
                  </div>
                </div>
                {h.perDay.length <= 62 && (
                  <div className="flex flex-wrap gap-[3px]">
                    {h.perDay.map(p => {
                      const lines = [h.title, fmtDay(p.date), p.state === 'done' ? 'Fait ✓' : p.state === 'missed' ? 'Pas fait' : p.state === 'today' ? "Aujourd'hui · pas encore fait" : p.state === 'future' ? 'À venir' : 'Pas prévu ce jour-là'];
                      const cls = p.state === 'done' ? '' : p.state === 'missed' ? 'border-[1.5px] border-[#DF2935]/50' : p.state === 'today' ? 'border-[1.5px] border-dashed border-accent' : p.state === 'future' ? 'border border-dashed border-[#18181B]/10 dark:border-[#E6E8E6]/10' : 'bg-[#18181B]/[0.06] dark:bg-[#E6E8E6]/[0.06]';
                      return <span key={p.date} onMouseEnter={(e) => showTip(e, lines)} onMouseMove={(e) => showTip(e, lines)} onMouseLeave={hideTip}
                        className={`w-3.5 h-3.5 rounded-[4px] ${cls}`} style={p.state === 'done' ? { backgroundColor: accentHex } : undefined} />;
                    })}
                  </div>
                )}
              </div>
            ))}
            <div className={`pt-3 flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-bold ${muted}`}>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-[3px]" style={{ backgroundColor: accentHex }} /> Fait</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-[3px] border-[1.5px] border-[#DF2935]/50" /> Pas fait</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-[3px] bg-[#18181B]/[0.06] dark:bg-[#E6E8E6]/[0.06]" /> Pas prévu</span>
              <span className={faint}>Série = jours prévus consécutifs réussis ; aujourd'hui ne casse pas la série.</span>
            </div>
          </div>
        )}
      </Section>

      {/* 5. Vue de l'année */}
      <Section id="year" title={`L'année ${thisYear} en un coup d'œil`} icon={<CalendarDays size={16} />} subtitle={`Du 1er janvier au 31 décembre ${thisYear}, un carré par jour`} defaultOpen={false} embedded>
        <div><YearHeatmap history={yearHistory} streakCount={streak.current} rangeStart={`${thisYear}-01-01`} rangeEnd={`${thisYear}-12-31`} title={`Année ${thisYear}`} /></div>
      </Section>

      {children}

      {/* Info-bulle flottante */}
      {tip && (
        <div className="fixed z-[200] pointer-events-none bg-white dark:bg-[#141414] border border-[#18181B]/10 dark:border-[#E6E8E6]/10 px-3 py-2 rounded-xl shadow-xl"
          style={{ left: Math.min(tip.x + 12, window.innerWidth - 220), top: tip.y + 14 }}>
          {tip.lines.map((l, i) => <p key={i} className={i === 0 ? `text-[10px] font-black uppercase tracking-wider ${muted}` : `text-[11px] font-bold ${ink}`}>{l}</p>)}
        </div>
      )}
    </div>
  );
};

export default Analytics;
