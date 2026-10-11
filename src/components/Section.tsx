import React, { useState, createContext, useContext } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

// Sections d'Analytics désactivées dans les Réglages
export const HiddenSectionsContext = createContext<Set<string>>(new Set());

export const ANALYTICS_SECTIONS: { id: string; title: string }[] = [
  { id: 'summary', title: 'Résumé' },
  { id: 'objective', title: 'Objectif prioritaire' },
  { id: 'consistency', title: 'Constance dans le temps' },
  { id: 'blocks', title: 'Constance par bloc' },
  { id: 'deep', title: 'Analyse fine' },
  { id: 'habits', title: 'Habitudes' },
  { id: 'year', title: "L'année en un coup d'œil" },
  { id: 'insights', title: 'Observations' },
  { id: 'weekly-review', title: 'Bilans de la semaine et du mois' },
  { id: 'wheel', title: 'Roue de la vie' },
  { id: 'mood', title: 'Humeur et performance' },
  { id: 'focus', title: 'Concentration' },
  { id: 'badges', title: 'Succès' },
  { id: 'annual', title: "Bilan de l'année" },
];

// ---------- Section pliable (état mémorisé sur l'appareil) ----------
const OPEN_KEY = 'caddr_analytics_open';
const readOpen = (): Record<string, boolean> => { try { return JSON.parse(localStorage.getItem(OPEN_KEY) || '{}'); } catch { return {}; } };

export const Section: React.FC<{
  id: string; title: string; icon?: React.ReactNode; subtitle?: string; defaultOpen?: boolean;
  action?: React.ReactNode; children: React.ReactNode;
  embedded?: boolean; // contenu = composant qui a déjà sa propre carte et son titre
}> = ({ id, title, icon, subtitle, defaultOpen = true, action, children, embedded }) => {
  const hidden = useContext(HiddenSectionsContext);
  const [open, setOpen] = useState<boolean>(() => { const m = readOpen(); return id in m ? m[id] : defaultOpen; });
  const toggle = () => {
    const next = !open; setOpen(next);
    try { localStorage.setItem(OPEN_KEY, JSON.stringify({ ...readOpen(), [id]: next })); } catch {}
  };
  if (hidden.has(id)) return null;
  return (
    <section className="glass rounded-[2rem] overflow-hidden">
      <div className="flex items-center gap-3 px-5 sm:px-6 py-4">
        <button onClick={toggle} aria-expanded={open} className="flex-1 min-w-0 flex items-center gap-3 text-left group">
          <span className="text-[#18181B]/40 dark:text-[#E6E8E6]/40 group-hover:text-accent transition-colors">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
          {icon && <span className="text-accent shrink-0">{icon}</span>}
          <span className="min-w-0">
            <span className="block font-black uppercase tracking-wider text-sm text-[#18181B] dark:text-[#E6E8E6]">{title}</span>
            {subtitle && <span className="block text-[10px] font-medium text-[#18181B]/50 dark:text-[#E6E8E6]/50 truncate">{subtitle}</span>}
          </span>
        </button>
        {open && action}
      </div>
      {open && <div className={`px-5 sm:px-6 pb-6 animate-in fade-in duration-300 ${embedded ? 'analytics-embed' : ''}`}>{children}</div>}
    </section>
  );
};

