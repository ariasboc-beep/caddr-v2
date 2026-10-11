import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface Props { title: string; icon: React.ReactNode; hint?: string; badge?: string; defaultOpen?: boolean; children: React.ReactNode }

// Groupe de réglages repliable : la page reste courte, on n'ouvre que ce qu'on cherche.
const SettingsGroup: React.FC<Props> = ({ title, icon, hint, badge, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass rounded-[2rem] overflow-hidden" aria-label={title}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="w-full px-6 py-5 flex items-center gap-3 text-left">
        <span className="text-accent shrink-0">{icon}</span>
        <span className="flex-1 min-w-0">
          <span className="block font-black uppercase tracking-wider text-sm text-[#18181B] dark:text-[#E6E8E6]">{title}</span>
          {hint && <span className="block text-[10px] font-semibold text-[#18181B]/50 dark:text-[#E6E8E6]/50 truncate">{hint}</span>}
        </span>
        {badge && <span className="shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-accent/10 text-accent">{badge}</span>}
        <ChevronDown size={18} className={`shrink-0 text-[#18181B]/40 dark:text-[#E6E8E6]/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-6 pb-6 space-y-5 animate-in fade-in slide-in-from-top-1 duration-300">{children}</div>}
    </div>
  );
};

export default SettingsGroup;
