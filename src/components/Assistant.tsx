import React, { useEffect, useRef, useState } from 'react';
import { X, Send, Mic, MicOff, Sparkles, Loader2, Undo2, Volume2, VolumeX, Trash2, Check, AlertCircle, LogIn, Brain, Plus } from 'lucide-react';
import { generateId } from '../utils';
import type { AppData, TabType } from '../types';
import { callAssistant, ApiMessage, ApiBlock } from '../services/assistantService';
import { executeTool, buildContext, ToolCtx } from '../assistant/tools';
import type { Occurrence } from '../icsImport';

interface Props {
  open: boolean;
  onClose: () => void;
  getData: () => AppData;                    // état le plus récent
  commit: (data: AppData) => void;           // applique les changements (avec historique pour annuler)
  undo: () => void;
  navigate: (tab: TabType) => void;
  externalEvents?: (from: Date, to: Date) => Occurrence[];
  signedIn: boolean;
  onSignIn: () => void;
  userName?: string;
  initialPrompt?: string | null;            // demande envoyée automatiquement à l'ouverture
  onInitialConsumed?: () => void;
}

interface UiMsg { id: string; role: 'user' | 'assistant'; text: string; actions?: string[]; undoable?: boolean; undone?: boolean; error?: boolean }

const STORE = 'caddr_assistant_v1';
const MAX_STEPS = 8;
const ink = 'text-[#18181B] dark:text-[#E6E8E6]';
const muted = 'text-[#18181B]/55 dark:text-[#E6E8E6]/55';
const uid = () => Math.random().toString(36).slice(2, 10);

const TOOL_LABEL: Record<string, string> = {
  create_task: 'Ajout de la tâche', update_task: 'Modification', reschedule_task: 'Déplacement', set_task_done: 'Validation',
  skip_task: 'Tâche sautée', remove_task: 'Retrait', create_habit: "Création de l'habitude", log_habit: 'Suivi de l’habitude',
  add_to_inbox: 'Ajout à la Boîte', set_objective: 'Objectif', create_goal: 'Objectif long terme', create_block: 'Nouveau bloc',
  write_journal: 'Journal', get_day: 'Lecture du planning', search: 'Recherche', get_stats: 'Lecture des statistiques', open_tab: 'Ouverture',
};

const SUGGESTIONS = [
  'Planifie ma journée de demain',
  'Ajoute « Sport 30 min » chaque jour de semaine à 6h30',
  'Comment s’est passée ma semaine ?',
  'Crée l’habitude « Ne plus fumer »',
  'Ma soirée est trop chargée, allège-la',
  'Aide-moi à découper un objectif en étapes',
];

// Petit rendu : **gras**, listes « - » et retours à la ligne (sans HTML)
const Rich: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split('\n').map((line, i) => {
      const bullet = /^\s*[-•*]\s+/.test(line);
      const parts = line.replace(/^\s*[-•*]\s+/, '').split(/(\*\*[^*]+\*\*)/g).map((p, j) => p.startsWith('**') && p.endsWith('**') ? <strong key={j}>{p.slice(2, -2)}</strong> : <React.Fragment key={j}>{p.replace(/^#+\s*/, '')}</React.Fragment>);
      if (!line.trim()) return <div key={i} className="h-2" />;
      return bullet ? <div key={i} className="flex gap-2 pl-1"><span className="text-accent">•</span><span>{parts}</span></div> : <p key={i}>{parts}</p>;
    })}
  </>
);

// Garde une conversation valide (pas de résultat d'outil orphelin) et raisonnable en taille
function trimHistory(msgs: ApiMessage[], max = 30): ApiMessage[] {
  if (msgs.length <= max) return msgs;
  let i = msgs.length - max;
  while (i < msgs.length && !(msgs[i].role === 'user' && typeof msgs[i].content === 'string')) i++;
  return msgs.slice(i);
}

type SR = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: (e: any) => void; onend: () => void; onerror: (e: any) => void };

const Assistant: React.FC<Props> = ({ open, onClose, getData, commit, undo, navigate, externalEvents, signedIn, onSignIn, userName, initialPrompt, onInitialConsumed }) => {
  const [msgs, setMsgs] = useState<UiMsg[]>(() => { try { return JSON.parse(localStorage.getItem(STORE) || '{}').ui || []; } catch { return []; } });
  const api = useRef<ApiMessage[]>((() => { try { return JSON.parse(localStorage.getItem(STORE) || '{}').api || []; } catch { return []; } })());
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(() => { try { return localStorage.getItem('caddr_assistant_tts') === '1'; } catch { return false; } });
  const rec = useRef<SR | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const persist = (ui: UiMsg[]) => { try { localStorage.setItem(STORE, JSON.stringify({ ui: ui.slice(-60), api: trimHistory(api.current) })); } catch { /* stockage plein */ } };
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, busy, open]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 150); }, [open]);
  useEffect(() => { if (!open) { rec.current?.stop(); try { window.speechSynthesis?.cancel(); } catch { /* rien */ } } }, [open]);

  const SpeechRec: (new () => SR) | undefined = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : undefined;

  const say = (text: string) => {
    if (!speak || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/\*\*/g, ''));
      u.lang = 'fr-FR';
      const v = window.speechSynthesis.getVoices().find(v => v.lang?.startsWith('fr'));
      if (v) u.voice = v;
      window.speechSynthesis.speak(u);
    } catch { /* non supporté */ }
  };

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    setInput('');
    const userMsg: UiMsg = { id: uid(), role: 'user', text };
    let ui = [...msgs, userMsg];
    setMsgs(ui);
    api.current = trimHistory([...api.current, { role: 'user', content: text }]);
    setBusy('Réflexion…');

    const ctx: ToolCtx = { now: new Date(), navigate, externalEvents };
    let working = getData();
    let changed = false;
    const actions: string[] = [];
    let reply = '';
    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        ctx.now = new Date();
        const res = await callAssistant(api.current, buildContext(working, ctx, userName));
        api.current = [...api.current, { role: 'assistant', content: res.content }];
        const t = res.content.filter((b): b is Extract<ApiBlock, { type: 'text' }> => b.type === 'text').map(b => b.text).join('\n').trim();
        if (t) reply = reply ? `${reply}\n\n${t}` : t;
        const calls = res.content.filter((b): b is Extract<ApiBlock, { type: 'tool_use' }> => b.type === 'tool_use');
        if (res.stop_reason !== 'tool_use' || !calls.length) break;
        const results: ApiBlock[] = [];
        for (const c of calls) {
          setBusy(`${TOOL_LABEL[c.name] || 'Action'}…`);
          try {
            const out = executeTool(working, c.name, c.input as Record<string, any>, ctx);
            working = out.data;
            if (out.changed) { changed = true; if (out.summary) actions.push(out.summary); }
            results.push({ type: 'tool_result', tool_use_id: c.id, content: JSON.stringify(out.result).slice(0, 12000), is_error: !!(out.result as any)?.error || undefined });
          } catch (e) {
            results.push({ type: 'tool_result', tool_use_id: c.id, content: JSON.stringify({ error: (e as Error).message }), is_error: true });
          }
        }
        api.current = [...api.current, { role: 'user', content: results }];
        setBusy('Réflexion…');
      }
      if (changed) commit(working);
      const msg: UiMsg = { id: uid(), role: 'assistant', text: reply || (actions.length ? 'C’est fait.' : '…'), actions: actions.length ? actions : undefined, undoable: changed };
      ui = [...ui, msg];
      say(msg.text);
    } catch (e) {
      // Échec : on retire le dernier message utilisateur de l'historique API pour garder une conversation valide
      const lastUser = api.current.map(m => m.role === 'user' && typeof m.content === 'string').lastIndexOf(true);
      if (lastUser >= 0) api.current = api.current.slice(0, lastUser);
      if (changed) commit(working);
      ui = [...ui, { id: uid(), role: 'assistant', text: (e as Error).message, error: true, actions: actions.length ? actions : undefined, undoable: changed }];
    } finally {
      setBusy(null);
      setMsgs(ui);
      persist(ui);
    }
  };

  // Demande préremplie (briefing, bilan du soir, plan d'action…) : envoyée une seule fois
  const sentInitial = useRef<string | null>(null);
  useEffect(() => {
    if (open && initialPrompt && signedIn && !busy && sentInitial.current !== initialPrompt) {
      sentInitial.current = initialPrompt;
      onInitialConsumed?.();
      send(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPrompt, signedIn]);

  // Mémoire de l'assistant (préférences durables), visible et modifiable
  const [showMemory, setShowMemory] = useState(false);
  const [memDraft, setMemDraft] = useState('');
  const [, force] = useState(0);
  const memory = (getData().assistantMemory || []).filter(m => !m.deleted);
  const addMemory = () => {
    const t = memDraft.trim(); if (!t) return;
    const d = getData();
    commit({ ...d, assistantMemory: [...(d.assistantMemory || []), { id: generateId(), text: t.slice(0, 200), createdAt: new Date().toISOString() }] });
    setMemDraft(''); setTimeout(() => force(x => x + 1), 50);
  };
  const delMemory = (id: string) => { const d = getData(); commit({ ...d, assistantMemory: (d.assistantMemory || []).map(m => m.id === id ? { ...m, deleted: true } : m) }); setTimeout(() => force(x => x + 1), 50); };

  const toggleMic = () => {
    if (!SpeechRec) return;
    if (listening) { rec.current?.stop(); return; }
    const r = new SpeechRec();
    r.lang = 'fr-FR'; r.interimResults = true; r.continuous = false;
    const base = input ? input.trim() + ' ' : '';
    let finalText = '';
    r.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const tr = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += tr; else interim += tr;
      }
      setInput(base + finalText + interim);
    };
    r.onend = () => { setListening(false); if (finalText.trim()) send(base + finalText); };
    r.onerror = () => setListening(false);
    rec.current = r;
    try { r.start(); setListening(true); } catch { setListening(false); }
  };

  const clear = () => { api.current = []; setMsgs([]); persist([]); };
  const doUndo = (id: string) => { undo(); const ui = msgs.map(m => m.id === id ? { ...m, undone: true, undoable: false } : m); setMsgs(ui); persist(ui); };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[160] flex justify-end" role="dialog" aria-label="Cady, ton assistante">
      <div className="absolute inset-0 bg-black/40 md:bg-black/20" onClick={onClose} />
      <div className="relative w-full md:w-[440px] h-full flex flex-col bg-[#F4F4F5] dark:bg-[#0c0c0d] border-l border-[#18181B]/10 dark:border-[#E6E8E6]/10 shadow-2xl animate-in slide-in-from-right-8 duration-300"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {/* En-tête */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#18181B]/5 dark:border-[#E6E8E6]/5">
          <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center"><Sparkles size={18} className="text-accent" /></div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-black ${ink}`}>Cady</p>
            <p className={`text-[10px] font-semibold ${muted}`}>Propulsée par Claude</p>
          </div>
          <button onClick={() => setShowMemory(v => !v)} aria-label="Mémoire de Cady" title="Ce que Cady retient" className={`relative p-2 rounded-lg hover:text-accent ${showMemory ? 'text-accent' : muted}`}><Brain size={16} />{memory.length > 0 && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent" />}</button>
          {'speechSynthesis' in window && <button onClick={() => { const v = !speak; setSpeak(v); try { localStorage.setItem('caddr_assistant_tts', v ? '1' : '0'); if (!v) window.speechSynthesis.cancel(); } catch { /* rien */ } }} aria-label={speak ? 'Ne plus lire les réponses' : 'Lire les réponses à voix haute'} title={speak ? 'Lecture à voix haute activée' : 'Lire les réponses à voix haute'} className={`p-2 rounded-lg hover:text-accent ${speak ? 'text-accent' : muted}`}>{speak ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>}
          {msgs.length > 0 && <button onClick={clear} aria-label="Nouvelle discussion" title="Nouvelle discussion" className={`p-2 rounded-lg hover:text-accent ${muted}`}><Trash2 size={16} /></button>}
          <button onClick={onClose} aria-label="Fermer Cady" className={`p-2 rounded-lg hover:text-accent ${muted}`}><X size={18} /></button>
        </div>

        {showMemory && (
          <div className="px-4 py-3 border-b border-[#18181B]/5 dark:border-[#E6E8E6]/5 space-y-2 bg-accent/[0.04] max-h-[45%] overflow-y-auto custom-scrollbar">
            <p className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 text-accent`}><Brain size={12} /> Ce que Cady retient</p>
            <p className={`text-[11px] font-medium ${muted}`}>Tes préférences durables, respectées dans toutes ses propositions. Dis « retiens que… » ou ajoute-les ici.</p>
            {memory.length === 0 && <p className={`text-[11px] font-semibold ${muted}`}>Rien pour l'instant.</p>}
            {memory.map(m => (
              <div key={m.id} className="flex items-start gap-2 rounded-xl bg-white dark:bg-[#18181B] px-3 py-2">
                <p className={`flex-1 text-[12px] font-semibold ${ink}`}>{m.text}</p>
                <button onClick={() => delMemory(m.id)} aria-label={`Oublier : ${m.text}`} className={`p-0.5 hover:text-[#DF2935] ${muted}`}><X size={14} /></button>
              </div>
            ))}
            <div className="flex gap-2">
              <input value={memDraft} onChange={e => setMemDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && addMemory()} placeholder="Ex. Pas de travail après 21 h" aria-label="Nouvelle préférence" className={`flex-1 bg-white dark:bg-[#18181B] rounded-xl px-3 py-2 text-[12px] font-semibold outline-none border border-[#18181B]/10 dark:border-[#E6E8E6]/10 focus:border-accent ${ink}`} />
              <button onClick={addMemory} disabled={!memDraft.trim()} aria-label="Ajouter" className="px-3 rounded-xl bg-accent text-white disabled:opacity-40"><Plus size={14} /></button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-3">
          {msgs.length === 0 && (
            <div className="space-y-4 pt-4">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-accent/15 flex items-center justify-center"><Sparkles size={26} className="text-accent" /></div>
                <p className={`text-base font-black ${ink}`}>Bonjour{userName ? ` ${userName}` : ''} 👋 Je suis Cady.</p>
                <p className={`text-xs font-semibold ${muted} max-w-xs mx-auto`}>Écris ou parle naturellement. Je peux ajouter, déplacer, cocher ou sauter des tâches, créer des habitudes, fixer tes objectifs et analyser ta discipline.</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTIONS.map(s => <button key={s} onClick={() => send(s)} disabled={!signedIn} className={`px-3 py-2 rounded-xl text-[12px] font-semibold text-left bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 border border-[#18181B]/5 dark:border-[#E6E8E6]/5 hover:border-accent/40 disabled:opacity-40 ${ink}`}>{s}</button>)}
              </div>
            </div>
          )}
          {msgs.map(m => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed space-y-1 ${m.role === 'user' ? 'bg-accent text-white rounded-br-md' : m.error ? 'bg-[#DF2935]/10 text-[#DF2935] border border-[#DF2935]/20 rounded-bl-md' : `bg-white dark:bg-[#18181B] border border-[#18181B]/5 dark:border-[#E6E8E6]/5 rounded-bl-md ${ink}`}`}>
                {m.error && <AlertCircle size={14} className="inline mr-1 -mt-0.5" />}
                {m.role === 'assistant' ? <Rich text={m.text} /> : <p className="whitespace-pre-wrap">{m.text}</p>}
                {m.actions && (
                  <div className="pt-2 space-y-1">
                    {m.actions.map((a, i) => <p key={i} className={`flex items-start gap-1.5 text-[11px] font-bold ${m.undone ? 'line-through opacity-50' : 'text-[#199e70]'}`}><Check size={12} className="shrink-0 mt-0.5" />{a}</p>)}
                    {m.undoable && <button onClick={() => doUndo(m.id)} className={`mt-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider hover:text-accent ${muted}`}><Undo2 size={12} /> Annuler ces changements</button>}
                    {m.undone && <p className={`text-[10px] font-bold ${muted}`}>Changements annulés</p>}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && <div className="flex justify-start"><div className={`flex items-center gap-2 rounded-2xl rounded-bl-md px-3.5 py-2.5 text-[12px] font-bold bg-white dark:bg-[#18181B] border border-[#18181B]/5 dark:border-[#E6E8E6]/5 ${muted}`}><Loader2 size={14} className="animate-spin text-accent" />{busy}</div></div>}
          <div ref={endRef} />
        </div>

        {/* Saisie */}
        {signedIn ? (
          <div className="p-3 border-t border-[#18181B]/5 dark:border-[#E6E8E6]/5">
            <div className="flex items-end gap-2 rounded-2xl bg-white dark:bg-[#18181B] border border-[#18181B]/10 dark:border-[#E6E8E6]/10 focus-within:border-accent px-2 py-1.5">
              <textarea ref={inputRef} rows={1} value={input} disabled={!!busy}
                onChange={e => { setInput(e.target.value); e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = Math.min(140, e.currentTarget.scrollHeight) + 'px'; }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={listening ? "Je t’écoute…" : "Écris ou dicte ta demande…"}
                className={`flex-1 bg-transparent resize-none outline-none text-sm font-medium py-2 px-1 max-h-[140px] ${ink} placeholder:text-[#18181B]/35 dark:placeholder:text-[#E6E8E6]/35`} aria-label="Message pour Cady" />
              {SpeechRec && <button onClick={toggleMic} disabled={!!busy} aria-label={listening ? 'Arrêter la dictée' : 'Parler'} title={listening ? 'Arrêter' : 'Parler'} className={`p-2.5 rounded-xl transition-all ${listening ? 'bg-[#DF2935] text-white animate-pulse' : `hover:text-accent ${muted}`}`}>{listening ? <MicOff size={18} /> : <Mic size={18} />}</button>}
              <button onClick={() => send()} disabled={!input.trim() || !!busy} aria-label="Envoyer" className="p-2.5 rounded-xl bg-accent text-white disabled:opacity-30 transition-all"><Send size={18} /></button>
            </div>
            <p className={`text-[9px] font-medium text-center mt-1.5 ${muted}`}>Cady peut se tromper : chaque série de changements peut être annulée.</p>
          </div>
        ) : (
          <div className="p-4 border-t border-[#18181B]/5 dark:border-[#E6E8E6]/5 space-y-2 text-center">
            <p className={`text-xs font-semibold ${muted}`}>L'assistant est réservé aux comptes connectés (tes données restent privées).</p>
            <button onClick={onSignIn} className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-accent text-white text-[11px] font-black uppercase tracking-wider"><LogIn size={14} /> Se connecter</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Assistant;
