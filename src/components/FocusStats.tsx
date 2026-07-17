import React, { useMemo } from 'react';
import { Timer, Flame } from 'lucide-react';
import { FocusSession } from '../types';
import { getKeyFromDate } from '../utils';

interface Props {
  sessions: FocusSession[];
}

const fmt = (min: number) => {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
};

const FocusStats: React.FC<Props> = ({ sessions }) => {
  const stats = useMemo(() => {
    const todayKey = getKeyFromDate(new Date());
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    const weekKeys = new Set<string>();
    for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); weekKeys.add(getKeyFromDate(d)); }

    let today = 0, week = 0, total = 0;
    const perBlock: Record<string, number> = {};
    sessions.forEach((s) => {
      total += s.durationMin;
      if (s.date === todayKey) today += s.durationMin;
      if (weekKeys.has(s.date)) week += s.durationMin;
      const b = s.blockTitle || 'Autre';
      perBlock[b] = (perBlock[b] || 0) + s.durationMin;
    });
    const blocks = Object.entries(perBlock).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxBlock = blocks.length ? blocks[0][1] : 1;

    // Estimé vs réel (sur les sessions qui ont un temps réel enregistré)
    const withActual = sessions.filter((s) => s.actualMin && s.actualMin > 0);
    let estimateRatio: number | null = null;
    if (withActual.length >= 3) {
      const planned = withActual.reduce((s, x) => s + x.durationMin, 0);
      const actual = withActual.reduce((s, x) => s + (x.actualMin || 0), 0);
      if (planned > 0) estimateRatio = Math.round((actual / planned) * 100);
    }

    return { today, week, total, count: sessions.length, blocks, maxBlock, estimateRatio };
  }, [sessions]);

  return (
    <div className="glass p-6 rounded-[2rem] space-y-5">
      <h2 className="font-black uppercase tracking-wider text-sm flex items-center gap-2"><Timer size={16} className="text-accent" /> Concentration (Focus)</h2>

      {stats.count === 0 ? (
        <p className="text-xs text-[#18181B]/50 dark:text-[#E6E8E6]/50 font-medium">Lancez une session Focus depuis une tâche horodatée pour suivre votre temps de concentration.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[{ v: fmt(stats.today), l: "Aujourd'hui" }, { v: fmt(stats.week), l: '7 jours' }, { v: fmt(stats.total), l: 'Total' }].map((s) => (
              <div key={s.l} className="text-center p-3 rounded-2xl bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03]">
                <p className="text-lg font-black text-[#18181B] dark:text-[#E6E8E6] tabular-nums">{s.v}</p>
                <p className="text-[8px] font-black uppercase tracking-widest text-[#18181B]/40 dark:text-[#E6E8E6]/40">{s.l}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-[#18181B]/40 dark:text-[#E6E8E6]/40">Répartition par bloc</p>
            {stats.blocks.map(([name, min]) => (
              <div key={name} className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-[#18181B] dark:text-[#E6E8E6] w-24 truncate">{name}</span>
                <div className="flex-1 h-2 rounded-full bg-[#18181B]/10 dark:bg-[#E6E8E6]/10 overflow-hidden">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(min / stats.maxBlock) * 100}%` }} />
                </div>
                <span className="text-[9px] font-black text-accent tabular-nums w-12 text-right">{fmt(min)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[#18181B]/40 dark:text-[#E6E8E6]/40">
            <Flame size={11} className="text-[#FDCA40]" /> {stats.count} session{stats.count > 1 ? 's' : ''} au total
          </div>

          {stats.estimateRatio !== null && (
            <div className="p-3 rounded-2xl bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] text-[11px] font-medium text-[#18181B]/70 dark:text-[#E6E8E6]/70">
              {stats.estimateRatio > 115
                ? <>⏳ Vous passez en moyenne <strong className="text-accent">{stats.estimateRatio}%</strong> du temps estimé : vous avez tendance à <strong>sous-estimer</strong> vos tâches. Prévoyez un peu plus large.</>
                : stats.estimateRatio < 85
                  ? <>⚡ Vous terminez en moyenne à <strong className="text-accent">{stats.estimateRatio}%</strong> du temps prévu : vos estimations sont <strong>généreuses</strong>.</>
                  : <>🎯 Vos estimations sont <strong className="text-accent">justes</strong> ({stats.estimateRatio}% du temps prévu). Beau contrôle du temps.</>}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FocusStats;
