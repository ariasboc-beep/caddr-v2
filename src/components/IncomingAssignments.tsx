import React, { useState } from 'react';
import { Inbox, Check, X, CalendarPlus, Loader2 } from 'lucide-react';
import type { Assignment } from '../services/assignService';
import { fmtDuration, fmtDayShort } from '../taskActions';

interface Props {
  items: Assignment[];
  todayKey: string;
  onAccept: (a: Assignment, where: 'today' | 'due' | 'inbox') => Promise<void>;
  onDecline: (a: Assignment) => Promise<void>;
}

const ink = 'text-[#18181B] dark:text-[#E6E8E6]';
const muted = 'text-[#18181B]/60 dark:text-[#E6E8E6]/55';

// Tâches confiées par d'autres utilisateurs Caddr., en attente de réponse
const IncomingAssignments: React.FC<Props> = ({ items, todayKey, onAccept, onDecline }) => {
  const [busy, setBusy] = useState<string | null>(null);
  if (!items.length) return null;
  const run = async (id: string, fn: () => Promise<void>) => { setBusy(id); try { await fn(); } finally { setBusy(null); } };
  const btn = 'flex items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-40';
  return (
    <div className="glass rounded-[2rem] p-4 sm:p-5 space-y-3 border border-accent/25" aria-label="Tâches reçues">
      <p className="text-[10px] font-black uppercase tracking-widest text-accent flex items-center gap-1.5"><Inbox size={13} /> {items.length} tâche{items.length > 1 ? 's' : ''} reçue{items.length > 1 ? 's' : ''}</p>
      <ul className="space-y-2.5">
        {items.map(a => (
          <li key={a.id} className="rounded-2xl bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] border border-[#18181B]/5 dark:border-[#E6E8E6]/5 p-3 space-y-2">
            <div>
              <p className={`text-[14px] font-bold ${ink}`}>{a.title}</p>
              <p className={`text-[10px] font-semibold ${muted}`}>De {a.fromName || a.fromEmail}{a.duration ? ` · ${fmtDuration(a.duration)}` : ''}{a.dueDate ? ` · pour le ${fmtDayShort(a.dueDate)}` : ''}{a.subTasks?.length ? ` · ${a.subTasks.length} sous-tâche${a.subTasks.length > 1 ? 's' : ''}` : ''}</p>
              {a.note && <p className={`text-[12px] font-medium mt-1 ${ink}`}>« {a.note} »</p>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button disabled={!!busy} onClick={() => run(a.id, () => onAccept(a, 'today'))} className={`${btn} bg-accent text-white`}>{busy === a.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Aujourd'hui</button>
              {a.dueDate && a.dueDate > todayKey && <button disabled={!!busy} onClick={() => run(a.id, () => onAccept(a, 'due'))} className={`${btn} border border-accent/30 text-accent`}><CalendarPlus size={12} /> Le {fmtDayShort(a.dueDate)}</button>}
              <button disabled={!!busy} onClick={() => run(a.id, () => onAccept(a, 'inbox'))} className={`${btn} border border-[#18181B]/10 dark:border-[#E6E8E6]/10 ${ink}`}><Inbox size={12} /> Dans la Boîte</button>
              <button disabled={!!busy} onClick={() => run(a.id, () => onDecline(a))} className={`${btn} border border-[#DF2935]/30 text-[#DF2935]`}><X size={12} /> Refuser</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default IncomingAssignments;
