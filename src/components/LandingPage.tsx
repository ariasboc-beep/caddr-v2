import React from 'react';
import { Loader2, Sparkles, TrendingUp, Flame, CalendarCheck } from 'lucide-react';

interface Props {
  onGoogle: () => void;
  onGuest: () => void;
  isSigningIn: boolean;
  error?: string | null;
}

const LandingPage: React.FC<Props> = ({ onGoogle, onGuest, isSigningIn, error }) => {
  return (
    <div className="min-h-screen bg-[#F4F4F5] dark:bg-[#080708] text-[#18181B] dark:text-[#E6E8E6] flex flex-col items-center justify-center px-6 py-12 font-['Plus_Jakarta_Sans']">
      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Logo / titre */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-accent flex items-center justify-center mx-auto shadow-2xl shadow-accent/30">
            <span className="text-white text-2xl font-black">C.</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight">Caddr.</h1>
          <p className="text-sm font-bold text-[#18181B]/60 dark:text-[#E6E8E6]/60">
            Votre discipline quotidienne, mesurée et tenue.
          </p>
        </div>

        {/* Points forts */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { Icon: CalendarCheck, label: 'Routines' },
            { Icon: Flame, label: 'Séries' },
            { Icon: TrendingUp, label: 'Progrès' },
          ].map(({ Icon, label }) => (
            <div key={label} className="glass rounded-2xl p-4 flex flex-col items-center gap-2">
              <Icon size={20} className="text-accent" />
              <span className="text-[9px] font-black uppercase tracking-widest text-[#18181B]/60 dark:text-[#E6E8E6]/60">{label}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={onGoogle}
            disabled={isSigningIn}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-[#18181B] dark:bg-[#E6E8E6] text-white dark:text-[#080708] font-black text-sm shadow-lg active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {isSigningIn ? <Loader2 size={18} className="animate-spin" /> : (
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M12 11v2.8h6.7c-.3 1.7-2 5-6.7 5-4 0-7.3-3.3-7.3-7.4S8 3.9 12 3.9c2.3 0 3.8 1 4.7 1.8l2-1.9C17.4 2.5 15 1.5 12 1.5 6.7 1.5 2.4 5.8 2.4 11.1S6.7 20.7 12 20.7c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z"/></svg>
            )}
            Se connecter avec Google
          </button>

          <button
            onClick={onGuest}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl glass text-[#18181B] dark:text-[#E6E8E6] font-black text-sm active:scale-[0.98] transition-all"
          >
            <Sparkles size={16} className="text-accent" />
            Continuer sans compte
          </button>

          {error && <p className="text-center text-[11px] font-bold text-[#DF2935]">{error}</p>}
        </div>

        <p className="text-center text-[10px] font-medium text-[#18181B]/40 dark:text-[#E6E8E6]/40 leading-relaxed">
          Avec un compte, vos données sont sauvegardées et synchronisées sur tous vos appareils.
          Sans compte, elles restent uniquement sur cet appareil.
        </p>
      </div>
    </div>
  );
};

export default LandingPage;
