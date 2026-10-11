import React, { useState } from 'react';
import { Star, Gift, Sparkles, X } from 'lucide-react';
import type { CardDef } from '../progress';

interface Props { count: number; streak: number; card: CardDef | null; name?: string; onShare: () => void; onClose: () => void }

// Écran « Journée parfaite » : sobre, or et noir, avec carte surprise à retourner
const PerfectDay: React.FC<Props> = ({ count, streak, card, name, onShare, onClose }) => {
  const [revealed, setRevealed] = useState(false);
  const rarityLabel = card?.rarity === 'légendaire' ? 'Légendaire' : card?.rarity === 'rare' ? 'Rare' : 'Commune';
  return (
    <div className="fixed inset-0 z-[205] bg-[#080708]/92 backdrop-blur-2xl flex items-center justify-center p-6 animate-in fade-in duration-500" role="dialog" aria-label="Journée parfaite">
      <div className="force-dark relative w-full max-w-sm rounded-[2.5rem] bg-[#111213] border border-[#FDCA40]/30 p-7 text-center space-y-5 shadow-[0_0_60px_rgba(253,202,64,0.18)] animate-in zoom-in-95 duration-500">
        <button onClick={onClose} aria-label="Fermer" className="absolute top-4 right-4 p-1.5 rounded-full text-[#E6E8E6]/50 hover:text-[#FDCA40]"><X size={18} /></button>
        <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center" style={{ background: 'radial-gradient(circle, rgba(253,202,64,0.25), rgba(253,202,64,0) 70%)' }}>
          <Star size={44} className="text-[#FDCA40]" fill="#FDCA40" />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: '#FDCA40' }}>Journée parfaite</p>
          <p className="text-2xl font-black text-[#E6E8E6] leading-tight">{name ? `Bravo ${name}.` : 'Bravo.'}<br />Tout est accompli.</p>
          <p className="text-[12px] font-semibold text-[#E6E8E6]/65">{count} journée{count > 1 ? 's' : ''} parfaite{count > 1 ? 's' : ''} au total{streak > 1 ? ` · série de ${streak} jours` : ''}</p>
        </div>
        {card && (
          !revealed ? (
            <button onClick={() => setRevealed(true)} className="w-full py-6 rounded-3xl border border-dashed border-[#FDCA40]/50 text-[#FDCA40] flex flex-col items-center gap-2 hover:bg-[#FDCA40]/5 transition-all">
              <Gift size={26} /><span className="text-[11px] font-black uppercase tracking-widest">Une carte surprise t'attend</span><span className="text-[10px] font-semibold text-[#E6E8E6]/55">Touche pour la retourner</span>
            </button>
          ) : (
            <div className="rounded-3xl p-5 text-left space-y-2 animate-in zoom-in-95 duration-500" style={{ background: card.rarity === 'légendaire' ? 'linear-gradient(135deg, rgba(253,202,64,0.22), rgba(47,176,166,0.18))' : 'rgba(253,202,64,0.08)', border: '1px solid rgba(253,202,64,0.35)' }}>
              <p className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: '#FDCA40' }}><Sparkles size={11} /> {card.kind === 'badge' ? `${card.title} · ${rarityLabel}` : card.title}</p>
              <p className="text-[15px] font-bold leading-snug text-[#E6E8E6]">{card.text}</p>
              <p className="text-[10px] font-semibold text-[#E6E8E6]/50">Ajoutée à ta collection (Croissance › Objectifs de vie)</p>
            </div>
          )
        )}
        <div className="flex gap-2">
          <button onClick={onShare} className="flex-1 py-3.5 rounded-2xl bg-[#FDCA40] text-[#111213] text-[11px] font-black uppercase tracking-wider">Partager</button>
          <button onClick={onClose} className="flex-1 py-3.5 rounded-2xl bg-[#E6E8E6]/10 text-[#E6E8E6] text-[11px] font-black uppercase tracking-wider">Continuer</button>
        </div>
      </div>
    </div>
  );
};

export default PerfectDay;
