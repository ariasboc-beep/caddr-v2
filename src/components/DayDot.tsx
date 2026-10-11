import React from 'react';
import { Check, X, Minus } from 'lucide-react';
import type { DayState } from '../habits';

const ink = 'text-[#18181B] dark:text-[#E6E8E6]';
const faint = 'text-[#18181B]/35 dark:text-[#E6E8E6]/35';
const RED = '#DF2935';

// Pastille d'un jour (liste, calendrier, Routine)
export const DayDot: React.FC<{ state: DayState; color: string; size?: number; label?: string; hasNote?: boolean; onClick?: () => void; today?: boolean; numberOnly?: boolean }> =
  ({ state, color, size = 34, label, hasNote, onClick, today, numberOnly }) => {
  const base: React.CSSProperties = { width: size, height: size };
  let style: React.CSSProperties = {}, cls = '', icon: React.ReactNode = label ?? null;
  if (state === 'done') { style = { backgroundColor: color, color: '#fff' }; icon = <Check size={size * 0.45} strokeWidth={3} />; }
  else if (state === 'fail') { style = { boxShadow: `inset 0 0 0 2px ${RED}`, color: RED }; icon = <X size={size * 0.45} strokeWidth={3} />; }
  else if (state === 'skip') { cls = 'bg-[#18181B]/10 dark:bg-[#E6E8E6]/10'; style = { color: 'currentColor' }; icon = <Minus size={size * 0.45} strokeWidth={3} />; }
  else if (state === 'open') { style = { boxShadow: `inset 0 0 0 2px ${color}66` }; cls = ink; }
  else if (state === 'off' || state === 'before') { cls = `bg-[#18181B]/[0.04] dark:bg-[#E6E8E6]/[0.04] ${faint}`; }
  else if (state === 'future') { style = { boxShadow: 'inset 0 0 0 1px rgba(120,120,128,0.2)' }; cls = faint; }
  if (numberOnly && label) icon = label; // calendrier : le numéro du jour reste lisible, la couleur dit l'état
  const clickable = !!onClick && state !== 'future' && state !== 'before';
  return (
    <button type="button" disabled={!clickable} onClick={onClick}
      className={`relative shrink-0 rounded-full flex items-center justify-center text-[11px] font-black transition-transform ${clickable ? 'hover:scale-110 active:scale-95' : 'cursor-default'} ${today ? 'ring-2 ring-offset-2 ring-offset-transparent ring-[#18181B]/20 dark:ring-[#E6E8E6]/30' : ''} ${cls}`}
      style={{ ...base, ...style }}>
      {icon}
      {hasNote && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#FDCA40]" />}
    </button>
  );
};

