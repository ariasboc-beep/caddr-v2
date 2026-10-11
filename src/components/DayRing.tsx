import React from 'react';
import { Feather, Shield } from 'lucide-react';

interface Props { done: number; total: number; hard: boolean; streak: number; onToggleHard: () => void }

// Anneau du jour : se remplit à chaque tâche cochée. Mode « Jour difficile » en un geste.
const DayRing: React.FC<Props> = ({ done, total, hard, streak, onToggleHard }) => {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const R = 34, C = 2 * Math.PI * R;
  const full = total > 0 && done >= total;
  const left = Math.max(0, total - done);
  const msg = !total ? "Rien de prévu aujourd'hui : ajoute ta première tâche."
    : full ? 'Anneau fermé : journée parfaite ✦'
    : hard ? (done > 0 ? 'Journée tenue : une tâche suffit aujourd’hui. Bravo d’avoir tenu bon.' : 'Une seule tâche, même en version minimale, et ta journée est tenue.')
    : done === 0 ? `${total} tâche${total > 1 ? 's' : ''} pour fermer l'anneau. Commence par la plus importante.`
    : `Encore ${left} tâche${left > 1 ? 's' : ''} pour fermer l'anneau.`;
  const ring = full ? '#FDCA40' : 'var(--accent)';
  return (
    <div className={`glass rounded-[2rem] p-4 sm:p-5 flex items-center gap-4 ${hard ? 'border border-accent/30' : ''}`} aria-label="Anneau du jour">
      <div className="relative w-[84px] h-[84px] shrink-0">
        <svg viewBox="0 0 84 84" className="w-full h-full -rotate-90">
          <circle cx="42" cy="42" r={R} fill="none" stroke="currentColor" strokeWidth="8" className="text-[#18181B]/[0.07] dark:text-[#E6E8E6]/[0.07]" />
          <circle cx="42" cy="42" r={R} fill="none" stroke={ring} strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, total ? done / total : 0))} style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(.2,.8,.2,1), stroke 300ms' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-black leading-none text-[#18181B] dark:text-[#E6E8E6]">{pct}%</span>
          <span className="text-[9px] font-bold text-[#18181B]/55 dark:text-[#E6E8E6]/55">{done}/{total}</span>
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-[9px] font-black uppercase tracking-widest text-accent flex items-center gap-1.5">{hard ? <><Feather size={11} /> Jour difficile · tout en douceur</> : 'Ta journée'}{streak > 0 && <span className="text-[#B8900A] dark:text-[#FDCA40] normal-case tracking-normal font-bold">· 🔥 {streak} j</span>}</p>
        <p className="text-[13px] font-semibold leading-snug text-[#18181B] dark:text-[#E6E8E6]">{msg}</p>
        <button onClick={onToggleHard} className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider ${hard ? 'text-accent' : 'text-[#18181B]/55 dark:text-[#E6E8E6]/55 hover:text-accent'}`}>
          {hard ? <><Shield size={12} /> Revenir à une journée normale</> : <><Feather size={12} /> Journée difficile ?</>}
        </button>
      </div>
    </div>
  );
};

export default DayRing;
