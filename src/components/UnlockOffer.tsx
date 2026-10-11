import React from 'react';
import { Sparkles, X } from 'lucide-react';
import type { UnlockStep } from '../features';

interface Props { step: UnlockStep; onEnable: () => void; onLater: () => void }

// Découverte progressive : une fonctionnalité proposée au bon moment, jamais imposée.
const UnlockOffer: React.FC<Props> = ({ step, onEnable, onLater }) => (
  <div className="glass rounded-[2rem] p-4 sm:p-5 border border-accent/30 space-y-2.5 animate-in slide-in-from-top-2" aria-label="Nouvelle fonctionnalité">
    <div className="flex items-start gap-3">
      <span className="w-10 h-10 shrink-0 rounded-xl bg-accent/15 text-accent flex items-center justify-center"><Sparkles size={18} /></span>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-black uppercase tracking-widest text-accent">Nouveau pour toi · {step.at} jours</p>
        <p className="text-sm font-black text-[#18181B] dark:text-[#E6E8E6] leading-tight">{step.title}</p>
      </div>
      <button onClick={onLater} aria-label="Plus tard" title="Plus tard" className="shrink-0 p-1.5 rounded-lg text-[#18181B]/40 dark:text-[#E6E8E6]/40 hover:text-accent"><X size={16} /></button>
    </div>
    <p className="text-[12px] font-semibold text-[#18181B]/70 dark:text-[#E6E8E6]/65 leading-snug">{step.text}</p>
    <div className="flex flex-wrap gap-2">
      <button onClick={onEnable} className="px-4 py-2.5 rounded-xl bg-accent text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-accent/20">Activer</button>
      <button onClick={onLater} className="px-4 py-2.5 rounded-xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[10px] font-black uppercase tracking-wider text-[#18181B] dark:text-[#E6E8E6]">Non merci</button>
    </div>
    <p className="text-[10px] font-semibold text-[#18181B]/45 dark:text-[#E6E8E6]/45">Tout reste réglable dans Réglages › Fonctionnalités.</p>
  </div>
);

export default UnlockOffer;
