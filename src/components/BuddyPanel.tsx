import React, { useState } from 'react';
import { Users, UserPlus, Check, X, Loader2, Flame, Trash2, Feather } from 'lucide-react';
import type { Buddy, BuddyLink } from '../services/buddyService';
import { validEmail } from '../services/assignService';

const ink = 'text-[#18181B] dark:text-[#E6E8E6]';
const muted = 'text-[#18181B]/60 dark:text-[#E6E8E6]/55';
export const CHEERS = [
  { emoji: '💪', message: 'Tiens bon, tu gères !' },
  { emoji: '🔥', message: 'Bravo pour ta série !' },
  { emoji: '🌿', message: 'Doucement mais sûrement, je crois en toi.' },
  { emoji: '👏', message: 'Belle journée, continue comme ça !' },
];

interface CardProps { buddy: Buddy; onCheer: (b: Buddy, emoji: string, message: string) => Promise<void>; compact?: boolean }

/** Carte d'un binôme : son anneau du jour, sa série, et des encouragements en un geste */
export const BuddyCard: React.FC<CardProps> = ({ buddy, onCheer, compact }) => {
  const [sent, setSent] = useState<string | null>(null);
  const s = buddy.stats;
  const today = new Date(); const tk = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const fresh = s && s.day === tk;
  const rate = fresh ? s!.todayRate : null;
  const R = 18, C = 2 * Math.PI * R;
  return (
    <div className={`rounded-2xl border border-[#18181B]/5 dark:border-[#E6E8E6]/5 bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] ${compact ? 'p-3' : 'p-4'} flex items-center gap-3`}>
      <div className="relative w-11 h-11 shrink-0">
        <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90"><circle cx="22" cy="22" r={R} fill="none" stroke="currentColor" strokeWidth="5" className="text-[#18181B]/[0.08] dark:text-[#E6E8E6]/[0.08]" />
          <circle cx="22" cy="22" r={R} fill="none" stroke={rate === 100 ? '#FDCA40' : 'var(--accent)'} strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - (rate || 0) / 100)} /></svg>
        <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-black ${ink}`}>{rate === null ? '—' : `${rate}%`}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-bold truncate ${ink}`}>{buddy.name}</p>
        <p className={`text-[10px] font-semibold flex flex-wrap items-center gap-x-2 ${muted}`}>
          {s ? <><span className="flex items-center gap-0.5 text-[#B8900A] dark:text-[#FDCA40]"><Flame size={10} />{s.streak} j</span><span>record {s.best} j</span>{fresh && s.hard && <span className="flex items-center gap-0.5 text-accent"><Feather size={10} />jour difficile</span>}{!fresh && <span>pas encore venu aujourd'hui</span>}</> : <span>En attente de ses premières données</span>}
        </p>
      </div>
      <div className="flex gap-1 shrink-0">
        {sent ? <span className="text-[10px] font-black text-accent px-2">Envoyé {sent}</span> : CHEERS.slice(0, compact ? 2 : 4).map(c => (
          <button key={c.emoji} onClick={async () => { await onCheer(buddy, c.emoji, c.message); setSent(c.emoji); }} title={c.message} aria-label={`Encourager ${buddy.name} : ${c.message}`} className="w-8 h-8 rounded-xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 hover:bg-accent/15 text-base">{c.emoji}</button>
        ))}
      </div>
    </div>
  );
};

interface Props {
  signedIn: boolean;
  buddies: Buddy[];
  incoming: BuddyLink[];
  pendingSent: BuddyLink[];
  onInvite: (email: string) => Promise<string | null>;
  onAnswer: (l: BuddyLink, accept: boolean) => Promise<void>;
  onRemove: (linkId: string) => Promise<void>;
  onCheer: (b: Buddy, emoji: string, message: string) => Promise<void>;
  onSignIn: () => void;
}

/** Gestion du binôme de discipline (Croissance › Objectifs de vie) */
const BuddyPanel: React.FC<Props> = ({ signedIn, buddies, incoming, pendingSent, onInvite, onAnswer, onRemove, onCheer, onSignIn }) => {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="glass rounded-[2rem] p-5 sm:p-6 space-y-4" aria-label="Binôme de discipline">
      <div>
        <h2 className={`font-black uppercase tracking-wider text-sm flex items-center gap-2 ${ink}`}><Users size={16} className="text-accent" /> Binôme de discipline</h2>
        <p className={`text-[11px] font-semibold mt-1 ${muted}`}>Avance à deux : vous voyez mutuellement vos séries et votre taux du jour (jamais vos tâches), et vous pouvez vous encourager en un geste.</p>
      </div>
      {!signedIn ? (
        <button onClick={onSignIn} className="w-full py-3 rounded-2xl bg-accent text-white text-[11px] font-black uppercase tracking-wider">Se connecter pour inviter un binôme</button>
      ) : (
        <>
          {incoming.map(l => (
            <div key={l.id} className="rounded-2xl border border-accent/30 bg-accent/5 p-3.5 flex flex-wrap items-center gap-2">
              <p className={`flex-1 min-w-[160px] text-[12px] font-semibold ${ink}`}><strong>{l.fromName || l.fromEmail}</strong> t'invite à devenir son binôme de discipline.</p>
              <button onClick={() => onAnswer(l, true)} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-accent text-white text-[10px] font-black uppercase tracking-wider"><Check size={12} /> Accepter</button>
              <button onClick={() => onAnswer(l, false)} className={`flex items-center gap-1 px-3 py-2 rounded-xl border border-[#18181B]/10 dark:border-[#E6E8E6]/10 text-[10px] font-black uppercase tracking-wider ${muted}`}><X size={12} /> Refuser</button>
            </div>
          ))}
          {buddies.map(b => (
            <div key={b.linkId} className="flex items-center gap-2">
              <div className="flex-1 min-w-0"><BuddyCard buddy={b} onCheer={onCheer} /></div>
              <button onClick={() => { if (confirm(`Mettre fin au binôme avec ${b.name} ?`)) onRemove(b.linkId); }} aria-label={`Retirer ${b.name}`} className={`p-2 rounded-xl hover:text-[#DF2935] ${muted}`}><Trash2 size={14} /></button>
            </div>
          ))}
          {pendingSent.map(l => <p key={l.id} className={`text-[11px] font-semibold flex items-center gap-2 ${muted}`}><Loader2 size={12} className="text-accent" /> Invitation envoyée à {l.toEmail} · en attente <button onClick={() => onRemove(l.id)} className="underline hover:text-[#DF2935]">annuler</button></p>)}
          {buddies.length + pendingSent.length < 3 && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input type="email" inputMode="email" value={email} onChange={e => { setEmail(e.target.value); setMsg(null); }} placeholder="E-mail de ton binôme" aria-label="E-mail du binôme"
                  className={`flex-1 min-w-0 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-4 py-3 rounded-xl text-sm font-semibold border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent ${ink}`} />
                <button disabled={busy || !validEmail(email)} onClick={async () => { setBusy(true); const e = await onInvite(email); setBusy(false); setMsg(e ? { ok: false, text: e } : { ok: true, text: 'Invitation envoyée : elle apparaîtra dans son app Caddr.' }); if (!e) setEmail(''); }}
                  className="px-4 rounded-xl bg-accent text-white flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider disabled:opacity-40">{busy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Inviter</button>
              </div>
              {msg && <p className={`text-[11px] font-bold ${msg.ok ? 'text-accent' : 'text-[#DF2935]'}`}>{msg.text}</p>}
              <p className={`text-[10px] font-semibold ${muted}`}>La personne doit avoir un compte Caddr. avec cette adresse. Jusqu'à 3 binômes.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BuddyPanel;
