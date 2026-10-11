import React, { useState } from 'react';
import { Quote, RefreshCw, X, Copy, Check } from 'lucide-react';
import { dailyMotivation } from '../motivation';

interface Props { dateKey: string; yesterdayRate: number | null; streak: number; name?: string; onHide: () => void }

// Petit message de motivation du jour, en haut de l'onglet Aujourd'hui
const DailyMotivation: React.FC<Props> = ({ dateKey, yesterdayRate, streak, name, onHide }) => {
  const [offset, setOffset] = useState(0);
  const [copied, setCopied] = useState(false);
  const { text } = dailyMotivation({ dateKey, yesterdayRate, streak, offset });
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* rien */ } };
  const btn = 'p-1.5 rounded-lg text-[#18181B]/45 dark:text-[#E6E8E6]/45 hover:text-accent transition-colors';
  return (
    <div className="glass rounded-[2rem] px-5 py-4 sm:px-6 sm:py-5 flex items-start gap-3.5 relative overflow-hidden animate-in fade-in slide-in-from-top-2 duration-500" aria-label="Message du jour">
      <span className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full bg-accent" />
      <Quote size={18} className="text-accent shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-black uppercase tracking-widest text-accent mb-1">{name ? `Pour toi, ${name}` : 'Message du jour'}</p>
        <p key={text} className="text-[15px] sm:text-base font-semibold leading-snug text-[#18181B] dark:text-[#E6E8E6] animate-in fade-in duration-500">{text}</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-0.5 shrink-0 -mr-1.5 -mt-1">
        <button onClick={() => setOffset(o => o + 1)} title="Un autre message" aria-label="Un autre message" className={btn}><RefreshCw size={14} /></button>
        <button onClick={copy} title="Copier" aria-label="Copier le message" className={btn}>{copied ? <Check size={14} className="text-accent" /> : <Copy size={14} />}</button>
        <button onClick={onHide} title="Masquer pour aujourd'hui" aria-label="Masquer le message pour aujourd'hui" className={btn}><X size={14} /></button>
      </div>
    </div>
  );
};

export default DailyMotivation;
