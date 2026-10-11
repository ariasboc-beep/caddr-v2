import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import {
  Plus, ChevronLeft, ChevronRight, Check, X, Minus, Flame, Trophy, Ban, Repeat, StickyNote, EyeOff,
  CalendarDays, BarChart3, Settings2, Trash2, Archive, ArrowLeft, Target,
} from 'lucide-react';
import { StandaloneHabit, HabitDayStatus } from '../types';
import { generateId, getKeyFromDate } from '../utils';
import { habitStats, monthlyRates, stateOn, isScheduled, labelsFor, nextStatus, activeHabits, DayState, isEmptyNote } from '../habits';
import RichText, { RichTextView } from './RichText';
import { DayDot } from './DayDot';
export { DayDot };

interface Props {
  habits: StandaloneHabit[];
  onChange: (habits: StandaloneHabit[]) => void;
  accentHex: string;
}

const ink = 'text-[#18181B] dark:text-[#E6E8E6]';
const muted = 'text-[#18181B]/50 dark:text-[#E6E8E6]/50';
const faint = 'text-[#18181B]/35 dark:text-[#E6E8E6]/35';
const RED = '#DF2935';
const COLORS = ['', '#3772FF', '#7C5CFC', '#F5900C', '#F43F6E', '#22A06B'];
const DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D']; // affichage lundi → dimanche
const DOW_IDX = [1, 2, 3, 4, 5, 6, 0];
const DOW_LONG = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const SUGGESTIONS: { name: string; kind: 'build' | 'quit' }[] = [
  { name: 'Ne plus fumer', kind: 'quit' }, { name: 'Boire 2 L d’eau', kind: 'build' },
  { name: 'Marcher 30 minutes', kind: 'build' }, { name: 'Pas de réseaux sociaux après 22 h', kind: 'quit' },
  { name: 'Lire 10 pages', kind: 'build' }, { name: 'Pas de sucre ajouté', kind: 'quit' },
];

const noon = (k: string) => new Date(k + 'T12:00:00');
const fmt = (k: string, o: Intl.DateTimeFormatOptions) => noon(k).toLocaleDateString('fr-FR', o).replace(/\.$/, '');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const freqLabel = (h: StandaloneHabit) => !h.days || h.days.length === 0 || h.days.length === 7 ? 'Tous les jours' : DOW_IDX.filter(d => h.days!.includes(d)).map(d => DOW_LONG[d]).join(' ');

// ---------- Formulaire création / modification ----------
const HabitForm: React.FC<{ initial?: StandaloneHabit; accentHex: string; onSave: (h: StandaloneHabit) => void; onCancel: () => void }> = ({ initial, accentHex, onSave, onCancel }) => {
  const [name, setName] = useState(initial?.name || '');
  const [kind, setKind] = useState<'build' | 'quit'>(initial?.kind || 'build');
  const [days, setDays] = useState<number[]>(initial?.days?.length ? initial.days : []);
  const [startDate, setStartDate] = useState(initial?.startDate || getKeyFromDate(new Date()));
  const [color, setColor] = useState(initial?.color || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [showInRoutine, setShowInRoutine] = useState(initial?.showInRoutine !== false);
  const every = days.length === 0 || days.length === 7;
  const toggleDay = (d: number) => setDays(cur => {
    const base = cur.length === 0 ? [0, 1, 2, 3, 4, 5, 6] : cur;
    const next = base.includes(d) ? base.filter(x => x !== d) : [...base, d];
    return next.length === 7 ? [] : next;
  });
  const input = `w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 p-3.5 rounded-2xl text-sm font-bold border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent ${ink} [color-scheme:dark]`;
  const label = `text-[9px] font-black uppercase tracking-widest ${muted}`;
  const save = () => {
    if (!name.trim()) return;
    onSave({
      ...(initial || { id: generateId(), createdAt: new Date().toISOString(), entries: {} }),
      name: name.trim(), kind, days: every ? [] : days, startDate, color: color || undefined, description: description.trim() || undefined, showInRoutine,
    } as StandaloneHabit);
  };
  return (
    <div className="space-y-5">
      {!initial && (
        <div className="space-y-2">
          <p className={label}>Idées rapides</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map(sg => (
              <button key={sg.name} type="button" onClick={() => { setName(sg.name); setKind(sg.kind); }}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${name === sg.name ? 'border-accent bg-accent/10 text-accent' : `border-transparent bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 ${ink} hover:border-accent/40`}`}>
                {sg.kind === 'quit' ? '⊘ ' : '+ '}{sg.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="block space-y-1.5"><span className={label}>Nom de l'habitude</span>
        <input autoFocus className={input} placeholder="Ex : Ne plus fumer" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} />
      </label>
      <div className="space-y-1.5">
        <span className={label}>Type</span>
        <div className="grid grid-cols-2 gap-2">
          {([['build', 'Prendre une habitude', 'Ex : sport, lecture', Repeat], ['quit', 'Arrêter une habitude', 'Ex : fumer, sucre', Ban]] as const).map(([k, t, sub, Icon]) => (
            <button key={k} type="button" onClick={() => setKind(k)}
              className={`p-3.5 rounded-2xl border text-left transition-all ${kind === k ? 'border-accent bg-accent/10' : 'border-transparent bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 hover:border-accent/40'}`}>
              <span className={`flex items-center gap-2 text-xs font-black ${kind === k ? 'text-accent' : ink}`}><Icon size={14} /> {t}</span>
              <span className={`block text-[10px] font-medium mt-0.5 ${muted}`}>{sub}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <span className={label}>Jours</span>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setDays([])} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border ${every ? 'bg-accent text-white border-accent' : `border-transparent bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 ${muted}`}`}>Tous les jours</button>
          {DOW_IDX.map((d, i) => {
            const on = every || days.includes(d);
            return <button key={d} type="button" onClick={() => toggleDay(d)} aria-pressed={on} aria-label={DOW_LONG[d]}
              className={`w-9 h-9 rounded-full text-[11px] font-black border transition-all ${on ? 'bg-accent/15 border-accent text-accent' : `border-[#18181B]/10 dark:border-[#E6E8E6]/10 ${muted}`}`}>{DOW[i]}</button>;
          })}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block space-y-1.5"><span className={label}>Date de début</span>
          <input type="date" className={input} value={startDate} onChange={e => e.target.value && setStartDate(e.target.value)} />
        </label>
        <div className="space-y-1.5">
          <span className={label}>Couleur</span>
          <div className="flex items-center gap-2 pt-1">
            {COLORS.map(c => (
              <button key={c || 'accent'} type="button" onClick={() => setColor(c)} aria-label={c || 'Couleur de l’app'}
                className={`w-8 h-8 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-offset-transparent ring-[#18181B]/40 dark:ring-white/60 scale-110' : ''}`} style={{ backgroundColor: c || accentHex }} />
            ))}
          </div>
        </div>
      </div>
      <label className="block space-y-1.5"><span className={label}>Pourquoi ? (facultatif)</span>
        <textarea rows={2} className={`${input} resize-none font-medium`} placeholder="Ta motivation, à relire dans les moments difficiles…" value={description} onChange={e => setDescription(e.target.value)} />
      </label>
      <button type="button" onClick={() => setShowInRoutine(v => !v)} aria-pressed={showInRoutine}
        className={`w-full flex items-center justify-between gap-3 p-4 rounded-2xl border transition-all ${showInRoutine ? 'bg-accent/10 border-accent/40' : 'bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 border-transparent'}`}>
        <span className="text-left">
          <span className={`block text-[10px] font-black uppercase tracking-wider ${ink}`}>Afficher dans l'onglet Routine</span>
          <span className={`block text-[10px] font-medium ${muted}`}>{showInRoutine ? 'Visible dans la carte « Habitudes du jour » pour la cocher vite' : 'Suivie uniquement dans l’onglet Habitudes'}</span>
        </span>
        <span className={`w-9 h-5 rounded-full p-0.5 transition-all shrink-0 ${showInRoutine ? 'bg-accent' : 'bg-[#18181B]/15 dark:bg-[#E6E8E6]/15'}`}>
          <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${showInRoutine ? 'translate-x-4' : ''}`} />
        </span>
      </button>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={save} disabled={!name.trim()} className={`flex-1 py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all ${name.trim() ? 'bg-accent text-white shadow-lg shadow-accent/20 active:scale-95' : `bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 ${faint} cursor-not-allowed`}`}>{initial ? 'Enregistrer' : 'Créer l’habitude'}</button>
        <button type="button" onClick={onCancel} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest ${muted}`}>Annuler</button>
      </div>
    </div>
  );
};

// ---------- Fiche d'une habitude ----------
type DetailTab = 'calendar' | 'stats' | 'notes' | 'edit';

const HabitDetail: React.FC<{ habit: StandaloneHabit; accentHex: string; onUpdate: (h: StandaloneHabit) => void; onBack: () => void }> = ({ habit, accentHex, onUpdate, onBack }) => {
  const color = habit.color || accentHex;
  const L = labelsFor(habit);
  const tk = getKeyFromDate(new Date());
  const [tab, setTab] = useState<DetailTab>('calendar');
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1, 12); });
  const [selected, setSelected] = useState<string>(tk);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const stats = useMemo(() => habitStats(habit), [habit]);
  const monthKeyFrom = getKeyFromDate(month);
  const monthKeyTo = getKeyFromDate(new Date(month.getFullYear(), month.getMonth() + 1, 0, 12));
  const monthStats = useMemo(() => habitStats(habit, monthKeyFrom, monthKeyTo), [habit, monthKeyFrom, monthKeyTo]);
  const rates = useMemo(() => monthlyRates(habit, 6), [habit]);
  const entry = habit.entries?.[selected] || {};
  const [noteDraft, setNoteDraft] = useState<{ k: string; v: string }>({ k: selected, v: entry.note || '' });
  const note = noteDraft.k === selected ? noteDraft.v : (entry.note || '');

  const setEntry = (k: string, patch: { s?: HabitDayStatus | null; note?: string }) => {
    const cur = { ...(habit.entries?.[k] || {}) };
    if ('s' in patch) { if (patch.s) cur.s = patch.s; else delete cur.s; }
    if ('note' in patch) { if (!isEmptyNote(patch.note)) cur.note = patch.note; else delete cur.note; }
    const entries = { ...(habit.entries || {}) };
    if (!cur.s && !cur.note) delete entries[k]; else entries[k] = cur;
    onUpdate({ ...habit, entries });
  };

  // Grille du mois (semaines lundi → dimanche)
  const cells: (string | null)[] = [];
  const first = new Date(month); const lead = (first.getDay() + 6) % 7;
  for (let i = 0; i < lead; i++) cells.push(null);
  const dim = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  for (let d = 1; d <= dim; d++) cells.push(getKeyFromDate(new Date(month.getFullYear(), month.getMonth(), d, 12)));
  const canNext = new Date(month.getFullYear(), month.getMonth() + 1, 1) <= new Date();

  const tile = (labelTxt: string, value: React.ReactNode, foot?: string, icon?: React.ReactNode) => (
    <div className="rounded-2xl bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] border border-[#18181B]/5 dark:border-[#E6E8E6]/5 p-4 space-y-1">
      <p className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest ${muted}`}>{icon}{labelTxt}</p>
      <p className={`text-2xl font-black leading-none ${ink}`}>{value}</p>
      {foot && <p className={`text-[10px] font-bold ${muted}`}>{foot}</p>}
    </div>
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex items-start gap-3">
        <button onClick={onBack} aria-label="Retour à la liste" className={`p-2.5 rounded-xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 hover:text-accent ${muted}`}><ArrowLeft size={18} /></button>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black uppercase tracking-widest" style={{ color }}>{habit.kind === 'quit' ? 'Arrêter' : 'Prendre'} · {freqLabel(habit)}</p>
          <h2 className={`text-xl font-black leading-tight ${ink}`}>{habit.name}</h2>
          {habit.description && <p className={`text-xs font-medium mt-1 ${muted}`}>« {habit.description} »</p>}
        </div>
      </div>

      {/* Bandeau de série */}
      <div className="rounded-[2rem] p-5 flex flex-wrap items-center gap-x-8 gap-y-3" style={{ backgroundColor: `${color}1A`, boxShadow: `inset 0 0 0 1px ${color}33` }}>
        {habit.kind === 'quit' ? (
          <div><p className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>Sans rechute depuis</p><p className={`text-3xl font-black ${ink}`}>{stats.sinceLastFail} <span className="text-base">jour{stats.sinceLastFail > 1 ? 's' : ''}</span></p>
            <p className={`text-[10px] font-bold ${muted}`}>{stats.lastFail ? `Dernière rechute : ${fmt(stats.lastFail, { weekday: 'short', day: 'numeric', month: 'long' })}` : `Depuis le début, le ${fmt(habit.startDate, { day: 'numeric', month: 'long' })}`}</p></div>
        ) : null}
        <div><p className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>Série en cours</p><p className={`text-3xl font-black flex items-center gap-1.5 ${ink}`}><Flame size={22} style={{ color }} />{stats.current} j</p></div>
        <div><p className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>Record</p><p className={`text-3xl font-black ${ink}`}>{stats.best} j</p></div>
        <div><p className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>Réussite</p><p className={`text-3xl font-black ${ink}`}>{stats.rate === null ? '—' : `${stats.rate} %`}</p></div>
      </div>

      {/* Onglets */}
      <div className="flex p-1 bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 rounded-2xl">
        {([['calendar', 'Calendrier', CalendarDays], ['stats', 'Statistiques', BarChart3], ['notes', 'Notes', StickyNote], ['edit', 'Réglages', Settings2]] as const).map(([k, t, Icon]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${tab === k ? 'bg-accent text-white shadow-lg shadow-accent/20' : muted}`}>
            <Icon size={13} /><span className="hidden sm:inline">{t}</span>
          </button>
        ))}
      </div>

      {tab === 'calendar' && (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1, 12))} aria-label="Mois précédent" className={`p-2 rounded-xl hover:bg-accent/10 hover:text-accent ${muted}`}><ChevronLeft size={18} /></button>
            <div className="flex-1 text-center">
              <p className={`text-sm font-black ${ink}`}>{cap(month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }))}</p>
              <p className={`text-[10px] font-bold ${muted}`}>{monthStats.done} {L.done.toLowerCase()} · {monthStats.fail} {L.fail.toLowerCase()}{monthStats.rate !== null ? ` · ${monthStats.rate} % de réussite` : ''}</p>
            </div>
            <button onClick={() => canNext && setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1, 12))} disabled={!canNext} aria-label="Mois suivant" className={`p-2 rounded-xl ${canNext ? `hover:bg-accent/10 hover:text-accent ${muted}` : 'opacity-20'}`}><ChevronRight size={18} /></button>
          </div>
          <div className="grid grid-cols-7 gap-y-2 justify-items-center">
            {DOW.map((d, i) => <span key={i} className={`text-[10px] font-black ${faint}`}>{d}</span>)}
            {cells.map((k, i) => k === null ? <span key={`e${i}`} /> : (
              <div key={k} className={`p-0.5 rounded-full ${selected === k ? 'ring-2 ring-accent' : ''}`}>
                <DayDot numberOnly state={stateOn(habit, k, tk)} color={color} size={36} label={String(noon(k).getDate())} hasNote={!isEmptyNote(habit.entries?.[k]?.note)} today={k === tk}
                  onClick={() => { setSelected(k); setNoteDraft({ k, v: habit.entries?.[k]?.note || '' }); }} />
              </div>
            ))}
          </div>
          <div className={`flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold ${muted}`}>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />{L.done}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ boxShadow: `inset 0 0 0 2px ${RED}` }} />{L.fail}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#18181B]/10 dark:bg-[#E6E8E6]/10" />Ignoré</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ boxShadow: `inset 0 0 0 2px ${color}66` }} />À noter</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#FDCA40]" />Note</span>
          </div>

          {/* Jour sélectionné */}
          {selected >= habit.startDate && selected <= tk ? (
            <div className="rounded-2xl border border-[#18181B]/10 dark:border-[#E6E8E6]/10 p-4 space-y-3">
              <p className={`text-xs font-black ${ink}`}>{cap(fmt(selected, { weekday: 'long', day: 'numeric', month: 'long' }))}{!isScheduled(habit, selected) && <span className={`ml-2 text-[10px] font-bold ${muted}`}>(jour non prévu)</span>}</p>
              <div className="grid grid-cols-3 gap-2">
                {([['done', L.done, Check], ['fail', L.fail, X], ['skip', 'Ignorer', Minus]] as const).map(([s, t, Icon]) => {
                  const on = entry.s === s;
                  const st: React.CSSProperties = on ? (s === 'done' ? { backgroundColor: color, color: '#fff', borderColor: color } : s === 'fail' ? { backgroundColor: `${RED}1A`, color: RED, borderColor: RED } : {}) : {};
                  return <button key={s} onClick={() => setEntry(selected, { s: on ? null : s })} style={st}
                    className={`flex items-center justify-center gap-1.5 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${on ? (s === 'skip' ? `bg-[#18181B]/10 dark:bg-[#E6E8E6]/10 border-transparent ${ink}` : '') : `border-[#18181B]/10 dark:border-[#E6E8E6]/10 ${ink} hover:border-accent/50`}`}><Icon size={13} strokeWidth={3} />{t}</button>;
                })}
              </div>
              <div className="space-y-1.5">
                <label className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>Note du jour</label>
                <RichText
                  key={selected}
                  minHeight={110}
                  value={note}
                  onChange={(html) => setNoteDraft({ k: selected, v: html })}
                  onBlur={() => { if (note !== (entry.note || '')) setEntry(selected, { note }); }}
                  placeholder={habit.kind === 'quit' ? 'Envie forte ? Déclencheur ? Comment tu as tenu…' : 'Comment ça s’est passé…'}
                />
                {note !== (entry.note || '') && <button onClick={() => setEntry(selected, { note })} className="px-4 py-2 rounded-xl bg-accent text-white text-[9px] font-black uppercase tracking-wider">Enregistrer la note</button>}
              </div>
            </div>
          ) : <p className={`text-[11px] font-medium ${muted}`}>{selected > tk ? 'Ce jour n’est pas encore arrivé.' : 'Avant le début de l’habitude.'}</p>}
        </div>
      )}

      {tab === 'stats' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {tile('Série en cours', `${stats.current} j`, undefined, <Flame size={11} />)}
            {tile('Meilleure série', `${stats.best} j`, undefined, <Trophy size={11} />)}
            {tile('Taux de réussite', stats.rate === null ? '—' : `${stats.rate} %`, 'depuis le début', <Target size={11} />)}
            {tile(`Total ${L.done.toLowerCase()}`, stats.done, `${stats.fail} ${L.fail.toLowerCase()} · ${stats.skip} ignoré${stats.skip > 1 ? 's' : ''}`, <Check size={11} />)}
          </div>
          <div>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${muted}`}>Réussite par mois (6 derniers mois)</p>
            <div className="h-48 -ml-2">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={rates.map(r => ({ ...r, value: r.rate === 0 ? 1.5 : r.rate }))} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.08} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: 'currentColor', opacity: 0.55 }} />
                  <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={v => `${v}%`} width={40} tickLine={false} axisLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: 'currentColor', opacity: 0.45 }} />
                  <Tooltip cursor={{ fill: 'currentColor', fillOpacity: 0.05 }} content={({ active, payload }) => {
                    if (!active || !payload?.length) return null; const r = payload[0].payload as typeof rates[number];
                    return <div className="bg-white dark:bg-[#141414] border border-[#18181B]/10 dark:border-[#E6E8E6]/10 px-3 py-2 rounded-xl shadow-xl">
                      <p className={`text-[10px] font-black uppercase ${muted}`}>{cap(fmt(r.key + '-01', { month: 'long', year: 'numeric' }))}</p>
                      <p className={`text-sm font-black ${ink}`}>{r.rate === null ? 'Pas de données' : `${r.rate} %`}</p>
                      {r.total > 0 && <p className={`text-[11px] font-bold ${muted}`}>{r.done} jour{r.done > 1 ? 's' : ''} {L.done.toLowerCase()} sur {r.total}</p>}
                    </div>;
                  }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                    {rates.map(r => <Cell key={r.key} fill={r.rate === 0 ? RED : color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* Réussite par jour de la semaine */}
          <div>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${muted}`}>Selon le jour de la semaine</p>
            <div className="grid grid-cols-7 gap-2">
              {DOW_IDX.map((d, i) => {
                let dn = 0, tot = 0;
                Object.keys(habit.entries || {}).forEach(k => { if (noon(k).getDay() !== d) return; const s = habit.entries[k].s; if (s === 'done') { dn++; tot++; } else if (s === 'fail') tot++; });
                const r = tot ? Math.round((dn / tot) * 100) : null;
                return (
                  <div key={d} className="text-center space-y-1">
                    <div className="h-20 rounded-lg bg-[#18181B]/[0.04] dark:bg-[#E6E8E6]/[0.04] flex items-end overflow-hidden">
                      <div className="w-full rounded-t-md" style={{ height: `${r ?? 0}%`, backgroundColor: color }} />
                    </div>
                    <p className={`text-[10px] font-black ${ink}`}>{r === null ? '—' : `${r}%`}</p>
                    <p className={`text-[9px] font-bold ${faint}`}>{DOW[i]}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'notes' && (
        stats.notes.length === 0 ? <p className={`text-xs font-medium py-6 text-center ${muted}`}>Aucune note pour l'instant. Ajoute-en depuis le calendrier, en touchant un jour.</p> : (
          <div className="space-y-3">
            {stats.notes.map(n => (
              <div key={n.date} className="rounded-2xl border border-[#18181B]/5 dark:border-[#E6E8E6]/5 bg-[#18181B]/[0.03] dark:bg-[#E6E8E6]/[0.03] p-4">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <button onClick={() => { setSelected(n.date); setMonth(new Date(noon(n.date).getFullYear(), noon(n.date).getMonth(), 1, 12)); setNoteDraft({ k: n.date, v: n.note }); setTab('calendar'); }} className={`text-[11px] font-black hover:text-accent ${ink}`}>{cap(fmt(n.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</button>
                  {n.s && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full" style={n.s === 'done' ? { backgroundColor: `${color}22`, color } : n.s === 'fail' ? { backgroundColor: `${RED}1A`, color: RED } : {}}>{n.s === 'done' ? L.done : n.s === 'fail' ? L.fail : 'Ignoré'}</span>}
                </div>
                <RichTextView html={n.note} className={`text-xs font-medium ${ink}`} />
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'edit' && (
        <div className="space-y-6">
          <HabitForm initial={habit} accentHex={accentHex} onSave={(h) => { onUpdate(h); setTab('calendar'); }} onCancel={() => setTab('calendar')} />
          <div className="flex flex-wrap gap-3 pt-4 border-t border-[#18181B]/5 dark:border-[#E6E8E6]/5">
            <button onClick={() => { onUpdate({ ...habit, archived: !habit.archived }); onBack(); }} className={`flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[10px] font-black uppercase tracking-wider ${ink} hover:text-accent`}><Archive size={14} /> {habit.archived ? 'Réactiver' : 'Archiver'}</button>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#DF2935]/5 border border-[#DF2935]/15 text-[10px] font-black uppercase tracking-wider text-[#DF2935]"><Trash2 size={14} /> Supprimer</button>
            ) : (
              <span className="flex items-center gap-2">
                <span className={`text-[11px] font-bold ${ink}`}>Supprimer l'habitude et tout son historique ?</span>
                <button onClick={() => { onUpdate({ ...habit, deleted: true }); onBack(); }} className="px-4 py-2.5 rounded-xl bg-[#DF2935] text-white text-[10px] font-black uppercase">Oui, supprimer</button>
                <button onClick={() => setConfirmDelete(false)} className={`px-3 py-2.5 text-[10px] font-black uppercase ${muted}`}>Non</button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- Liste ----------
const HabitsView: React.FC<Props> = ({ habits, onChange, accentHex }) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const tk = getKeyFromDate(new Date());
  const list = activeHabits(habits);
  const archived = (habits || []).filter(h => h.archived && !h.deleted);

  const upsert = (h: StandaloneHabit) => {
    const exists = habits.some(x => x.id === h.id);
    onChange(exists ? habits.map(x => x.id === h.id ? h : x) : [...habits, h]);
  };
  const cycle = (h: StandaloneHabit, k: string) => {
    const cur = h.entries?.[k] || {};
    const s = nextStatus(cur.s);
    const next = { ...cur }; if (s) next.s = s; else delete next.s;
    const entries = { ...(h.entries || {}) };
    if (!next.s && !next.note) delete entries[k]; else entries[k] = next;
    upsert({ ...h, entries });
  };

  // Semaine affichée (lundi → dimanche)
  const monday = new Date(); monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + weekOffset * 7);
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return getKeyFromDate(d); });

  const current = openId ? (habits || []).find(h => h.id === openId) : null;
  if (current) return <div className="pb-20"><div className="glass rounded-[2rem] p-5 sm:p-7"><HabitDetail habit={current} accentHex={accentHex} onUpdate={upsert} onBack={() => setOpenId(null)} /></div></div>;

  const doneToday = list.filter(h => isScheduled(h, tk) && h.entries?.[tk]?.s === 'done').length;
  const dueToday = list.filter(h => isScheduled(h, tk)).length;

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-20">
      <div className="px-2 flex items-end justify-between gap-3">
        <div>
          <h1 className={`text-2xl font-black ${ink}`}>Habitudes</h1>
          <p className={`text-xs font-bold mt-1 ${muted}`}>{dueToday ? `${doneToday} / ${dueToday} réussie${doneToday > 1 ? 's' : ''} aujourd'hui` : 'Ce que tu veux construire… ou arrêter.'}</p>
        </div>
        {!creating && <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-accent text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-accent/20 active:scale-95 transition-all"><Plus size={16} /> Nouvelle habitude</button>}
      </div>

      {creating && (
        <div className="glass rounded-[2rem] p-5 sm:p-7 space-y-4 animate-in slide-in-from-top-2">
          <h2 className={`font-black uppercase tracking-wider text-sm ${ink}`}>Nouvelle habitude</h2>
          <HabitForm accentHex={accentHex} onSave={(h) => { upsert(h); setCreating(false); }} onCancel={() => setCreating(false)} />
        </div>
      )}

      {list.length === 0 && !creating ? (
        <div className="glass rounded-[2rem] p-10 text-center space-y-4 border-2 border-dashed border-[#18181B]/10 dark:border-[#E6E8E6]/10">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto"><Repeat className="text-accent" size={24} /></div>
          <div>
            <p className={`text-sm font-black ${ink}`}>Aucune habitude pour l'instant</p>
            <p className={`text-xs font-medium mt-1 ${muted}`}>Suis une habitude hors de tes blocs : « Ne plus fumer », « Boire 2 L d'eau »…</p>
          </div>
          <button onClick={() => setCreating(true)} className="px-5 py-3 rounded-2xl bg-accent text-white text-[10px] font-black uppercase tracking-wider">Créer ma première habitude</button>
        </div>
      ) : list.length > 0 && (
        <div className="glass rounded-[2rem] p-4 sm:p-6 space-y-4">
          {/* En-tête semaine */}
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekOffset(w => w - 1)} aria-label="Semaine précédente" className={`p-1.5 rounded-lg hover:text-accent ${muted}`}><ChevronLeft size={16} /></button>
            <p className={`flex-1 text-center text-[11px] font-black ${ink}`}>{weekOffset === 0 ? 'Cette semaine' : `Semaine du ${fmt(week[0], { day: 'numeric', month: 'short' })}`}</p>
            <button onClick={() => weekOffset < 0 && setWeekOffset(w => w + 1)} disabled={weekOffset >= 0} aria-label="Semaine suivante" className={`p-1.5 rounded-lg ${weekOffset < 0 ? `hover:text-accent ${muted}` : 'opacity-20'}`}><ChevronRight size={16} /></button>
          </div>
          <div className="divide-y divide-[#18181B]/5 dark:divide-[#E6E8E6]/5">
            {list.map(h => {
              const color = h.color || accentHex;
              const s = habitStats(h);
              return (
                <div key={h.id} className="py-4 first:pt-1 last:pb-1 flex flex-col lg:flex-row lg:items-center gap-3">
                  <button onClick={() => setOpenId(h.id)} className="flex-1 min-w-0 flex items-center gap-3 text-left group">
                    <span className="w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${color}1F`, color }}>{h.kind === 'quit' ? <Ban size={18} /> : <Repeat size={18} />}</span>
                    <span className="min-w-0">
                      <span className={`block text-sm font-bold truncate group-hover:text-accent ${ink}`}>{h.name}</span>
                      <span className={`flex flex-wrap items-center gap-x-2 text-[10px] font-bold ${muted}`}>
                        <span className="flex items-center gap-0.5"><Flame size={11} style={{ color }} />{s.current} j</span>
                        {h.kind === 'quit' && <span>· {s.sinceLastFail} j sans rechute</span>}
                        <span>· {s.rate === null ? '—' : `${s.rate} %`}</span>
                        <span className={faint}>· {freqLabel(h)}</span>
                        {h.showInRoutine === false && <span className={`flex items-center gap-0.5 ${faint}`} title="Masquée de l'onglet Routine">· <EyeOff size={10} /> hors Routine</span>}
                      </span>
                    </span>
                  </button>
                  <div className="flex items-center justify-between lg:justify-end gap-1.5 sm:gap-2">
                    {week.map((k, i) => (
                      <div key={k} className="flex flex-col items-center gap-1">
                        <span className={`text-[9px] font-black ${k === tk ? 'text-accent' : faint}`}>{DOW[i]}</span>
                        <DayDot state={stateOn(h, k, tk)} color={color} size={32} label={stateOn(h, k, tk) === 'open' || stateOn(h, k, tk) === 'off' || stateOn(h, k, tk) === 'future' ? String(noon(k).getDate()) : undefined}
                          hasNote={!isEmptyNote(h.entries?.[k]?.note)} today={k === tk} onClick={() => cycle(h, k)} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p className={`text-[10px] font-medium ${faint}`}>Touche un jour pour le noter : réussi → échec → ignoré → effacer. Touche le nom pour voir le calendrier, les statistiques et les notes.</p>
        </div>
      )}

      {archived.length > 0 && (
        <div className="px-1">
          <button onClick={() => setShowArchived(v => !v)} className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest hover:text-accent ${muted}`}>{showArchived ? <ChevronLeft size={12} className="-rotate-90" /> : <ChevronRight size={12} />} Archivées ({archived.length})</button>
          {showArchived && (
            <div className="mt-2 space-y-2">
              {archived.map(h => (
                <button key={h.id} onClick={() => setOpenId(h.id)} className={`w-full text-left glass px-4 py-3 rounded-2xl text-sm font-bold opacity-70 hover:opacity-100 ${ink}`}>{h.name}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HabitsView;
