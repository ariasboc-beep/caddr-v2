import React from 'react';
import { Bean, Sprout, TreeDeciduous, Trees } from 'lucide-react';
import { mastery, MASTERY_STEPS, type MasteryKey } from '../progress';
import { useFeature } from '../features';

const ICON: Record<MasteryKey, React.FC<{ size?: number; className?: string }>> = { seed: Bean, sprout: Sprout, tree: TreeDeciduous, forest: Trees };

/** Pastille compacte : icône + palier */
export const MasteryChip: React.FC<{ days: number }> = ({ days }) => {
  const on = useFeature('mastery');
  const m = mastery(days); const I = ICON[m.key];
  if (!on) return null;
  return <span title={m.next ? `${m.label} · ${days} jours tenus · ${m.label === 'Graine' ? '' : ''}${m.next.at - days} de plus pour devenir ${m.next.label}` : `${m.label} · ${days} jours tenus`}
    className={`inline-flex items-center gap-0.5 ${m.key === 'forest' ? 'text-[#B8900A] dark:text-[#FDCA40]' : 'text-accent'}`}><I size={11} />{m.label}</span>;
};

/** Carte complète : palier actuel, progression vers le suivant, les 4 étapes */
export const MasteryCard: React.FC<{ days: number }> = ({ days }) => {
  const on = useFeature('mastery');
  const m = mastery(days); const I = ICON[m.key];
  if (!on) return null;
  return (
    <div className="rounded-[2rem] p-5 bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] border border-[#18181B]/5 dark:border-[#E6E8E6]/5 space-y-3" aria-label="Palier de maîtrise">
      <div className="flex items-center gap-3">
        <span className={`w-12 h-12 rounded-2xl flex items-center justify-center ${m.key === 'forest' ? 'bg-[#FDCA40]/15 text-[#B8900A] dark:text-[#FDCA40]' : 'bg-accent/15 text-accent'}`}><I size={24} /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black uppercase tracking-widest text-[#18181B]/55 dark:text-[#E6E8E6]/55">Palier de maîtrise</p>
          <p className="text-xl font-black text-[#18181B] dark:text-[#E6E8E6] leading-tight">{m.label} <span className="text-[12px] font-bold text-[#18181B]/55 dark:text-[#E6E8E6]/55">· {days} jour{days > 1 ? 's' : ''} tenu{days > 1 ? 's' : ''}</span></p>
          <p className="text-[11px] font-semibold text-[#18181B]/60 dark:text-[#E6E8E6]/55">{m.next ? `Encore ${m.next.at - days} jour${m.next.at - days > 1 ? 's' : ''} pour devenir ${m.next.label}.` : 'Palier ultime : cette habitude fait partie de toi.'}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {MASTERY_STEPS.map((s, i) => {
          const reached = days >= s.min; const SI = ICON[s.key];
          const nxt = MASTERY_STEPS[i + 1];
          const fill = !nxt ? (reached ? 1 : 0) : days >= nxt.min ? 1 : reached ? (days - s.min) / (nxt.min - s.min) : 0;
          return (
            <React.Fragment key={s.key}>
              <span title={`${s.label} · dès ${s.min} jours`} className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center ${reached ? (s.key === 'forest' ? 'bg-[#FDCA40] text-[#111213]' : 'bg-accent text-white') : 'bg-[#18181B]/[0.07] dark:bg-[#E6E8E6]/[0.07] text-[#18181B]/35 dark:text-[#E6E8E6]/35'}`}><SI size={14} /></span>
              {nxt && <span className="flex-1 h-1.5 rounded-full bg-[#18181B]/[0.07] dark:bg-[#E6E8E6]/[0.07] overflow-hidden"><span className="block h-full bg-accent rounded-full transition-all duration-700" style={{ width: `${Math.round(fill * 100)}%` }} /></span>}
            </React.Fragment>
          );
        })}
      </div>
      <p className="text-[10px] font-semibold text-[#18181B]/50 dark:text-[#E6E8E6]/50">Graine → Pousse (7 j) → Arbre (21 j) → Forêt (66 j) : les jours tenus s'additionnent, même après un écart.</p>
    </div>
  );
};
