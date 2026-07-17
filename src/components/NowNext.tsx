import React from 'react';
import { Play, ArrowRight, Check, Coffee, Clock } from 'lucide-react';

interface Item {
  taskId: string;
  blockId: string;
  title: string;
  blockTitle: string;
  startMin: number;
  duration: number;
}

interface Props {
  current: Item | null;
  next: Item | null;
  nowMin: number;
  onStartFocus: (blockId: string, taskId: string) => void;
  onComplete: (blockId: string, taskId: string) => void;
}

const fmtTime = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;

const NowNext: React.FC<Props> = ({ current, next, nowMin, onStartFocus, onComplete }) => {
  // Rien de prévu
  if (!current && !next) {
    return (
      <div className="glass p-6 rounded-[2.5rem] flex items-center gap-4">
        <Coffee size={22} className="text-accent shrink-0" />
        <div>
          <p className="text-sm font-black text-[#18181B] dark:text-[#E6E8E6]">Rien de prévu maintenant</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#18181B]/40 dark:text-[#E6E8E6]/40">Profitez-en, ou avancez sur autre chose.</p>
        </div>
      </div>
    );
  }

  const remaining = current ? Math.max(0, current.startMin + current.duration - nowMin) : 0;
  const elapsed = current ? Math.min(current.duration, Math.max(0, nowMin - current.startMin)) : 0;
  const progress = current && current.duration > 0 ? (elapsed / current.duration) * 100 : 0;
  const untilNext = next ? next.startMin - nowMin : 0;

  return (
    <div className="glass p-6 rounded-[2.5rem] space-y-5 border border-accent/20 shadow-lg shadow-accent/5">
      {current ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-accent">Maintenant</span>
          </div>
          <h2 className="text-2xl font-black text-[#18181B] dark:text-[#E6E8E6] leading-tight">{current.title}</h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#18181B]/40 dark:text-[#E6E8E6]/40">{current.blockTitle}</p>

          {/* Compte à rebours visuel */}
          <div className="space-y-1.5">
            <div className="h-2.5 rounded-full bg-[#18181B]/10 dark:bg-[#E6E8E6]/10 overflow-hidden">
              <div className="h-full rounded-full bg-accent transition-all duration-1000" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[11px] font-black text-accent tabular-nums">
              {remaining > 0 ? `${remaining} min restantes` : 'Temps écoulé'}
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => onStartFocus(current.blockId, current.taskId)} className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-accent text-white font-black uppercase text-[11px] tracking-widest shadow-lg shadow-accent/20 active:scale-[0.98] transition-all">
              <Play size={15} /> Démarrer (2 min)
            </button>
            <button onClick={() => onComplete(current.blockId, current.taskId)} className="px-5 py-3.5 rounded-2xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[#18181B] dark:text-[#E6E8E6] font-black uppercase text-[11px] tracking-widest active:scale-[0.98] transition-all">
              <Check size={15} />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#18181B]/40 dark:text-[#E6E8E6]/40">En attente</span>
          <p className="text-sm font-bold text-[#18181B] dark:text-[#E6E8E6]">Rien en cours à l'instant.</p>
        </div>
      )}

      {/* Ensuite */}
      {next && (
        <div className="flex items-center gap-3 pt-4 border-t border-[#18181B]/5 dark:border-[#E6E8E6]/5">
          <ArrowRight size={16} className="text-[#18181B]/30 dark:text-[#E6E8E6]/30 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#18181B]/40 dark:text-[#E6E8E6]/40">Ensuite</p>
            <p className="text-sm font-bold text-[#18181B] dark:text-[#E6E8E6] truncate">{next.title}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] font-black text-[#18181B] dark:text-[#E6E8E6] tabular-nums flex items-center gap-1 justify-end"><Clock size={11} className="text-accent" /> {fmtTime(next.startMin)}</p>
            {untilNext > 0 && <p className="text-[9px] font-bold text-[#18181B]/40 dark:text-[#E6E8E6]/40">dans {untilNext < 60 ? `${untilNext} min` : `${Math.floor(untilNext / 60)}h${String(untilNext % 60).padStart(2, '0')}`}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default NowNext;
