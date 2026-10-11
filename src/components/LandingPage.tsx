import React from 'react';
import { Logo } from './Logo';
import { TrendingUp, Flame, CalendarCheck } from 'lucide-react';
import AuthPanel from './AuthPanel';

interface Props {
  onGoogle: () => void;
  onGuest: () => void;
  isSigningIn: boolean;
  error?: string | null;
}

const LandingPage: React.FC<Props> = ({ onGoogle, onGuest, isSigningIn, error }) => {
  return (
    <div className="min-h-screen bg-[#F4F4F5] dark:bg-[#080708] text-[#18181B] dark:text-[#E6E8E6] flex flex-col items-center justify-center px-6 py-12 font-['Plus_Jakarta_Sans']" style={{ paddingTop: 'max(3rem, env(safe-area-inset-top))' }}>
      <div className="w-full max-w-md space-y-7 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Logo / titre */}
        <div className="text-center space-y-3">
          <Logo size={72} className="mx-auto rounded-[1.4rem] shadow-2xl shadow-accent/25" />
          <h1 className="text-4xl font-black tracking-tight">Caddr<span className="text-[#FDCA40]">.</span></h1>
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

        {/* Connexion : e-mail, Google, ou sans compte */}
        <AuthPanel onGoogle={onGoogle} onGuest={onGuest} googleBusy={isSigningIn} notice={error} />

        <p className="text-center text-[10px] font-medium text-[#18181B]/40 dark:text-[#E6E8E6]/40 leading-relaxed">
          Avec un compte, tes données sont sauvegardées et synchronisées sur tous tes appareils.
          Sans compte, elles restent uniquement sur cet appareil (tu pourras créer un compte plus tard, sans rien perdre).
        </p>
      </div>
    </div>
  );
};

export default LandingPage;
