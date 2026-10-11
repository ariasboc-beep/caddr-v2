import React from 'react';
import { Feather, Shield } from 'lucide-react';

// L'anneau du jour, discret : une pastille circulaire posée dans la carte
// « Objectif prioritaire », plus une ligne d'encouragement sous l'objectif.

interface MarkProps { done: number; total: number; hard?: boolean; size?: number }

/** Pastille : l'anneau seul, avec le pourcentage au centre. */
export const RingMark: React.FC<MarkProps> = ({ done, total, hard, size = 64 }) => {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const full = total > 0 && done >= total;
  const R = 26, C = 2 * Math.PI * R, S = 64;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}
      title={`${done} sur ${total} · ${pct} %${hard ? ' · jour difficile' : ''}`} aria-label="Anneau du jour" role="img">
      <svg viewBox={`0 0 ${S} ${S}`} className="w-full h-full -rotate-90">
        <circle cx={S / 2} cy={S / 2} r={R} fill="none" stroke="currentColor" strokeWidth="6" className="text-[#18181B]/[0.08] dark:text-[#E6E8E6]/[0.08]" />
        <circle cx={S / 2} cy={S / 2} r={R} fill="none" stroke={full ? '#FDCA40' : 'var(--accent)'} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, total ? done / total : 0))}
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(.2,.8,.2,1), stroke 300ms' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[13px] font-black leading-none text-[#18181B] dark:text-[#E6E8E6]">{pct}%</span>
        <span className="text-[8px] font-bold text-[#18181B]/55 dark:text-[#E6E8E6]/55">{done}/{total}</span>
      </div>
    </div>
  );
};

interface LineProps { done: number; total: number; hard: boolean; streak: number; showRingMsg: boolean; onToggleHard?: () => void }

/** Ligne sous l'objectif : encouragement du jour, série, et le mode « jour difficile ». */
export const DayLine: React.FC<LineProps> = ({ done, total, hard, streak, showRingMsg, onToggleHard }) => {
  const full = total > 0 && done >= total;
  const left = Math.max(0, total - done);
  const msg = !total ? "Rien de prévu aujourd'hui : ajoute ta première tâche."
    : full ? 'Anneau fermé : journée parfaite ✦'
    : hard ? (done > 0 ? 'Journée tenue : une tâche suffisait aujourd’hui.' : 'Une seule tâche, même en version minimale, et ta journée est tenue.')
    : done === 0 ? `${total} tâche${total > 1 ? 's' : ''} pour fermer l'anneau.`
    : `Encore ${left} tâche${left > 1 ? 's' : ''} pour fermer l'anneau.`;
  if (!showRingMsg && !onToggleHard && !streak) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-[#18181B]/60 dark:text-[#E6E8E6]/55">
      {showRingMsg && <span className={full ? 'text-[#B8900A] dark:text-[#FDCA40] font-bold' : ''}>{msg}</span>}
      {streak > 0 && <span className="font-bold text-[#B8900A] dark:text-[#FDCA40]">🔥 {streak} j</span>}
      {onToggleHard && (
        <button onClick={onToggleHard} className={`inline-flex items-center gap-1 font-black uppercase tracking-wider text-[10px] ${hard ? 'text-accent' : 'text-[#18181B]/50 dark:text-[#E6E8E6]/45 hover:text-accent'}`}>
          {hard ? <><Shield size={11} /> Journée normale</> : <><Feather size={11} /> Journée difficile ?</>}
        </button>
      )}
    </p>
  );
};

export default RingMark;
