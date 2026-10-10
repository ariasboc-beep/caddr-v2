import React, { useState } from 'react';
import { Loader2, Mail, Lock, User as UserIcon, Eye, EyeOff, Sparkles, Info } from 'lucide-react';
import { signInWithEmail, signUpWithEmail, resetPassword, authErrorMessage, isIOS, isStandalone } from '../services/syncService';

interface Props {
  onGoogle: () => Promise<void> | void;
  onGuest?: () => void;          // affiché sur l'écran d'accueil
  googleBusy?: boolean;
  notice?: string | null;        // message venant de l'app (retour Google raté, etc.)
  guestHint?: boolean;           // rappel : les données de l'appareil seront conservées
  onDone?: () => void;
}

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 11v2.8h6.7c-.3 1.7-2 5-6.7 5-4 0-7.3-3.3-7.3-7.4S8 3.9 12 3.9c2.3 0 3.8 1 4.7 1.8l2-1.9C17.4 2.5 15 1.5 12 1.5 6.7 1.5 2.4 5.8 2.4 11.1S6.7 20.7 12 20.7c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z"/></svg>
);

const AuthPanel: React.FC<Props> = ({ onGoogle, onGuest, googleBusy, notice, guestHint, onDone }) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const iosApp = isIOS() && isStandalone();

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null); setInfo(null);
    if (!email.trim()) { setError('Saisis ton adresse e-mail.'); return; }
    setBusy(true);
    try {
      if (mode === 'reset') {
        await resetPassword(email);
        setInfo('E-mail envoyé. Ouvre le lien reçu pour choisir un nouveau mot de passe (pense à vérifier les spams).');
        setMode('signin');
      } else if (mode === 'signup') {
        if (password.length < 6) { setError('Mot de passe trop court (6 caractères minimum).'); setBusy(false); return; }
        await signUpWithEmail(email, password, name);
        onDone?.();
      } else {
        await signInWithEmail(email, password);
        onDone?.();
      }
    } catch (err: any) {
      setError(authErrorMessage(err?.code));
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full bg-transparent py-3.5 text-sm font-semibold outline-none text-[#18181B] dark:text-[#E6E8E6] placeholder-[#18181B]/35 dark:placeholder-[#E6E8E6]/35';
  const field = 'flex items-center gap-3 px-4 rounded-2xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 border border-[#18181B]/10 dark:border-[#E6E8E6]/10 focus-within:border-accent transition-all';

  return (
    <div className="space-y-4">
      {notice && (
        <div className="flex gap-2.5 p-3.5 rounded-2xl bg-[#FDCA40]/10 border border-[#FDCA40]/30">
          <Info size={16} className="text-[#FDCA40] shrink-0 mt-0.5" />
          <p className="text-[11px] font-semibold leading-relaxed text-[#18181B] dark:text-[#E6E8E6]">{notice}</p>
        </div>
      )}

      {mode !== 'reset' && (
        <div className="flex p-1 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-2xl" role="tablist">
          {([['signin', 'Se connecter'], ['signup', 'Créer un compte']] as const).map(([m, t]) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null); setInfo(null); }}
              className={`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${mode === m ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-[#18181B]/60 dark:text-[#E6E8E6]/60'}`}>{t}</button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        {mode === 'reset' && <p className="text-xs font-semibold text-[#18181B]/70 dark:text-[#E6E8E6]/70">Saisis ton e-mail : tu recevras un lien pour choisir un nouveau mot de passe.</p>}
        {mode === 'signup' && (
          <label className={field}><UserIcon size={16} className="text-[#18181B]/40 dark:text-[#E6E8E6]/40 shrink-0" />
            <input className={input} placeholder="Prénom (facultatif)" autoComplete="given-name" value={name} onChange={e => setName(e.target.value)} /></label>
        )}
        <label className={field}><Mail size={16} className="text-[#18181B]/40 dark:text-[#E6E8E6]/40 shrink-0" />
          <input className={input} type="email" inputMode="email" placeholder="Adresse e-mail" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
        {mode !== 'reset' && (
          <label className={field}><Lock size={16} className="text-[#18181B]/40 dark:text-[#E6E8E6]/40 shrink-0" />
            <input className={input} type={show ? 'text' : 'password'} placeholder={mode === 'signup' ? 'Mot de passe (6 caractères min.)' : 'Mot de passe'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} />
            <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} className="p-1 text-[#18181B]/40 dark:text-[#E6E8E6]/40 hover:text-accent">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </label>
        )}
        {error && <p className="text-[11px] font-bold text-[#DF2935]" role="alert">{error}</p>}
        {info && <p className="text-[11px] font-bold text-accent">{info}</p>}
        <button type="submit" disabled={busy} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-accent text-white font-black text-sm shadow-lg shadow-accent/25 active:scale-[0.98] transition-all disabled:opacity-60">
          {busy && <Loader2 size={16} className="animate-spin" />}
          {mode === 'signin' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : 'Envoyer le lien'}
        </button>
        <div className="flex justify-center">
          {mode === 'signin' && <button type="button" onClick={() => { setMode('reset'); setError(null); }} className="text-[11px] font-bold text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent">Mot de passe oublié ?</button>}
          {mode === 'reset' && <button type="button" onClick={() => setMode('signin')} className="text-[11px] font-bold text-[#18181B]/60 dark:text-[#E6E8E6]/60 hover:text-accent">Retour à la connexion</button>}
        </div>
      </form>

      {mode !== 'reset' && (
        <>
          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-[#18181B]/40 dark:text-[#E6E8E6]/40">
            <span className="flex-1 h-px bg-[#18181B]/10 dark:bg-[#E6E8E6]/10" /> ou <span className="flex-1 h-px bg-[#18181B]/10 dark:bg-[#E6E8E6]/10" />
          </div>
          <button type="button" onClick={() => onGoogle()} disabled={googleBusy}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-[#18181B] dark:bg-[#E6E8E6] text-white dark:text-[#080708] font-black text-sm shadow-lg active:scale-[0.98] transition-all disabled:opacity-60">
            {googleBusy ? <Loader2 size={18} className="animate-spin" /> : <GoogleIcon />} Continuer avec Google
          </button>
          {iosApp && <p className="text-[10px] font-semibold text-center leading-relaxed text-[#18181B]/60 dark:text-[#E6E8E6]/60">Sur iPhone, depuis l'app installée, Google peut ne pas revenir dans l'app. Préfère l'e-mail, ou ouvre caddr-v2.netlify.app dans Safari.</p>}
        </>
      )}

      {onGuest && (
        <button type="button" onClick={onGuest} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl glass text-[#18181B] dark:text-[#E6E8E6] font-black text-sm active:scale-[0.98] transition-all">
          <Sparkles size={16} className="text-accent" /> Continuer sans compte
        </button>
      )}
      {guestHint && <p className="text-[10px] font-semibold text-center leading-relaxed text-[#18181B]/60 dark:text-[#E6E8E6]/60">Tes données actuelles (sur cet appareil) seront conservées et ajoutées à ton compte.</p>}
    </div>
  );
};

export default AuthPanel;
