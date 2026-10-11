import React, { useEffect, useState } from 'react';
import { History, Download, RotateCcw, Loader2, ShieldCheck } from 'lucide-react';
import type { AppData } from '../types';
import { listSnapshots, readSnapshot, SnapshotMeta } from '../backups';

interface Props { onRestore: (data: AppData) => void }

const ink = 'text-[#18181B] dark:text-[#E6E8E6]';
const muted = 'text-[#18181B]/50 dark:text-[#E6E8E6]/50';

// Réglages → Sauvegardes automatiques (sur cet appareil)
const BackupsPanel: React.FC<Props> = ({ onRestore }) => {
  const [list, setList] = useState<SnapshotMeta[] | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  useEffect(() => { listSnapshots().then(setList).catch(() => setList([])); }, []);

  const download = async (m: SnapshotMeta) => {
    setBusy(m.id);
    const d = await readSnapshot(m.id).catch(() => null);
    setBusy(null);
    if (!d) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `caddr_sauvegarde_${m.at.slice(0, 10)}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };
  const restore = async (m: SnapshotMeta) => {
    setBusy(m.id);
    const d = await readSnapshot(m.id).catch(() => null);
    setBusy(null); setConfirm(null);
    if (d) onRestore(d);
  };
  const fmt = (iso: string) => new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const shown = (list || []).slice(0, all ? 30 : 5);

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-[#18181B]/50 dark:text-[#E6E8E6]/50 flex items-center gap-1.5"><ShieldCheck size={12} /> Sauvegardes automatiques</label>
      <p className={`text-[10px] font-medium ${muted}`}>Une copie de tes données est faite chaque jour sur cet appareil (14 jours + 8 semaines gardés). En cas d'erreur, tu peux revenir en arrière.</p>
      {list === null ? <p className={`flex items-center gap-2 text-[11px] ${muted}`}><Loader2 size={12} className="animate-spin" /> Chargement…</p>
        : list.length === 0 ? <p className={`text-[11px] font-semibold ${muted}`}>Première copie dans quelques secondes.</p>
        : (
          <ul className="space-y-1.5">
            {shown.map(m => (
              <li key={m.id} className="rounded-xl bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] px-3 py-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <History size={14} className="text-accent shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12px] font-bold first-letter:uppercase ${ink}`}>{fmt(m.at)} <span className={`text-[10px] font-semibold ${muted}`}>· {m.kind === 'week' ? 'copie de la semaine' : 'copie du jour'}</span></p>
                    <p className={`text-[10px] font-semibold ${muted}`}>{m.counts.blocks} blocs · {m.counts.days} jours · {m.counts.journal} pages de journal · {Math.max(1, Math.round(m.size / 1024))} Ko</p>
                  </div>
                  <button onClick={() => download(m)} aria-label="Télécharger cette sauvegarde" title="Télécharger" className={`p-1.5 rounded-lg hover:text-accent ${muted}`}>{busy === m.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}</button>
                  <button onClick={() => setConfirm(confirm === m.id ? null : m.id)} aria-label="Restaurer cette sauvegarde" title="Restaurer" className={`p-1.5 rounded-lg hover:text-accent ${muted}`}><RotateCcw size={14} /></button>
                </div>
                {confirm === m.id && (
                  <div className="flex flex-wrap items-center gap-2 pl-6">
                    <p className="text-[11px] font-bold text-[#DF2935] flex-1 min-w-[160px]">Remplacer tes données actuelles par cette copie ? (annulable avec le bouton ↶)</p>
                    <button onClick={() => restore(m)} className="px-3 py-1.5 rounded-lg bg-[#DF2935] text-white text-[10px] font-black uppercase tracking-wider">Restaurer</button>
                    <button onClick={() => setConfirm(null)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${muted}`}>Annuler</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      {list && list.length > 5 && <button onClick={() => setAll(v => !v)} className={`text-[10px] font-black uppercase tracking-wider text-accent`}>{all ? 'Voir moins' : `Voir les ${list.length} copies`}</button>}
    </div>
  );
};

export default BackupsPanel;
