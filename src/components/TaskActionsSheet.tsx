import React, { useState } from 'react';
import { X, CalendarClock, CalendarX2, UserPlus, ListPlus, BookOpen, Settings2, Copy, Trash2, Undo2, ChevronLeft, Send, Loader2, ArrowRight, Compass, Heart } from 'lucide-react';
import type { Task, SkipRecord, Identity } from '../types';
import { addDaysKey, fmtDayShort } from '../taskActions';
import { validEmail } from '../services/assignService';

interface Props {
  task: Task;
  isSub: boolean;
  dateKey: string;
  status: SkipRecord | null;
  canAssign: boolean;           // connecté à un compte
  allowAssign?: boolean;        // fonctionnalité activée dans les Réglages
  onPostpone: (toKey: string) => void;
  onCancel: (reason: string) => void;
  onRestore: () => void;
  onAssign: (email: string, note: string) => Promise<string | null>; // renvoie un message d'erreur ou null
  onAddSubtask: (title: string) => void;
  onOpenLog: () => void;
  onConfigure: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSignIn: () => void;
  onClose: () => void;
  identities?: Identity[];
  onSaveMeaning?: (f: { why?: string; identityId?: string; minVersion?: string }) => void;
}

const ink = 'text-[#18181B] dark:text-[#E6E8E6]';
const muted = 'text-[#18181B]/60 dark:text-[#E6E8E6]/55';
const field = `w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-3.5 py-3 rounded-xl text-sm font-semibold border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent ${ink}`;
type View = 'menu' | 'postpone' | 'cancel' | 'assign' | 'sub' | 'meaning';

// Feuille d'actions d'une tâche de la Routine (toujours accessible, y compris au doigt)
const TaskActionsSheet: React.FC<Props> = (p) => {
  const [view, setView] = useState<View>('menu');
  const [date, setDate] = useState(addDaysKey(p.dateKey, 1));
  const [reason, setReason] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [sub, setSub] = useState('');
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState(p.task.why || '');
  const [minV, setMinV] = useState(p.task.minVersion || '');
  const [idt, setIdt] = useState(p.task.identityId || '');
  const identity = (p.identities || []).find(i => i.id === p.task.identityId);
  const [err, setErr] = useState('');
  const tomorrow = addDaysKey(p.dateKey, 1);
  const nextMonday = (() => { const d = new Date(p.dateKey + 'T12:00:00'); const add = ((8 - d.getDay()) % 7) || 7; return addDaysKey(p.dateKey, add); })();

  const Row: React.FC<{ icon: React.ReactNode; label: string; hint?: string; onClick: () => void; danger?: boolean }> = ({ icon, label, hint, onClick, danger }) => (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition-all hover:bg-[#18181B]/5 dark:hover:bg-[#E6E8E6]/5 ${danger ? 'text-[#DF2935]' : ink}`}>
      <span className={danger ? '' : 'text-accent'}>{icon}</span>
      <span className="flex-1 min-w-0"><span className="block text-[13px] font-bold">{label}</span>{hint && <span className={`block text-[10px] font-semibold ${muted}`}>{hint}</span>}</span>
    </button>
  );
  const Back = () => <button onClick={() => { setView('menu'); setErr(''); }} className={`flex items-center gap-1 text-[11px] font-black uppercase tracking-wider ${muted} hover:text-accent`}><ChevronLeft size={14} /> Retour</button>;
  const primary = 'w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-accent text-white text-[11px] font-black uppercase tracking-wider shadow-lg shadow-accent/20 disabled:opacity-40';

  return (
    <div className="fixed inset-0 z-[130] bg-black/50 flex items-end sm:items-center justify-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) p.onClose(); }}>
      <div role="dialog" aria-label={`Actions : ${p.task.title}`} className="glass bg-[#F4F4F5] dark:bg-[#0f0f10] w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-4 space-y-2 animate-in slide-in-from-bottom-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div className="flex items-start justify-between gap-3 px-1 pb-1">
          <div className="min-w-0">
            <p className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>{p.isSub ? 'Sous-tâche' : 'Tâche'} · {fmtDayShort(p.dateKey)}</p>
            <p className={`text-base font-black truncate ${ink}`}>{p.task.title}</p>
          </div>
          <button onClick={p.onClose} aria-label="Fermer" className={`p-1.5 rounded-full hover:text-accent ${muted}`}><X size={18} /></button>
        </div>

        {(p.task.why || identity) && (view === 'menu' || view === 'postpone' || view === 'cancel') && (
          <div className="mx-1 mb-1 px-3.5 py-3 rounded-2xl bg-accent/[0.07] border border-accent/20 space-y-0.5">
            {p.task.why && <p className={`text-[12px] font-semibold ${ink}`}><Heart size={11} className="inline -mt-0.5 mr-1 text-accent" />Ton pourquoi : {p.task.why}</p>}
            {identity && <p className={`text-[11px] font-semibold ${muted}`}>Chaque fois que tu la fais : un vote pour « {identity.text} »</p>}
          </div>
        )}
        {view === 'menu' && (
          <div className="space-y-0.5">
            {p.status && (
              <div className="flex items-center justify-between gap-2 px-3.5 py-3 rounded-2xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5">
                <p className={`text-[12px] font-bold ${ink}`}>{p.status.reason || 'Sautée'}</p>
                {p.status.kind !== 'postpone' && p.status.kind !== 'assign' && <button onClick={() => { p.onRestore(); p.onClose(); }} className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-accent"><Undo2 size={13} /> Rétablir</button>}
              </div>
            )}
            {!p.status && !p.isSub && <Row icon={<CalendarClock size={18} />} label="Reporter" hint="À demain ou à une date précise" onClick={() => setView('postpone')} />}
            {!p.status && <Row icon={<CalendarX2 size={18} />} label="Annuler pour ce jour" hint="Elle reste visible, barrée, et ne compte pas dans ton taux" onClick={() => setView('cancel')} />}
            {!p.status && !p.isSub && p.allowAssign !== false && <Row icon={<UserPlus size={18} />} label="Affecter à quelqu'un" hint="À un autre utilisateur Caddr., avec son adresse e-mail" onClick={() => setView('assign')} />}
            {!p.isSub && <Row icon={<ListPlus size={18} />} label="Ajouter une sous-tâche" onClick={() => setView('sub')} />}
            {p.onSaveMeaning && <Row icon={<Compass size={18} />} label="Sens et version minimale" hint={p.task.minVersion ? `Version minimale : ${p.task.minVersion}` : 'Pourquoi, identité, version pour les jours difficiles'} onClick={() => setView('meaning')} />}
            <div className="h-px bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 my-1" />
            <Row icon={<BookOpen size={18} />} label="Journal de bord" onClick={() => { p.onClose(); p.onOpenLog(); }} />
            <Row icon={<Settings2 size={18} />} label="Modifier (heure, durée, priorité…)" onClick={() => { p.onClose(); p.onConfigure(); }} />
            <Row icon={<Copy size={18} />} label="Dupliquer" onClick={() => { p.onDuplicate(); p.onClose(); }} />
            <Row icon={<Trash2 size={18} />} label="Supprimer" danger onClick={() => { p.onDelete(); p.onClose(); }} />
          </div>
        )}

        {view === 'postpone' && (
          <div className="space-y-3 px-1">
            <Back />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { p.onPostpone(tomorrow); p.onClose(); }} className={`px-3 py-3 rounded-2xl border border-accent/30 bg-accent/5 text-left ${ink}`}><span className="block text-[13px] font-black">Demain</span><span className={`block text-[10px] font-semibold ${muted}`}>{fmtDayShort(tomorrow)}</span></button>
              <button onClick={() => { p.onPostpone(nextMonday); p.onClose(); }} className={`px-3 py-3 rounded-2xl border border-[#18181B]/10 dark:border-[#E6E8E6]/10 text-left ${ink}`}><span className="block text-[13px] font-black">Lundi prochain</span><span className={`block text-[10px] font-semibold ${muted}`}>{fmtDayShort(nextMonday)}</span></button>
            </div>
            <label className="block space-y-1.5"><span className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>Ou une date précise</span>
              <input type="date" value={date} min={addDaysKey(p.dateKey, 1)} onChange={e => setDate(e.target.value)} className={`${field} [color-scheme:light] dark:[color-scheme:dark]`} aria-label="Date du report" /></label>
            <button disabled={!date || date <= p.dateKey} onClick={() => { p.onPostpone(date); p.onClose(); }} className={primary}><ArrowRight size={14} /> Reporter au {date ? fmtDayShort(date) : '…'}</button>
            {p.task.recurrence !== 'specific' && p.task.recurrence !== 'once' && <p className={`text-[10px] font-semibold ${muted}`}>C'est une tâche récurrente : elle est reportée pour ce jour seulement, et sa récurrence continue normalement.</p>}
          </div>
        )}

        {view === 'cancel' && (
          <div className="space-y-3 px-1">
            <Back />
            <label className="block space-y-1.5"><span className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>Motif (facultatif)</span>
              <input autoFocus value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex. réunion annulée, imprévu familial…" className={field} /></label>
            <div className="flex flex-wrap gap-1.5">{['Imprévu', 'Plus nécessaire', 'Manque de temps', 'Fatigue'].map(r => <button key={r} onClick={() => setReason(r)} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-[#18181B]/10 dark:border-[#E6E8E6]/10 ${muted} hover:text-accent`}>{r}</button>)}</div>
            <button onClick={() => { p.onCancel(reason); p.onClose(); }} className={primary}><CalendarX2 size={14} /> Annuler pour ce jour</button>
          </div>
        )}

        {view === 'assign' && (
          <div className="space-y-3 px-1">
            <Back />
            {!p.canAssign ? (
              <div className="space-y-3">
                <p className={`text-[12px] font-semibold ${ink}`}>Pour confier une tâche, connecte-toi à ton compte Caddr. : la personne la recevra sur son propre compte.</p>
                <button onClick={() => { p.onClose(); p.onSignIn(); }} className={primary}>Se connecter</button>
              </div>
            ) : (
              <>
                <label className="block space-y-1.5"><span className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>Adresse e-mail de la personne</span>
                  <input autoFocus type="email" inputMode="email" autoComplete="email" value={email} onChange={e => { setEmail(e.target.value); setErr(''); }} placeholder="prenom.nom@exemple.com" className={field} /></label>
                <label className="block space-y-1.5"><span className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>Message (facultatif)</span>
                  <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Contexte, délai, attentes…" className={`${field} resize-none`} /></label>
                {err && <p className="text-[11px] font-bold text-[#DF2935]">{err}</p>}
                <button disabled={busy || !validEmail(email)} onClick={async () => { setBusy(true); const e = await p.onAssign(email, note); setBusy(false); if (e) setErr(e); else p.onClose(); }} className={primary}>
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Confier la tâche
                </button>
                <p className={`text-[10px] font-semibold ${muted}`}>La personne doit avoir un compte Caddr. avec cette adresse. Elle pourra accepter ou refuser, et tu suivras le statut. La tâche sort de ta journée.</p>
              </>
            )}
          </div>
        )}

        {view === 'meaning' && (
          <div className="space-y-3 px-1">
            <Back />
            <label className="block space-y-1.5"><span className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>Pourquoi c'est important pour toi</span>
              <input value={why} onChange={e => setWhy(e.target.value)} placeholder="Ex. être en forme pour mes enfants" className={field} /></label>
            <label className="block space-y-1.5"><span className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>Version minimale (jours difficiles)</span>
              <input value={minV} onChange={e => setMinV(e.target.value)} placeholder="Ex. 2 minutes, 1 page, 5 pompes" className={field} /></label>
            <div className="space-y-1.5"><span className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>Identité renforcée</span>
              {(p.identities || []).length ? (
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setIdt('')} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border ${!idt ? 'border-accent bg-accent/10 text-accent' : `border-[#18181B]/10 dark:border-[#E6E8E6]/10 ${muted}`}`}>Aucune</button>
                  {(p.identities || []).map(i => <button key={i.id} onClick={() => setIdt(i.id)} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border text-left ${idt === i.id ? 'border-accent bg-accent/10 text-accent' : `border-[#18181B]/10 dark:border-[#E6E8E6]/10 ${muted}`}`}>{i.text}</button>)}
                </div>
              ) : <p className={`text-[11px] font-semibold ${muted}`}>Crée d'abord tes identités dans Croissance › Objectifs de vie (« Qui je deviens »).</p>}
            </div>
            <button onClick={() => { p.onSaveMeaning!({ why: why.trim() || undefined, minVersion: minV.trim() || undefined, identityId: idt || undefined }); p.onClose(); }} className={primary}><Compass size={14} /> Enregistrer</button>
            <p className={`text-[10px] font-semibold ${muted}`}>S'applique à cette tâche tous les jours où elle est prévue.</p>
          </div>
        )}

        {view === 'sub' && (
          <div className="space-y-3 px-1">
            <Back />
            <input autoFocus value={sub} onChange={e => setSub(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && sub.trim()) { p.onAddSubtask(sub.trim()); setSub(''); } }} placeholder="Titre de la sous-tâche" aria-label="Titre de la sous-tâche" className={field} />
            <button disabled={!sub.trim()} onClick={() => { p.onAddSubtask(sub.trim()); setSub(''); }} className={primary}><ListPlus size={14} /> Ajouter</button>
            <p className={`text-[10px] font-semibold ${muted}`}>Appuie sur Entrée pour en ajouter plusieurs à la suite.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskActionsSheet;
