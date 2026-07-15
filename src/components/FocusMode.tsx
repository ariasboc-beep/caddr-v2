import React, { useEffect, useState } from 'react';
import { X, Play, Pause, CheckCircle2, Timer } from 'lucide-react';
import { Task } from '../types';

interface Props {
  task: Task;
  blockTitle: string;
  onComplete: () => void; // valide la tâche + bonus XP
  onClose: () => void;
}

// Mode Focus plein écran : minuteur basé sur la durée de la tâche (défaut 25 min).
const FocusMode: React.FC<Props> = ({ task, blockTitle, onComplete, onClose }) => {
  const totalSeconds = (task.duration || 25) * 60;
  const [remaining, setRemaining] = useState(totalSeconds);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (!running || remaining <= 0) return;
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [running, remaining]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const progress = 1 - remaining / totalSeconds;
  const finished = remaining === 0;

  // Cercle de progression SVG
  const R = 110;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="fixed inset-0 z-[100] bg-[#080708]/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-3 rounded-2xl bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all"
      >
        <X size={20} />
      </button>

      <div className="flex items-center gap-2 mb-2 text-[#2FB0A6]">
        <Timer size={16} />
        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Mode Focus</span>
      </div>
      <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">{blockTitle}</p>
      <h1 className="text-white text-2xl font-black text-center max-w-md mb-10">{task.title}</h1>

      <div className="relative mb-10">
        <svg width="280" height="280" className="-rotate-90">
          <circle cx="140" cy="140" r={R} stroke="rgba(255,255,255,0.08)" strokeWidth="10" fill="none" />
          <circle
            cx="140" cy="140" r={R}
            stroke={finished ? '#22C55E' : '#2FB0A6'}
            strokeWidth="10" fill="none" strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - progress)}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-white text-6xl font-black tabular-nums">
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </span>
          {finished && (
            <span className="text-[#22C55E] text-[10px] font-black uppercase tracking-widest mt-2 animate-pulse">
              Temps écoulé !
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {!finished && (
          <button
            onClick={() => setRunning((r) => !r)}
            className="p-5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"
          >
            {running ? <Pause size={24} /> : <Play size={24} />}
          </button>
        )}
        <button
          onClick={onComplete}
          className={`flex items-center gap-3 px-8 py-5 rounded-full font-black uppercase tracking-wider text-sm transition-all shadow-2xl ${
            finished
              ? 'bg-[#22C55E] text-white shadow-[#22C55E]/30 scale-105'
              : 'bg-[#2FB0A6] text-white shadow-[#2FB0A6]/30'
          }`}
        >
          <CheckCircle2 size={20} />
          Terminer {finished ? '(+10 XP bonus)' : ''}
        </button>
      </div>

      <p className="text-white/30 text-[9px] font-bold uppercase tracking-widest mt-8">
        Terminer dans le temps imparti rapporte un bonus d'XP
      </p>
    </div>
  );
};

export default FocusMode;
