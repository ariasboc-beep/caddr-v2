import React, { useState } from 'react';
import { Fingerprint, Plus, Trash2, Link2 } from 'lucide-react';
import type { Identity } from '../types';

interface Props {
  identities: Identity[];
  votes: Record<string, number>;
  linked: Record<string, string[]>;   // identité → titres des tâches reliées
  onAdd: (text: string) => void;
  onRemove: (id: string) => void;
}

const ink = 'text-[#18181B] dark:text-[#E6E8E6]';
const muted = 'text-[#18181B]/60 dark:text-[#E6E8E6]/55';
const IDEAS = ['Je suis une personne sportive', 'Je suis quelqu’un qui tient ses engagements', 'Je suis une lectrice / un lecteur', 'Je prends soin de ma santé', 'Je suis une personne organisée', 'Je parle anglais chaque jour'];

// « Qui je deviens » : chaque tâche cochée reliée à une identité est un vote pour elle
const IdentityPanel: React.FC<Props> = ({ identities, votes, linked, onAdd, onRemove }) => {
  const [text, setText] = useState('');
  const add = (t: string) => { if (t.trim()) { onAdd(t.trim()); setText(''); } };
  const max = Math.max(1, ...identities.map(i => votes[i.id] || 0));
  return (
    <div className="glass rounded-[2rem] p-5 sm:p-6 space-y-4" aria-label="Qui je deviens">
      <div>
        <h2 className={`font-black uppercase tracking-wider text-sm flex items-center gap-2 ${ink}`}><Fingerprint size={16} className="text-accent" /> Qui je deviens</h2>
        <p className={`text-[11px] font-semibold mt-1 ${muted}`}>Chaque tâche cochée est un vote pour la personne que tu deviens. Relie tes routines à une identité depuis le menu ⋯ d'une tâche (« Sens et version minimale »).</p>
      </div>
      {identities.length > 0 && (
        <ul className="space-y-3">
          {identities.map(i => {
            const v = votes[i.id] || 0; const tasks = linked[i.id] || [];
            return (
              <li key={i.id} className="space-y-1.5 group">
                <div className="flex items-baseline justify-between gap-3">
                  <p className={`text-[14px] font-bold ${ink}`}>{i.text}</p>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-[13px] font-black text-accent tabular-nums">{v} vote{v > 1 ? 's' : ''}</span>
                    <button onClick={() => onRemove(i.id)} aria-label={`Supprimer « ${i.text} »`} className={`p-1 rounded-lg opacity-60 hover:opacity-100 hover:text-[#DF2935] ${muted}`}><Trash2 size={13} /></button>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[#18181B]/[0.06] dark:bg-[#E6E8E6]/[0.06] overflow-hidden"><div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${Math.max(v ? 4 : 0, (v / max) * 100)}%` }} /></div>
                <p className={`text-[10px] font-semibold flex items-center gap-1 ${muted}`}><Link2 size={10} /> {tasks.length ? tasks.slice(0, 4).join(' · ') + (tasks.length > 4 ? ` · +${tasks.length - 4}` : '') : 'Aucune tâche reliée pour l’instant'}</p>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex gap-2">
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add(text)} placeholder="Je suis une personne qui…" aria-label="Nouvelle identité"
          className={`flex-1 min-w-0 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-4 py-3 rounded-xl text-sm font-semibold border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent ${ink}`} />
        <button onClick={() => add(text)} disabled={!text.trim()} aria-label="Ajouter l'identité" className="px-4 rounded-xl bg-accent text-white disabled:opacity-40"><Plus size={18} /></button>
      </div>
      {identities.length < 3 && (
        <div className="flex flex-wrap gap-1.5">
          {IDEAS.filter(x => !identities.some(i => i.text === x)).slice(0, 4).map(x => <button key={x} onClick={() => add(x)} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-[#18181B]/10 dark:border-[#E6E8E6]/10 ${muted} hover:text-accent`}>{x}</button>)}
        </div>
      )}
    </div>
  );
};

export default IdentityPanel;
