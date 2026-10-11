import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Share2, Download, Copy, Check, Loader2, Square, RectangleVertical } from 'lucide-react';
import type { AppData } from '../types';
import { computeShareMetrics, defaultSelection, drawShareCard, canvasToBlob, shareText, PERIOD_LABEL, type SharePeriod, type MetricId, type ShareFormat } from '../shareCard';

interface Props { appData: AppData; initialPeriod?: SharePeriod; name?: string; onClose: () => void; notify: (m: string) => void }

const ink = 'text-[#18181B] dark:text-[#E6E8E6]';
const muted = 'text-[#18181B]/60 dark:text-[#E6E8E6]/55';
const KEY = 'caddr_share_prefs';
const readPrefs = (): { sel?: MetricId[]; format?: ShareFormat; showName?: boolean } => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };

// Partage des performances : l'utilisateur choisit la période et les chiffres, l'image est créée sur l'appareil
const ShareSheet: React.FC<Props> = ({ appData, initialPeriod = 'week', name, onClose, notify }) => {
  const prefs = useMemo(readPrefs, []);
  const [period, setPeriod] = useState<SharePeriod>(initialPeriod);
  const { metrics, periodLabel } = useMemo(() => computeShareMetrics(appData, period), [appData, period]);
  const [sel, setSel] = useState<MetricId[]>(() => (prefs.sel?.length ? prefs.sel : defaultSelection(computeShareMetrics(appData, initialPeriod).metrics)));
  const [format, setFormat] = useState<ShareFormat>(prefs.format || 'square');
  const [showName, setShowName] = useState(prefs.showName ?? true);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const chosen = useMemo(() => sel.map(id => metrics.find(m => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m && m.available), [sel, metrics]);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify({ sel, format, showName })); } catch { /* rien */ } }, [sel, format, showName]);

  // Aperçu en direct (léger délai pendant la saisie du message)
  useEffect(() => {
    let stop = false;
    const t = setTimeout(async () => {
      const cv = await drawShareCard({ metrics: chosen, periodTitle: PERIOD_LABEL[period], periodLabel, name: showName ? name : undefined, message, format });
      if (stop) return; canvasRef.current = cv; setPreview(cv.toDataURL('image/png'));
    }, 180);
    return () => { stop = true; clearTimeout(t); };
  }, [chosen, period, periodLabel, showName, name, message, format]);

  const toggle = (id: MetricId) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : s.length >= 6 ? s : [...s, id]);
  const text = shareText(chosen, PERIOD_LABEL[period]);
  const fileName = `caddr-${period}-${new Date().toISOString().slice(0, 10)}.png`;

  const download = async () => { if (!canvasRef.current) return; const blob = await canvasToBlob(canvasRef.current); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  const share = async () => {
    if (!canvasRef.current || !chosen.length) return;
    setBusy(true);
    try {
      const blob = await canvasToBlob(canvasRef.current);
      const file = new File([blob], fileName, { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) { await nav.share({ files: [file], text, title: 'Mes performances Caddr.' }); }
      else { await download(); notify("Image téléchargée : ajoute-la à ta publication sur le réseau de ton choix."); }
    } catch (e) { if ((e as Error)?.name !== 'AbortError') notify("Le partage n'a pas abouti. Tu peux télécharger l'image."); }
    finally { setBusy(false); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* rien */ } };
  const enc = encodeURIComponent;
  const site = 'https://caddr-v2.netlify.app';
  const links = [
    { label: 'WhatsApp', href: `https://wa.me/?text=${enc(text)}` },
    { label: 'X', href: `https://twitter.com/intent/tweet?text=${enc(text)}` },
    { label: 'LinkedIn', href: `https://www.linkedin.com/feed/?shareActive=true&text=${enc(text)}` },
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(site)}&quote=${enc(text)}` },
  ];
  const chip = (on: boolean) => `px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${on ? 'bg-accent text-white border-accent' : `border-[#18181B]/10 dark:border-[#E6E8E6]/10 ${muted} hover:text-accent`}`;

  return (
    <div className="fixed inset-0 z-[140] bg-black/55 flex items-end sm:items-center justify-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-label="Partager mes performances" className="glass bg-[#F4F4F5] dark:bg-[#0f0f10] w-full sm:max-w-3xl max-h-[94vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 animate-in slide-in-from-bottom-4" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div><p className={`text-base font-black flex items-center gap-2 ${ink}`}><Share2 size={16} className="text-accent" /> Partager mes performances</p>
            <p className={`text-[11px] font-semibold ${muted}`}>Choisis ce que tu montres. L'image est créée sur ton appareil : rien n'est publié sans toi.</p></div>
          <button onClick={onClose} aria-label="Fermer" className={`p-1.5 rounded-full hover:text-accent ${muted}`}><X size={18} /></button>
        </div>
        <div className="grid sm:grid-cols-[1fr_300px] gap-5">
          <div className="space-y-4 order-2 sm:order-1">
            <div className="space-y-1.5"><p className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>Période</p>
              <div className="flex gap-1.5">{(['day', 'week', 'month'] as SharePeriod[]).map(p => <button key={p} onClick={() => setPeriod(p)} className={chip(period === p)}>{PERIOD_LABEL[p]}</button>)}</div></div>
            <div className="space-y-1.5"><p className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>Chiffres à partager <span className="normal-case tracking-normal font-semibold">· jusqu'à 6</span></p>
              <div className="grid grid-cols-2 gap-1.5">
                {metrics.map(m => {
                  const on = sel.includes(m.id) && m.available;
                  return (
                    <button key={m.id} role="checkbox" aria-checked={on} disabled={!m.available} onClick={() => toggle(m.id)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all disabled:opacity-35 ${on ? 'border-accent/40 bg-accent/10' : 'border-[#18181B]/10 dark:border-[#E6E8E6]/10'}`}>
                      <span className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 ${on ? 'bg-accent border-accent' : 'border-[#18181B]/25 dark:border-[#E6E8E6]/25'}`}>{on && <Check size={10} strokeWidth={3} className="text-white" />}</span>
                      <span className="min-w-0 flex-1"><span className={`block text-[11px] font-bold truncate ${ink}`}>{m.label}</span><span className={`block text-[10px] font-semibold ${muted}`}>{m.available ? `${m.value}${m.sub ? ` ${m.sub}` : ''}` : 'Pas de donnée'}</span></span>
                    </button>
                  );
                })}
              </div></div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setFormat('square')} className={`${chip(format === 'square')} flex items-center gap-1.5`}><Square size={12} /> Publication</button>
              <button onClick={() => setFormat('story')} className={`${chip(format === 'story')} flex items-center gap-1.5`}><RectangleVertical size={12} /> Story</button>
              {name && <button onClick={() => setShowName(v => !v)} className={chip(showName)}>Afficher mon prénom</button>}
            </div>
            <label className="block space-y-1.5"><span className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>Un mot (facultatif)</span>
              <input value={message} maxLength={120} onChange={e => setMessage(e.target.value)} placeholder="Ex. Une semaine de constance, on continue !" className={`w-full bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 px-3.5 py-3 rounded-xl text-sm font-semibold border border-[#18181B]/10 dark:border-[#E6E8E6]/10 outline-none focus:border-accent ${ink}`} /></label>
          </div>
          <div className="order-1 sm:order-2 space-y-3">
            <div className={`rounded-2xl overflow-hidden bg-black/80 mx-auto ${format === 'story' ? 'max-w-[190px] sm:max-w-[240px]' : 'max-w-[260px] sm:max-w-none'}`}>
              {preview ? <img src={preview} alt="Aperçu de l'image à partager" className="w-full h-auto block" /> : <div className="aspect-[4/5] flex items-center justify-center"><Loader2 className="animate-spin text-accent" /></div>}
            </div>
            <button onClick={share} disabled={busy || !chosen.length} className="hidden sm:flex w-full items-center justify-center gap-2 py-3.5 rounded-2xl bg-accent text-white text-[11px] font-black uppercase tracking-wider shadow-lg shadow-accent/20 disabled:opacity-40">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />} Partager
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={download} disabled={!chosen.length} className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 ${ink} disabled:opacity-40`}><Download size={13} /> Image</button>
              <button onClick={copy} disabled={!chosen.length} className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 ${ink} disabled:opacity-40`}>{copied ? <Check size={13} className="text-accent" /> : <Copy size={13} />} Texte</button>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {links.map(l => <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black border border-[#18181B]/10 dark:border-[#E6E8E6]/10 ${muted} hover:text-accent`}>{l.label}</a>)}
            </div>
            <p className={`text-[10px] font-semibold text-center ${muted}`}>Sur téléphone, « Partager » ouvre WhatsApp, Instagram, LinkedIn… avec l'image. Les liens ci-dessus partagent le texte seul.</p>
          </div>
        </div>
        {/* Mobile : bouton toujours visible en bas */}
        <div className="sm:hidden sticky bottom-0 -mx-5 px-5 pt-3 mt-4 bg-[#F4F4F5] dark:bg-[#0f0f10] border-t border-[#18181B]/5 dark:border-[#E6E8E6]/5">
          <button onClick={share} disabled={busy || !chosen.length} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-accent text-white text-[11px] font-black uppercase tracking-wider shadow-lg shadow-accent/20 disabled:opacity-40">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />} Partager {chosen.length ? `(${chosen.length} chiffre${chosen.length > 1 ? 's' : ''})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareSheet;
