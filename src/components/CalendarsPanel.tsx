import React, { useRef, useState } from 'react';
import { X, Link2, Upload, RefreshCw, Trash2, Eye, EyeOff, Loader2, AlertCircle, ChevronDown, ChevronUp, CalendarPlus } from 'lucide-react';
import type { ExternalCalendar } from '../types';
import { parseICS, trimEvents, dropCache } from '../icsImport';
import { generateId } from '../utils';

const COLORS = ['#9085e9', '#3987e5', '#199e70', '#c98500', '#d55181', '#e66767', '#d95926', '#008300'];

interface Props {
  calendars: ExternalCalendar[];
  onChange: (cals: ExternalCalendar[]) => void;
  onClose: () => void;
  errors: Record<string, string>;
  loading: Record<string, boolean>;
  lastSync: (id: string) => number | undefined;
  eventCount: (c: ExternalCalendar) => number;
  onRefresh: (c: ExternalCalendar) => void;
}

const ink = 'text-[#18181B] dark:text-[#E6E8E6]';
const muted = 'text-[#18181B]/55 dark:text-[#E6E8E6]/55';
const field = `w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-3.5 py-2.5 rounded-xl text-sm font-semibold border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent ${ink}`;

const CalendarsPanel: React.FC<Props> = ({ calendars, onChange, onClose, errors, loading, lastSync, eventCount, onRefresh }) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [help, setHelp] = useState<'google' | 'outlook' | 'apple' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nextColor = COLORS[calendars.length % COLORS.length];

  const addUrl = () => {
    setMsg(null);
    const u = url.trim();
    if (!/^(https|webcals?):\/\//i.test(u)) { setMsg("L'adresse doit commencer par https:// ou webcal://"); return; }
    if (calendars.some(c => c.url === u)) { setMsg('Cet agenda est déjà ajouté.'); return; }
    const cal: ExternalCalendar = { id: generateId(), name: name.trim() || 'Mon agenda', color: nextColor, url: u, updatedAt: new Date().toISOString() };
    onChange([...calendars, cal]);
    setName(''); setUrl('');
  };

  const importFile = async (f: File) => {
    setMsg(null);
    try {
      const text = await f.text();
      if (!/BEGIN:VCALENDAR/i.test(text)) { setMsg("Ce fichier n'est pas un agenda .ics."); return; }
      const events = trimEvents(parseICS(text), 30, 1500);
      const cal: ExternalCalendar = { id: generateId(), name: name.trim() || f.name.replace(/\.ics$/i, ''), color: nextColor, events, updatedAt: new Date().toISOString() };
      onChange([...calendars, cal]);
      setName('');
      setMsg(`${events.length} événement${events.length > 1 ? 's' : ''} importé${events.length > 1 ? 's' : ''}.`);
    } catch { setMsg('Lecture du fichier impossible.'); }
  };

  const update = (id: string, patch: Partial<ExternalCalendar>) => onChange(calendars.map(c => c.id === id ? { ...c, ...patch } : c));
  const remove = (id: string) => { dropCache(id); onChange(calendars.filter(c => c.id !== id)); };

  const HELP = {
    google: ['Ouvre Google Agenda sur un ordinateur (calendar.google.com).', 'Paramètres ⚙ → dans la colonne de gauche, clique sur ton agenda.', 'Section « Intégrer l’agenda » → copie « Adresse secrète au format iCal ».', 'Colle-la ci-dessus. Garde cette adresse pour toi : elle donne accès à ton agenda.'],
    outlook: ['Ouvre Outlook sur le web (outlook.com ou outlook.office.com).', 'Paramètres ⚙ → Calendrier → Calendriers partagés.', '« Publier un calendrier » : choisis l’agenda et « Peut afficher tous les détails », puis Publier.', 'Copie le lien ICS et colle-le ci-dessus.'],
    apple: ['Sur iCloud.com → Calendrier, ou dans l’app Calendrier du Mac.', 'Clic sur l’icône de partage à côté de l’agenda → coche « Calendrier public ».', 'Copie l’adresse (webcal://…) et colle-la ci-dessus.'],
  } as const;

  return (
    <div className="fixed inset-0 z-[130] bg-black/40 flex items-end sm:items-center justify-center p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="glass bg-[#F4F4F5] dark:bg-[#111] w-full max-w-lg max-h-[88vh] overflow-y-auto custom-scrollbar rounded-3xl p-5 space-y-5 animate-in slide-in-from-bottom-4" role="dialog" aria-label="Agendas externes">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`text-base font-black ${ink}`}>Agendas externes</p>
            <p className={`text-[11px] font-semibold ${muted}`}>Affiche tes rendez-vous Google, Outlook ou iCloud dans le Planning, à côté de tes tâches (lecture seule). Les chevauchements sont signalés.</p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className={`p-1.5 rounded-full hover:text-accent ${muted}`}><X size={18} /></button>
        </div>

        {calendars.length > 0 && (
          <ul className="space-y-2">
            {calendars.map(c => {
              const at = c.url ? lastSync(c.id) : (c.updatedAt ? new Date(c.updatedAt).getTime() : undefined);
              return (
                <li key={c.id} className="rounded-2xl bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] border border-[#18181B]/5 dark:border-[#E6E8E6]/5 p-3 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <label className="relative w-5 h-5 rounded-md shrink-0 cursor-pointer" style={{ backgroundColor: c.color }} title="Changer la couleur">
                      <select aria-label="Couleur" value={c.color} onChange={e => update(c.id, { color: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer">
                        {COLORS.map(col => <option key={col} value={col}>{col}</option>)}
                      </select>
                    </label>
                    <input value={c.name} onChange={e => update(c.id, { name: e.target.value })} aria-label="Nom de l'agenda" className={`flex-1 min-w-0 bg-transparent text-sm font-bold outline-none ${ink}`} />
                    <button onClick={() => update(c.id, { hidden: !c.hidden })} aria-label={c.hidden ? 'Afficher' : 'Masquer'} title={c.hidden ? 'Afficher' : 'Masquer'} className={`p-1.5 rounded-lg hover:text-accent ${muted}`}>{c.hidden ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                    {c.url && <button onClick={() => onRefresh(c)} aria-label="Actualiser" title="Actualiser" className={`p-1.5 rounded-lg hover:text-accent ${muted}`}>{loading[c.id] ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}</button>}
                    <button onClick={() => remove(c.id)} aria-label="Supprimer" title="Supprimer" className={`p-1.5 rounded-lg hover:text-[#DF2935] ${muted}`}><Trash2 size={15} /></button>
                  </div>
                  <p className={`text-[10px] font-semibold ${muted}`}>
                    {c.url ? 'Adresse ICS · actualisé automatiquement' : 'Fichier importé'} · {eventCount(c)} événement{eventCount(c) > 1 ? 's' : ''}
                    {at ? ` · mis à jour ${new Date(at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
                  </p>
                  {errors[c.id] && <p className="flex items-start gap-1.5 text-[11px] font-bold text-[#DF2935]"><AlertCircle size={13} className="shrink-0 mt-0.5" />{errors[c.id]}</p>}
                </li>
              );
            })}
          </ul>
        )}

        <div className="space-y-3">
          <p className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>Ajouter un agenda</p>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nom (ex. Travail)" className={field} />
          <div className="flex gap-2">
            <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && addUrl()} placeholder="Adresse iCal (https://… ou webcal://…)" inputMode="url" className={field} />
            <button onClick={addUrl} disabled={!url.trim()} className="shrink-0 flex items-center gap-1.5 px-4 rounded-xl bg-accent text-white text-[11px] font-black uppercase tracking-wider disabled:opacity-40"><Link2 size={14} /> Ajouter</button>
          </div>
          <div className={`flex items-center gap-3 text-[10px] font-black uppercase tracking-widest ${muted}`}><span className="flex-1 h-px bg-[#18181B]/10 dark:bg-[#E6E8E6]/10" /> ou <span className="flex-1 h-px bg-[#18181B]/10 dark:bg-[#E6E8E6]/10" /></div>
          <button onClick={() => fileRef.current?.click()} className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[11px] font-black uppercase tracking-wider hover:text-accent ${ink}`}><Upload size={14} /> Importer un fichier .ics</button>
          <input ref={fileRef} type="file" accept=".ics,text/calendar" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ''; }} />
          <p className={`text-[10px] font-medium ${muted}`}>Un fichier importé n'est pas mis à jour automatiquement ; une adresse iCal l'est toutes les 30 minutes.</p>
          {msg && <p className="text-[11px] font-bold text-accent">{msg}</p>}
        </div>

        <div className="space-y-2">
          <p className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${muted}`}><CalendarPlus size={12} /> Où trouver l'adresse iCal ?</p>
          {(['google', 'outlook', 'apple'] as const).map(k => (
            <div key={k} className="rounded-xl bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03]">
              <button onClick={() => setHelp(help === k ? null : k)} className={`w-full flex items-center justify-between px-3 py-2.5 text-[12px] font-bold ${ink}`}>
                <span className="flex-1 text-left">{k === 'google' ? 'Google Agenda' : k === 'outlook' ? 'Outlook / Microsoft 365' : 'Apple iCloud'}</span>
                {help === k ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {help === k && <ol className={`list-decimal pl-8 pr-3 pb-3 space-y-1 text-[11px] font-medium ${muted}`}>{HELP[k].map(s => <li key={s}>{s}</li>)}</ol>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalendarsPanel;
