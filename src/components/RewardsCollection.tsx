import React, { useState } from 'react';
import { Gift, Sparkles, Lock } from 'lucide-react';
import type { RewardCard } from '../types';
import { CARDS } from '../progress';

const ink = 'text-[#18181B] dark:text-[#E6E8E6]';
const muted = 'text-[#18181B]/60 dark:text-[#E6E8E6]/55';

// Collection des cartes surprises gagnées lors des journées parfaites
const RewardsCollection: React.FC<{ rewards: RewardCard[] }> = ({ rewards }) => {
  const [open, setOpen] = useState<string | null>(null);
  const owned = new Map<string, number>(); rewards.forEach(r => owned.set(r.cardId, (owned.get(r.cardId) || 0) + 1));
  return (
    <div className="glass rounded-[2rem] p-5 sm:p-6 space-y-4" aria-label="Ma collection">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={`font-black uppercase tracking-wider text-sm flex items-center gap-2 ${ink}`}><Gift size={16} className="text-[#FDCA40]" /> Ma collection</h2>
        <span className={`text-[11px] font-black ${muted}`}>{owned.size} / {CARDS.length} cartes</span>
      </div>
      <p className={`text-[11px] font-semibold ${muted}`}>Une carte peut se cacher derrière chaque journée parfaite. Certaines sont rares, d'autres légendaires.</p>
      <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5 sm:gap-2">
        {CARDS.map(c => {
          const n = owned.get(c.id) || 0;
          const legendary = c.rarity === 'légendaire';
          return (
            <button key={c.id} disabled={!n} onClick={() => setOpen(open === c.id ? null : c.id)} aria-label={n ? c.title : 'Carte à découvrir'}
              className={`aspect-[4/5] rounded-xl sm:rounded-2xl p-1.5 flex flex-col items-center justify-center gap-1 text-center transition-all ${n ? 'border border-[#FDCA40]/35' : 'border border-dashed border-[#18181B]/12 dark:border-[#E6E8E6]/12'} ${open === c.id ? 'ring-2 ring-[#FDCA40]/50' : ''}`}
              style={n ? { background: legendary ? 'linear-gradient(135deg, rgba(253,202,64,0.22), rgba(47,176,166,0.16))' : 'rgba(253,202,64,0.07)' } : undefined}>
              {n ? <Sparkles size={16} className="text-[#FDCA40]" /> : <Lock size={14} className={muted} />}
              <span className={`text-[8px] font-black uppercase tracking-wider leading-tight ${n ? ink : muted}`}>{n ? c.title.replace('Badge · ', '') : c.rarity}</span>
              {n > 1 && <span className={`text-[8px] font-bold ${muted}`}>×{n}</span>}
            </button>
          );
        })}
      </div>
      {open && (() => { const c = CARDS.find(x => x.id === open)!; return (
        <div className="rounded-2xl p-4 border border-[#FDCA40]/30 bg-[#FDCA40]/[0.06] animate-in fade-in">
          <p className="text-[9px] font-black uppercase tracking-widest text-[#FDCA40]">{c.title} · {c.rarity}</p>
          <p className={`text-[14px] font-bold leading-snug mt-1 ${ink}`}>{c.text}</p>
        </div>
      ); })()}
    </div>
  );
};

export default RewardsCollection;
