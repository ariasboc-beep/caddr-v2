import React from 'react';
import { BrainCircuit, Loader2, RefreshCw, Trophy, Eye, ListChecks, Compass } from 'lucide-react';
import type { WeeklyReview } from '../types';

interface Props {
  coach?: WeeklyReview['coach'];
  busy?: boolean;
  onGenerate?: () => void;       // absent = IA indisponible (non connecté)
  title?: string;
}

const ink = 'text-[#18181B] dark:text-[#E6E8E6]';
const muted = 'text-[#18181B]/55 dark:text-[#E6E8E6]/55';

// Résumé de la semaine rédigé par le coach IA
const CoachCard: React.FC<Props> = ({ coach, busy, onGenerate, title = 'Le mot du coach' }) => (
  <div className="rounded-2xl p-4 space-y-3 border border-accent/20 bg-accent/[0.05]">
    <div className="flex items-center gap-2">
      <BrainCircuit size={15} className="text-accent shrink-0" />
      <p className={`flex-1 text-[10px] font-black uppercase tracking-widest text-accent`}>{title}</p>
      {onGenerate && coach && !busy && <button onClick={onGenerate} aria-label="Actualiser l'analyse" title="Actualiser" className={`p-1 rounded-lg hover:text-accent ${muted}`}><RefreshCw size={13} /></button>}
    </div>
    {busy ? (
      <p className={`flex items-center gap-2 text-[12px] font-bold ${muted}`}><Loader2 size={14} className="animate-spin text-accent" /> Le coach analyse ta semaine…</p>
    ) : coach ? (
      <>
        <p className={`text-[13px] font-semibold leading-relaxed ${ink}`}>{coach.summary}</p>
        {coach.wins?.length > 0 && <div><p className="text-[9px] font-black uppercase tracking-widest text-accent flex items-center gap-1 mb-1"><Trophy size={11} /> Réussites</p><ul className={`text-[12px] font-medium space-y-0.5 ${ink}`}>{coach.wins.map((x, i) => <li key={i}>· {x}</li>)}</ul></div>}
        {coach.watch?.length > 0 && <div><p className="text-[9px] font-black uppercase tracking-widest text-[#18181B]/55 dark:text-[#E6E8E6]/55 flex items-center gap-1 mb-1"><Eye size={11} /> Vigilance</p><ul className={`text-[12px] font-medium space-y-0.5 ${ink}`}>{coach.watch.map((x, i) => <li key={i}>· {x}</li>)}</ul></div>}
        {coach.actions?.length > 0 && <div><p className="text-[9px] font-black uppercase tracking-widest text-accent flex items-center gap-1 mb-1"><ListChecks size={11} /> 3 actions pour la semaine prochaine</p><ol className={`text-[12px] font-medium space-y-0.5 list-decimal pl-4 ${ink}`}>{coach.actions.map((x, i) => <li key={i}>{x}</li>)}</ol></div>}
        {coach.focusNextWeek && <p className={`flex items-start gap-1.5 text-[12px] font-black ${ink}`}><Compass size={13} className="text-accent shrink-0 mt-0.5" />{coach.focusNextWeek}</p>}
      </>
    ) : onGenerate ? (
      <button onClick={onGenerate} className="w-full py-2.5 rounded-xl bg-accent text-white text-[10px] font-black uppercase tracking-wider">Analyser ma semaine</button>
    ) : (
      <p className={`text-[11px] font-semibold ${muted}`}>Connecte-toi à ton compte pour recevoir le résumé de ta semaine par le coach IA.</p>
    )}
  </div>
);

export default CoachCard;
