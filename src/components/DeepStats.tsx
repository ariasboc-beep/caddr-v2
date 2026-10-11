import React, { useMemo } from 'react';
import { perfColor, perfStyle } from '../perfScale';
import { Scale, Clock, Timer, AlarmClock, Info } from 'lucide-react';
import type { AppData } from '../types';
import { weightedDiscipline, productiveHours, focusEstimates } from '../deepStats';

interface Props { appData: AppData; start: Date; end: Date; todayKey: string; accentHex: string }

const ink = 'text-[#18181B] dark:text-[#E6E8E6]';
const muted = 'text-[#18181B]/50 dark:text-[#E6E8E6]/50';
const faint = 'text-[#18181B]/35 dark:text-[#E6E8E6]/35';
const fmtDur = (m: number) => m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}` : `${m} min`;
const hh = (min: number) => `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}`;

const Card: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="rounded-2xl bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] border border-[#18181B]/5 dark:border-[#E6E8E6]/5 p-4 space-y-3 min-w-0">
    <p className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${muted}`}>{icon}{title}</p>
    {children}
  </div>
);

const DeepStats: React.FC<Props> = ({ appData, start, end, todayKey, accentHex }) => {
  const w = useMemo(() => weightedDiscipline(appData, start, end, todayKey), [appData, start, end, todayKey]);
  const ph = useMemo(() => productiveHours(appData, start, end, todayKey), [appData, start, end, todayKey]);
  const fe = useMemo(() => focusEstimates(appData.focusSessions || [], start, end), [appData.focusSessions, start, end]);

  const gap = w.simple !== null && w.weighted !== null ? w.weighted - w.simple : null;
  const shown = ph.hours.map((v, h) => ({ v, h })).filter(x => x.h >= 5 && x.h <= 23);
  const max = Math.max(1, ...shown.map(x => x.v));

  return (
    <div className="grid lg:grid-cols-2 gap-3">
      {/* Discipline pondérée */}
      <Card icon={<Scale size={12} />} title="Discipline pondérée">
        <div className="flex items-end gap-6">
          <div><p className={`text-[10px] font-bold ${muted}`}>Taux simple</p><p className={`text-3xl font-black leading-none ${ink}`} style={perfStyle(w.simple)}>{w.simple ?? '—'}{w.simple !== null && <span className="text-base"> %</span>}</p></div>
          <div><p className={`text-[10px] font-bold ${muted}`}>Pondéré</p><p className={`text-3xl font-black leading-none ${ink}`} style={perfStyle(w.weighted)}>{w.weighted ?? '—'}{w.weighted !== null && <span className="text-base"> %</span>}</p></div>
        </div>
        {/* Deux barres pour comparer */}
        {w.simple !== null && w.weighted !== null && (
          <div className="space-y-1.5" aria-hidden="true">
            <div className="h-2 rounded-full bg-[#18181B]/[0.06] dark:bg-[#E6E8E6]/[0.06] overflow-hidden"><div className="h-full rounded-full bg-[#18181B]/40 dark:bg-[#E6E8E6]/40" style={{ width: `${w.simple}%` }} /></div>
            <div className="h-2 rounded-full bg-[#18181B]/[0.06] dark:bg-[#E6E8E6]/[0.06] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${w.weighted}%`, backgroundColor: perfColor(w.weighted) }} /></div>
          </div>
        )}
        <p className={`text-[11px] font-semibold leading-relaxed ${ink}`}>
          {gap === null ? 'Pas encore assez de données sur cette période.'
            : gap <= -5 ? `Tes tâches longues ou prioritaires sont moins souvent faites que les petites (${w.heavyRate ?? '—'} % sur ${w.heavyTotal}). C'est là que se joue ta progression.`
            : gap >= 5 ? 'Tu honores en priorité les tâches qui comptent le plus : longues ou importantes. Excellent signe.'
            : 'Tes petites et tes grosses tâches sont faites avec la même régularité.'}
        </p>
        <p className={`flex items-start gap-1 text-[10px] font-medium ${faint}`}><Info size={11} className="shrink-0 mt-0.5" />Chaque tâche pèse selon sa durée (30 min = 1) et sa priorité (haute ×2, moyenne ×1,5).</p>
      </Card>

      {/* Heures productives */}
      <Card icon={<Clock size={12} />} title="Tes heures productives">
        {ph.count < 5 ? (
          <p className={`text-[11px] font-semibold ${muted}`}>L'heure à laquelle tu coches tes tâches est enregistrée depuis cette mise à jour. Reviens après quelques jours : tu verras à quelle heure tu es le plus efficace.{ph.count > 0 ? ` (${ph.count} validation${ph.count > 1 ? 's' : ''} pour l'instant)` : ''}</p>
        ) : (
          <>
            <p className={`text-sm font-black ${ink}`}>Pic entre {ph.bestH}h et {ph.bestH + 2}h <span className={`text-[11px] font-bold ${muted}`}>· {ph.bestShare} % de tes validations</span></p>
            <div className="flex items-end gap-[3px] h-20" role="img" aria-label="Validations par heure">
              {shown.map(x => (
                <div key={x.h} className="flex-1 flex flex-col items-center gap-1 h-full justify-end" title={`${x.h}h : ${x.v} validation${x.v > 1 ? 's' : ''}`}>
                  <div className="w-full rounded-t-[3px]" style={{ height: `${Math.max(x.v ? 6 : 2, (x.v / max) * 100)}%`, backgroundColor: x.h === ph.bestH || x.h === ph.bestH + 1 ? accentHex : `${accentHex}55` }} />
                </div>
              ))}
            </div>
            <div className={`flex justify-between text-[9px] font-bold ${faint}`}><span>5h</span><span>12h</span><span>18h</span><span>23h</span></div>
            {ph.blockPeaks.length > 1 && (
              <p className={`text-[11px] font-semibold ${muted}`}>Heure moyenne de validation : {ph.blockPeaks.slice(0, 4).map(b => `${b.title} ${hh(b.avgMin)}`).join(' · ')}</p>
            )}
          </>
        )}
      </Card>

      {/* Ponctualité */}
      <Card icon={<AlarmClock size={12} />} title="Ponctualité (tâches à heure fixe)">
        {ph.punctual === null ? (
          <p className={`text-[11px] font-semibold ${muted}`}>Donne une heure à tes tâches dans le Planning : Caddr comparera l'heure prévue et l'heure où tu les coches.</p>
        ) : (
          <>
            <p className={`text-3xl font-black leading-none ${ink}`}><span style={perfStyle(ph.punctual)}>{ph.punctual} %</span><span className={`text-[11px] font-bold ml-2 ${muted}`}>faites dans le créneau prévu</span></p>
            <p className={`text-[11px] font-semibold ${ink}`}>{ph.avgLate ? `Quand tu débordes, c'est en moyenne de ${fmtDur(ph.avgLate)} après la fin du créneau.` : 'Aucun débordement : bravo.'} <span className={muted}>({ph.timedCount} tâche{ph.timedCount > 1 ? 's' : ''} analysée{ph.timedCount > 1 ? 's' : ''}, 15 min de marge)</span></p>
          </>
        )}
      </Card>

      {/* Prévu vs réalisé */}
      <Card icon={<Timer size={12} />} title="Prévu vs réalisé (mode Focus)">
        {fe.sessions === 0 ? (
          <p className={`text-[11px] font-semibold ${muted}`}>Lance le mode Focus sur une tâche : Caddr comparera la durée prévue et le temps réellement passé.</p>
        ) : (
          <>
            <div className="flex items-end gap-6">
              <div><p className={`text-[10px] font-bold ${muted}`}>Prévu</p><p className={`text-2xl font-black leading-none ${ink}`}>{fmtDur(fe.planned)}</p></div>
              <div><p className={`text-[10px] font-bold ${muted}`}>Réalisé</p><p className={`text-2xl font-black leading-none ${ink}`}>{fmtDur(fe.actual)}</p></div>
              <div><p className={`text-[10px] font-bold ${muted}`}>Écart</p><p className={`text-2xl font-black leading-none ${fe.diff !== null && Math.abs(fe.diff) > 15 ? 'text-[#DF2935]' : 'text-accent'}`}>{fe.diff !== null && fe.diff > 0 ? '+' : ''}{fe.diff} %</p></div>
            </div>
            <p className={`text-[11px] font-semibold ${ink}`}>
              {fe.diff === null ? '' : fe.diff > 15 ? `Tu sous-estimes tes durées d'environ ${fe.diff} %. Prévois plus large dans ton Planning.` : fe.diff < -15 ? `Tu surestimes tes durées d'environ ${-fe.diff} % : tu peux planifier plus serré.` : 'Tes estimations sont justes : ton planning est réaliste.'}
            </p>
            {fe.tasks.length > 0 && (
              <ul className="space-y-1">
                {fe.tasks.map(t => (
                  <li key={t.title} className="flex items-center gap-2 text-[11px] font-semibold">
                    <span className={`flex-1 truncate ${ink}`}>{t.title}</span>
                    <span className={muted}>{fmtDur(Math.round(t.planned / t.n))} → {fmtDur(Math.round(t.actual / t.n))}</span>
                    <span className={`w-12 text-right font-black ${Math.abs(t.diff) > 15 ? 'text-[#DF2935]' : 'text-accent'}`}>{t.diff > 0 ? '+' : ''}{t.diff} %</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Card>
    </div>
  );
};

export default DeepStats;
