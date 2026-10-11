import React from 'react';
import { Sun, Target, Clock, AlertTriangle, X, Sparkles, CalendarDays } from 'lucide-react';
import type { Briefing } from '../briefing';

interface Props { b: Briefing; name?: string; onAskClaude: () => void; onOpenPlanning: () => void; onHide: () => void }
const ink = 'text-[#18181B] dark:text-[#E6E8E6]';
const muted = 'text-[#18181B]/55 dark:text-[#E6E8E6]/55';

// Briefing du matin : la journée en trois lignes
const MorningBriefing: React.FC<Props> = ({ b, name, onAskClaude, onOpenPlanning, onHide }) => (
  <section className="glass rounded-[2rem] p-5 space-y-3 border border-[#FDCA40]/25 animate-in slide-in-from-top-2" aria-label="Briefing du matin">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-[#FDCA40]/15 flex items-center justify-center shrink-0"><Sun size={19} className="text-[#c98500]" /></div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-black ${ink}`}>Bonjour{name ? ` ${name}` : ''} ☀️</p>
        <p className={`text-[11px] font-semibold ${muted}`}>Ta journée en trois lignes · {b.tasks} tâche{b.tasks > 1 ? 's' : ''}{b.habits ? ` · ${b.habits} habitude${b.habits > 1 ? 's' : ''}` : ''}</p>
      </div>
      <button onClick={onHide} aria-label="Masquer le briefing pour aujourd'hui" className={`p-1.5 rounded-lg hover:text-accent ${muted}`}><X size={16} /></button>
    </div>
    <ul className="space-y-2">
      <li className="flex items-start gap-2.5"><Target size={15} className="text-accent shrink-0 mt-0.5" /><p className={`text-[13px] font-semibold ${ink}`}><span className={`text-[10px] font-black uppercase tracking-widest mr-1.5 ${muted}`}>Priorité</span>{b.priority || 'Aucune priorité fixée : choisis la tâche qui compte le plus.'}</p></li>
      <li className="flex items-start gap-2.5"><Clock size={15} className="text-[#3987e5] shrink-0 mt-0.5" /><p className={`text-[13px] font-semibold ${ink}`}><span className={`text-[10px] font-black uppercase tracking-widest mr-1.5 ${muted}`}>Heures</span>{b.hours}</p></li>
      <li className="flex items-start gap-2.5"><AlertTriangle size={15} className="text-[#c98500] shrink-0 mt-0.5" /><div className={`text-[13px] font-semibold ${ink}`}><span className={`text-[10px] font-black uppercase tracking-widest mr-1.5 ${muted}`}>Vigilance</span>{b.vigilance[0]}{b.vigilance.slice(1).map((v, i) => <p key={i} className={`text-[12px] font-medium mt-0.5 ${muted}`}>· {v}</p>)}</div></li>
    </ul>
    <div className="flex flex-wrap gap-2 pt-1">
      <button onClick={onAskClaude} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-accent text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-accent/20"><Sparkles size={13} /> Ajuster avec Claude</button>
      <button onClick={onOpenPlanning} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[10px] font-black uppercase tracking-wider hover:text-accent ${ink}`}><CalendarDays size={13} /> Voir le planning</button>
    </div>
  </section>
);

export default MorningBriefing;
