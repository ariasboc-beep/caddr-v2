import React, { useEffect, useState } from 'react';
import { parseDuration, fmtDuration } from '../taskActions';

// Saisie libre d'une durée : « 1h30 », « 5h », « 45 », « 45 min », « 1:30 »…
// La valeur est stockée en minutes ; l'affichage reste lisible (« 1 h 30 »).
interface Props {
  value?: number;
  onChange: (min: number | undefined) => void;
  className?: string;
  chips?: boolean;           // raccourcis 15 min · 30 min · 1 h · 1 h 30 · 2 h
  placeholder?: string;
  ariaLabel?: string;
}

const CHIPS = [15, 30, 45, 60, 90, 120, 180];

export const DurationInput: React.FC<Props> = ({ value, onChange, className = '', chips = false, placeholder = 'Ex. 1h30, 45 min, 5h', ariaLabel = 'Durée' }) => {
  const [text, setText] = useState(fmtDuration(value));
  const [bad, setBad] = useState(false);
  useEffect(() => { setText(fmtDuration(value)); setBad(false); }, [value]);
  const commit = () => {
    if (!text.trim()) { setBad(false); onChange(undefined); return; }
    const m = parseDuration(text);
    if (m === null || m > 24 * 60) { setBad(true); return; }
    setBad(false); onChange(m); setText(fmtDuration(m));
  };
  return (
    <div className="space-y-1.5 w-full">
      <input value={text} onChange={e => { setText(e.target.value); setBad(false); }} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); (e.target as HTMLInputElement).blur(); } }}
        placeholder={placeholder} aria-label={ariaLabel} inputMode="text" aria-invalid={bad}
        className={`${className} ${bad ? '!border-[#DF2935]' : ''}`} />
      {bad && <p className="text-[10px] font-bold text-[#DF2935]">Format non reconnu. Exemples : 1h30, 5h, 45 min, 90</p>}
      {chips && (
        <div className="flex flex-wrap gap-1.5">
          {CHIPS.map(m => (
            <button key={m} type="button" onClick={() => { onChange(m); setText(fmtDuration(m)); setBad(false); }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black border transition-all ${value === m ? 'bg-accent text-white border-accent' : 'border-[#18181B]/10 dark:border-[#E6E8E6]/10 text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent'}`}>
              {fmtDuration(m)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default DurationInput;
