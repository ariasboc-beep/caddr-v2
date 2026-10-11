import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, HandHeart, Trophy, Flame, Sparkles, Plus, Search, Quote, Check, BookHeart, Lightbulb, CalendarDays } from 'lucide-react';
import type { JournalEntry } from '../types';
import { getKeyFromDate } from '../utils';
import { Journal, filled, isComplete, isWritten, countItems, journalStats, memoryOf, GRATITUDE_PROMPTS, PRIDE_PROMPTS } from '../journal';

interface Props {
  journal: Journal;
  onSave: (dateKey: string, entry: JournalEntry) => void;
  doneOn: (dateKey: string) => string[]; // titres des tâches / habitudes accomplies ce jour-là
  accentHex: string;
}

const ink = 'text-[#18181B] dark:text-[#E6E8E6]';
const muted = 'text-[#18181B]/55 dark:text-[#E6E8E6]/55';
const faint = 'text-[#18181B]/35 dark:text-[#E6E8E6]/35';
const GOLD = '#FDCA40';
const GREEN = 'var(--accent)';
const fmtLong = (k: string) => new Date(k + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtShort = (k: string) => new Date(k + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
const empty = (): JournalEntry => ({ gratitude: ['', '', ''], pride: ['', '', ''], note: '', updatedAt: new Date().toISOString() });
const pad3 = (xs?: string[]) => [0, 1, 2].map(i => xs?.[i] || '');

const JournalView: React.FC<Props> = ({ journal, onSave, doneOn, accentHex }) => {
  const todayKey = getKeyFromDate(new Date());
  const [dateKey, setDateKey] = useState(todayKey);
  const [month, setMonth] = useState(() => todayKey.slice(0, 7));
  const [query, setQuery] = useState('');
  const [showN, setShowN] = useState(8);
  const [promptIdx, setPromptIdx] = useState({ g: new Date().getDate() % GRATITUDE_PROMPTS.length, p: new Date().getDate() % PRIDE_PROMPTS.length });

  const entry: JournalEntry = journal[dateKey] ? { ...journal[dateKey], gratitude: pad3(journal[dateKey].gratitude), pride: pad3(journal[dateKey].pride) } : empty();
  const stats = useMemo(() => journalStats(journal, todayKey), [journal, todayKey]);
  const memory = useMemo(() => memoryOf(journal, todayKey), [journal, todayKey]);
  const suggestions = useMemo(() => doneOn(dateKey).filter(t => !entry.pride.some(p => p.trim().toLowerCase().includes(t.toLowerCase()))).slice(0, 8), [doneOn, dateKey, entry.pride]);

  const save = (patch: Partial<JournalEntry>) => onSave(dateKey, { ...entry, ...patch, updatedAt: new Date().toISOString() });
  const setItem = (kind: 'gratitude' | 'pride', i: number, v: string) => { const xs = [...entry[kind]]; xs[i] = v; save({ [kind]: xs } as Partial<JournalEntry>); };
  const addSuggestion = (t: string) => {
    const i = entry.pride.findIndex(x => !x.trim());
    if (i === -1) return;
    setItem('pride', i, t);
  };
  const shift = (n: number) => { const d = new Date(dateKey + 'T12:00:00'); d.setDate(d.getDate() + n); const k = getKeyFromDate(d); if (k <= todayKey) { setDateKey(k); setMonth(k.slice(0, 7)); } };

  // Calendrier du mois
  const cal = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const first = new Date(y, m - 1, 1); const dim = new Date(y, m, 0).getDate();
    const lead = (first.getDay() + 6) % 7;
    return { lead, days: Array.from({ length: dim }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`), label: first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) };
  }, [month]);
  const shiftMonth = (n: number) => { const [y, m] = month.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; if (k <= todayKey.slice(0, 7)) setMonth(k); };

  const history = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.keys(journal).filter(k => countItems(journal[k]) > 0 && k !== dateKey)
      .filter(k => !q || [...filled(journal[k].gratitude), ...filled(journal[k].pride), journal[k].note || ''].some(x => x.toLowerCase().includes(q)))
      .sort((a, b) => b.localeCompare(a));
  }, [journal, query, dateKey]);

  const done = isComplete(entry);
  const field = `w-full bg-transparent text-sm font-semibold outline-none resize-none leading-snug py-2 ${ink} placeholder:text-[#18181B]/30 dark:placeholder:text-[#E6E8E6]/30`;

  // Fonction de rendu (pas un composant) : sinon le champ perdrait le focus à chaque frappe
  const renderCard = (kind: 'gratitude' | 'pride') => {
    const isG = kind === 'gratitude';
    const color = isG ? GOLD : GREEN;
    const prompts = isG ? GRATITUDE_PROMPTS : PRIDE_PROMPTS;
    const pi = isG ? promptIdx.g : promptIdx.p;
    const n = filled(entry[kind]).length;
    return (
      <section key={kind} className="glass rounded-[2rem] p-5 space-y-3" style={{ boxShadow: `inset 0 3px 0 ${color}` }} aria-label={isG ? 'Gratitude' : 'Fierté'}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}22` }}>{isG ? <HandHeart size={20} style={{ color }} /> : <Trophy size={20} style={{ color }} />}</div>
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-black ${ink}`}>{isG ? 'Gratitude' : 'Fierté'}</h3>
            <p className={`text-[11px] font-semibold ${muted}`}>{isG ? 'Trois choses pour lesquelles je ressens de la gratitude' : 'Trois choses dont je suis fier·e aujourd’hui'}</p>
          </div>
          <span className="text-[11px] font-black tabular-nums px-2 py-0.5 rounded-full" style={{ color, backgroundColor: `${color}1a` }}>{n}/3</span>
        </div>
        <ol className="space-y-1">
          {entry[kind].map((v, i) => (
            <li key={i} className="flex items-start gap-3 border-b border-[#18181B]/[0.06] dark:border-[#E6E8E6]/[0.06] last:border-0">
              <span className="mt-2.5 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0" style={{ backgroundColor: v.trim() ? color : `${color}22`, color: v.trim() ? '#fff' : color }}>{v.trim() ? <Check size={11} strokeWidth={4} /> : i + 1}</span>
              <textarea rows={1} value={v} maxLength={280} aria-label={`${isG ? 'Gratitude' : 'Fierté'} ${i + 1}`}
                onChange={e => { setItem(kind, i, e.target.value); e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }}
                ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                placeholder={i === n ? prompts[pi] + '…' : isG ? 'Merci pour…' : 'J’ai réussi à…'} className={field} />
            </li>
          ))}
        </ol>
        <button onClick={() => setPromptIdx(p => isG ? { ...p, g: (p.g + 1) % prompts.length } : { ...p, p: (p.p + 1) % prompts.length })} className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider hover:text-accent ${muted}`}>
          <Lightbulb size={12} /> Une autre idée
        </button>
        {!isG && suggestions.length > 0 && entry.pride.some(x => !x.trim()) && (
          <div className="space-y-1.5 pt-1">
            <p className={`text-[10px] font-black uppercase tracking-widest ${faint}`}>Accompli {dateKey === todayKey ? 'aujourd’hui' : 'ce jour-là'}</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map(t => <button key={t} onClick={() => addSuggestion(t)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-accent/25 bg-accent/10 hover:bg-accent/20 ${ink}`}><Plus size={11} />{t}</button>)}
            </div>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24">
      {/* En-tête */}
      <div className="space-y-1">
        <h2 className={`text-2xl font-black flex items-center gap-2 ${ink}`}><BookHeart size={24} className="text-accent" /> Journal</h2>
        <p className={`text-xs font-semibold ${muted}`}>Gratitude et fierté : reconnaître ce qui est déjà là et ce que tu as déjà accompli.</p>
      </div>

      {/* Chiffres */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { l: 'Série', v: `${stats.current} j`, s: stats.current ? 'jours d’affilée' : 'commence aujourd’hui', icon: <Flame size={12} className="text-[#FDCA40]" /> },
          { l: 'Record', v: `${stats.best} j`, s: `${stats.written} jour${stats.written > 1 ? 's' : ''} écrits`, icon: <Sparkles size={12} className="text-accent" /> },
          { l: 'Gratitudes', v: String(stats.gratitude), s: 'notées au total', icon: <HandHeart size={12} style={{ color: GOLD }} /> },
          { l: 'Fiertés', v: String(stats.pride), s: 'notées au total', icon: <Trophy size={12} style={{ color: GREEN }} /> },
        ].map(c => (
          <div key={c.l} className="glass rounded-2xl px-3.5 py-3 min-w-0">
            <p className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${muted}`}>{c.icon}{c.l}</p>
            <p className={`text-xl font-black leading-tight ${ink}`}>{c.v}</p>
            <p className={`text-[10px] font-semibold truncate ${muted}`}>{c.s}</p>
          </div>
        ))}
      </div>

      {/* Date */}
      <div className="flex items-center gap-2">
        <button onClick={() => shift(-1)} aria-label="Jour précédent" className={`p-2 rounded-xl hover:bg-accent/10 hover:text-accent ${muted}`}><ChevronLeft size={18} /></button>
        <p className={`flex-1 text-center text-sm font-black first-letter:uppercase ${ink}`}>{dateKey === todayKey ? 'Aujourd’hui · ' : ''}{fmtLong(dateKey)}</p>
        <button onClick={() => shift(1)} disabled={dateKey >= todayKey} aria-label="Jour suivant" className={`p-2 rounded-xl hover:bg-accent/10 hover:text-accent disabled:opacity-30 ${muted}`}><ChevronRight size={18} /></button>
        {dateKey !== todayKey && <button onClick={() => { setDateKey(todayKey); setMonth(todayKey.slice(0, 7)); }} className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider text-accent bg-accent/10 hover:bg-accent hover:text-white transition-all">Aujourd’hui</button>}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {renderCard('gratitude')}
        {renderCard('pride')}
      </div>

      <section className="glass rounded-[2rem] p-5 space-y-2">
        <label htmlFor="journal-note" className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${muted}`}><Quote size={12} /> Une phrase pour retenir cette journée <span className={`normal-case tracking-normal font-semibold ${faint}`}>(facultatif)</span></label>
        <textarea id="journal-note" rows={2} value={entry.note || ''} maxLength={500} onChange={e => save({ note: e.target.value })} placeholder="Ce que je veux me rappeler de ce jour…" className={`${field} border-0`} />
      </section>

      {done && (
        <div className="rounded-[2rem] p-5 flex items-center gap-3 border border-accent/30 bg-accent/10 animate-in zoom-in-95">
          <Sparkles size={22} className="text-accent shrink-0" />
          <p className={`text-sm font-bold ${ink}`}>Journal complet. Prends une seconde pour relire tes six lignes : tout cela fait déjà partie de ta vie.</p>
        </div>
      )}

      {/* Souvenir */}
      {memory && (
        <section className="glass rounded-[2rem] p-5 space-y-3">
          <p className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${muted}`}><Sparkles size={12} className="text-accent" /> Souvenir · {fmtShort(memory.date)}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {filled(memory.entry.gratitude).length > 0 && <div><p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: GOLD }}>Gratitude</p><ul className={`space-y-1 text-[13px] font-medium ${ink}`}>{filled(memory.entry.gratitude).map((x, i) => <li key={i}>· {x}</li>)}</ul></div>}
            {filled(memory.entry.pride).length > 0 && <div><p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: GREEN }}>Fierté</p><ul className={`space-y-1 text-[13px] font-medium ${ink}`}>{filled(memory.entry.pride).map((x, i) => <li key={i}>· {x}</li>)}</ul></div>}
          </div>
          <button onClick={() => { setDateKey(memory.date); setMonth(memory.date.slice(0, 7)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-[10px] font-black uppercase tracking-wider text-accent">Ouvrir ce jour</button>
        </section>
      )}

      {/* Calendrier */}
      <section className="glass rounded-[2rem] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <p className={`flex-1 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${muted}`}><CalendarDays size={12} /> {cal.label}</p>
          <button onClick={() => shiftMonth(-1)} aria-label="Mois précédent" className={`p-1.5 rounded-lg hover:text-accent ${muted}`}><ChevronLeft size={16} /></button>
          <button onClick={() => shiftMonth(1)} aria-label="Mois suivant" disabled={month >= todayKey.slice(0, 7)} className={`p-1.5 rounded-lg hover:text-accent disabled:opacity-30 ${muted}`}><ChevronRight size={16} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1.5 max-w-sm">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <span key={i} className={`text-center text-[9px] font-black ${faint}`}>{d}</span>)}
          {Array.from({ length: cal.lead }, (_, i) => <span key={'x' + i} />)}
          {cal.days.map(k => {
            const e = journal[k]; const c = isComplete(e), w = isWritten(e), any = countItems(e) > 0;
            const future = k > todayKey;
            return (
              <button key={k} disabled={future} onClick={() => setDateKey(k)} title={c ? 'Complet' : w ? 'Écrit' : any ? 'Commencé' : 'Vide'}
                className={`aspect-square rounded-lg text-[10px] font-black flex items-center justify-center transition-all disabled:opacity-25 ${k === dateKey ? 'ring-2 ring-offset-1 ring-offset-transparent' : ''} ${c || w ? 'text-white' : ink}`}
                style={{ backgroundColor: c ? accentHex : w ? `${accentHex}99` : any ? `${accentHex}33` : 'rgba(127,127,127,0.08)', ['--tw-ring-color' as string]: accentHex }}>
                {Number(k.slice(8))}
              </button>
            );
          })}
        </div>
        <div className={`flex flex-wrap gap-3 text-[10px] font-bold ${muted}`}>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: accentHex }} />3 + 3 complet</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: `${accentHex}99` }} />écrit</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: `${accentHex}33` }} />commencé</span>
        </div>
      </section>

      {/* Historique */}
      {(history.length > 0 || query) && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <p className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>Relire</p>
            <label className="flex-1 flex items-center gap-2 px-3 rounded-xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 border border-[#18181B]/5 dark:border-[#E6E8E6]/5 focus-within:border-accent">
              <Search size={14} className={faint} />
              <input value={query} onChange={e => { setQuery(e.target.value); setShowN(8); }} placeholder="Chercher un mot, une personne…" aria-label="Chercher dans le journal" className={`flex-1 bg-transparent py-2.5 text-sm font-semibold outline-none ${ink}`} />
            </label>
          </div>
          {history.length === 0 && <p className={`text-xs font-semibold ${muted}`}>Aucune entrée ne contient « {query} ».</p>}
          {history.slice(0, showN).map(k => {
            const e = journal[k];
            return (
              <button key={k} onClick={() => { setDateKey(k); setMonth(k.slice(0, 7)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="w-full text-left glass rounded-2xl p-4 space-y-2 hover:border-accent/30 transition-all">
                <p className={`text-[11px] font-black first-letter:uppercase ${ink}`}>{fmtLong(k)} {isComplete(e) && <span className="ml-1 text-accent">· complet</span>}</p>
                <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
                  <ul className={`text-[12px] font-medium space-y-0.5 ${muted}`}>{filled(e.gratitude).map((x, i) => <li key={i} className="truncate"><span style={{ color: GOLD }}>♥</span> {x}</li>)}</ul>
                  <ul className={`text-[12px] font-medium space-y-0.5 ${muted}`}>{filled(e.pride).map((x, i) => <li key={i} className="truncate"><span style={{ color: GREEN }}>★</span> {x}</li>)}</ul>
                </div>
                {e.note && <p className={`text-[12px] italic ${muted}`}>« {e.note} »</p>}
              </button>
            );
          })}
          {history.length > showN && <button onClick={() => setShowN(n => n + 8)} className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 hover:text-accent ${muted}`}>Voir plus</button>}
        </section>
      )}
    </div>
  );
};

export default JournalView;
