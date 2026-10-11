import React, { useState } from 'react';
import { History, ChevronDown, ChevronUp, CalendarArrowUp, Inbox, X, CalendarDays } from 'lucide-react';
import type { Pending } from '../reschedule';

interface Props {
  items: Pending[];
  todayKey: string;
  onMove: (taskId: string, dateKey: string) => void;
  onInbox: (taskId: string) => void;
  onAbandon: (p: Pending) => void;
  onHide: () => void;
}

const ink = 'text-[#18181B] dark:text-[#E6E8E6]';
const muted = 'text-[#18181B]/55 dark:text-[#E6E8E6]/55';
const addDays = (k: string, n: number) => { const d = new Date(k + 'T12:00:00'); d.setDate(d.getDate() + n); return d; };
const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const ago = (k: string, today: string) => {
  const n = Math.round((new Date(today + 'T12:00:00').getTime() - new Date(k + 'T12:00:00').getTime()) / 86400000);
  if (n === 1) return 'hier';
  if (n === 2) return 'avant-hier';
  return new Date(k + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' });
};

// Carte « Pas terminé » : tâches ponctuelles des jours précédents restées non cochées.
const CarryOver: React.FC<Props> = ({ items, todayKey, onMove, onInbox, onAbandon, onHide }) => {
  const [open, setOpen] = useState(items.length <= 4);
  const [pickFor, setPickFor] = useState<string | null>(null);
  if (!items.length) return null;
  const tomorrow = keyOf(addDays(todayKey, 1));

  const btn = 'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all';
  return (
    <div className="glass rounded-[2rem] p-4 sm:p-5 border border-[#FDCA40]/25 space-y-3 animate-in slide-in-from-top-2" aria-label="Tâches non terminées">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#FDCA40]/15 flex items-center justify-center shrink-0"><History size={18} className="text-[#FDCA40]" /></div>
        <button onClick={() => setOpen(o => !o)} className="flex-1 min-w-0 text-left">
          <p className={`text-sm font-black ${ink}`}>Pas terminé ({items.length})</p>
          <p className={`text-[11px] font-semibold ${muted}`}>Reporte, renvoie dans la Boîte ou abandonne, sans culpabilité.</p>
        </button>
        <button onClick={() => setOpen(o => !o)} aria-label={open ? 'Replier' : 'Déplier'} className={`p-1.5 rounded-lg hover:text-accent ${muted}`}>{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
        <button onClick={onHide} aria-label="Masquer pour aujourd'hui" title="Masquer pour aujourd'hui" className={`p-1.5 rounded-lg hover:text-accent ${muted}`}><X size={16} /></button>
      </div>

      {open && (
        <>
          <ul className="space-y-2">
            {items.map(p => (
              <li key={p.task.id} className="rounded-2xl bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] border border-[#18181B]/5 dark:border-[#E6E8E6]/5 p-3 space-y-2">
                <div className="min-w-0">
                  <p className={`text-[13px] font-bold truncate ${ink}`}>{p.task.title}</p>
                  <p className={`text-[10px] font-semibold ${muted}`}>Prévue {ago(p.date, todayKey)} · {p.blockTitle}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => onMove(p.task.id, todayKey)} className={`${btn} bg-accent text-white shadow shadow-accent/20`}><CalendarArrowUp size={12} /> Aujourd'hui</button>
                  <button onClick={() => onMove(p.task.id, tomorrow)} className={`${btn} bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 ${ink} hover:text-accent`}>Demain</button>
                  <button onClick={() => setPickFor(pickFor === p.task.id ? null : p.task.id)} className={`${btn} bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 ${ink} hover:text-accent`}><CalendarDays size={12} /> Date</button>
                  <button onClick={() => onInbox(p.task.id)} className={`${btn} bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 ${ink} hover:text-accent`}><Inbox size={12} /> Boîte</button>
                  <button onClick={() => onAbandon(p)} className={`${btn} ${muted} hover:text-[#DF2935]`}>Abandonner</button>
                </div>
                {pickFor === p.task.id && (
                  <input type="date" min={todayKey} autoFocus aria-label={`Nouvelle date pour ${p.task.title}`}
                    onChange={e => { if (e.target.value) { onMove(p.task.id, e.target.value); setPickFor(null); } }}
                    className={`bg-transparent text-xs font-bold rounded-lg px-2 py-1.5 border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent [color-scheme:dark] ${ink}`} />
                )}
              </li>
            ))}
          </ul>
          {items.length > 1 && (
            <button onClick={() => items.forEach(p => onMove(p.task.id, todayKey))} className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-accent/10 text-accent hover:bg-accent hover:text-white transition-all`}>Tout reporter à aujourd'hui</button>
          )}
        </>
      )}
    </div>
  );
};

export default CarryOver;
