import React, { useMemo, useState } from 'react';
import { Sparkles, Check, Star, History } from 'lucide-react';
import type { LifeReview } from '../types';
import { quarterKey } from '../briefing';

interface Props {
  reviews: { [q: string]: LifeReview };
  onSave: (r: LifeReview) => void;
  onAskClaude?: (domains: string[]) => void;
  accentHex: string;
}

export const DOMAINS = ['Santé et énergie', 'Carrière et travail', 'Finances', 'Famille', 'Couple et amour', 'Amis et vie sociale', 'Développement personnel', 'Spiritualité et sens', 'Loisirs et plaisir', 'Cadre de vie'];
const SHORT: Record<string, string> = { 'Santé et énergie': 'Santé', 'Carrière et travail': 'Carrière', 'Finances': 'Finances', 'Famille': 'Famille', 'Couple et amour': 'Amour', 'Amis et vie sociale': 'Social', 'Développement personnel': 'Dév. perso', 'Spiritualité et sens': 'Spiritualité', 'Loisirs et plaisir': 'Loisirs', 'Cadre de vie': 'Cadre de vie' };
const ink = 'text-[#18181B] dark:text-[#E6E8E6]';
const muted = 'text-[#18181B]/55 dark:text-[#E6E8E6]/55';
const prevQuarter = (q: string) => { const [y, t] = q.split('-T').map(Number); return t === 1 ? `${y - 1}-T4` : `${y}-T${t - 1}`; };
const qLabel = (q: string) => { const [y, t] = q.split('-T'); return `${t === '1' ? '1er' : `${t}e`} trimestre ${y}`; };

// Radar (toile) : une branche par domaine, note de 0 à 10
const Radar: React.FC<{ cur: Record<string, number>; prev?: Record<string, number>; accent: string }> = ({ cur, prev, accent }) => {
  const W = 400, H = 300, CX = W / 2, CY = H / 2, R = 104, n = DOMAINS.length;
  const C = CX;
  const pt = (i: number, v: number) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [CX + Math.cos(a) * R * (v / 10), CY + Math.sin(a) * R * (v / 10)]; };
  const poly = (sc: Record<string, number>) => DOMAINS.map((d, i) => pt(i, sc[d] || 0).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[400px] mx-auto" role="img" aria-label="Roue de la vie">
      {[2, 4, 6, 8, 10].map(l => <polygon key={l} points={DOMAINS.map((_, i) => pt(i, l).join(',')).join(' ')} fill="none" stroke="currentColor" strokeOpacity={l === 10 ? 0.18 : 0.08} className={ink} />)}
      {DOMAINS.map((_, i) => { const [x, y] = pt(i, 10); return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke="currentColor" strokeOpacity={0.08} className={ink} />; })}
      {prev && <polygon points={poly(prev)} fill="none" stroke="currentColor" strokeOpacity={0.45} strokeDasharray="4 3" strokeWidth={1.5} className={ink} />}
      <polygon points={poly(cur)} fill={accent} fillOpacity={0.22} stroke={accent} strokeWidth={2} strokeLinejoin="round" />
      {DOMAINS.map((d, i) => { const [x, y] = pt(i, cur[d] || 0); return <circle key={d} cx={x} cy={y} r={3.5} fill={accent} />; })}
      {DOMAINS.map((d, i) => {
        const [x, y] = pt(i, 11.8);
        return <text key={d} x={x} y={y} textAnchor={x < C - 10 ? 'end' : x > C + 10 ? 'start' : 'middle'} dominantBaseline="middle" className="fill-current text-[#18181B]/70 dark:text-[#E6E8E6]/70" style={{ fontSize: 10, fontWeight: 700 }}>{SHORT[d]} {cur[d] ? `· ${cur[d]}` : ''}</text>;
      })}
    </svg>
  );
};

const LifeWheel: React.FC<Props> = ({ reviews, onSave, onAskClaude, accentHex }) => {
  const q = quarterKey(new Date());
  const existing = reviews[q];
  const prev = reviews[prevQuarter(q)];
  const [scores, setScores] = useState<Record<string, number>>(() => existing?.scores || Object.fromEntries(DOMAINS.map(d => [d, prev?.scores?.[d] || 5])));
  const [focus, setFocus] = useState<string[]>(existing?.focus || []);
  const [saved, setSaved] = useState(!!existing);
  const lowest = useMemo(() => [...DOMAINS].sort((a, b) => (scores[a] || 0) - (scores[b] || 0)).slice(0, 3), [scores]);
  const avg = Math.round((DOMAINS.reduce((s, d) => s + (scores[d] || 0), 0) / DOMAINS.length) * 10) / 10;
  const history = Object.values(reviews).sort((a, b) => b.quarter.localeCompare(a.quarter));

  const save = () => {
    const now = new Date().toISOString();
    onSave({ quarter: q, scores, focus, createdAt: existing?.createdAt || now, updatedAt: now });
    setSaved(true);
  };

  return (
    <div className="space-y-4">
      <p className={`text-xs font-semibold ${muted}`}>Une fois par trimestre, note chaque domaine de ta vie de 1 à 10. La roue montre les déséquilibres ; choisis jusqu'à 3 priorités pour le trimestre.</p>
      <div className="grid md:grid-cols-2 gap-5 items-start">
        <div className="space-y-2">
          <Radar cur={scores} prev={prev?.scores} accent={accentHex} />
          <div className={`flex justify-center gap-4 text-[10px] font-bold ${muted}`}>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: `${accentHex}55`, boxShadow: `inset 0 0 0 1.5px ${accentHex}` }} />{qLabel(q)} · moyenne {avg}</span>
            {prev && <span className="flex items-center gap-1.5"><span className="w-3 h-0 border-t-2 border-dashed border-current" />{qLabel(prev.quarter)}</span>}
          </div>
        </div>
        <div className="space-y-2.5">
          {DOMAINS.map(d => {
            const delta = prev?.scores?.[d] !== undefined ? (scores[d] || 0) - prev.scores[d] : null;
            const isFocus = focus.includes(d);
            return (
              <div key={d} className="space-y-1">
                <div className="flex items-center gap-2">
                  <button onClick={() => { setSaved(false); setFocus(f => f.includes(d) ? f.filter(x => x !== d) : f.length >= 3 ? f : [...f, d]); }} aria-label={isFocus ? `Retirer ${d} des priorités` : `Faire de ${d} une priorité`} title="Priorité du trimestre" className={isFocus ? 'text-[#c98500]' : 'text-[#18181B]/25 dark:text-[#E6E8E6]/25 hover:text-[#c98500]'}><Star size={13} fill={isFocus ? 'currentColor' : 'none'} /></button>
                  <span className={`flex-1 text-[12px] font-bold ${ink}`}>{d}</span>
                  {delta !== null && delta !== 0 && <span className={`text-[10px] font-black ${delta > 0 ? 'text-[#199e70]' : 'text-[#e66767]'}`}>{delta > 0 ? '+' : ''}{delta}</span>}
                  <span className="w-6 text-right text-[13px] font-black tabular-nums" style={{ color: accentHex }}>{scores[d]}</span>
                </div>
                <input type="range" min={1} max={10} value={scores[d] || 5} aria-label={`Note ${d}`} onChange={e => { setSaved(false); setScores(s => ({ ...s, [d]: Number(e.target.value) })); }} className="w-full accent-[color:var(--accent)]" />
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={save} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-accent/20">{saved ? <Check size={13} /> : null}{saved ? 'Revue enregistrée' : `Enregistrer la revue (${qLabel(q)})`}</button>
        {onAskClaude && <button onClick={() => onAskClaude(focus.length ? focus : lowest)} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#18181B]/5 dark:bg-[#E6E8E6]/5 text-[10px] font-black uppercase tracking-wider hover:text-accent ${ink}`}><Sparkles size={13} /> Des habitudes pour {focus.length ? 'mes priorités' : 'mes domaines faibles'}</button>}
      </div>
      <p className={`text-[11px] font-semibold ${muted}`}>Domaines les plus faibles : {lowest.map(d => `${SHORT[d]} (${scores[d]})`).join(', ')}{focus.length ? ` · Priorités : ${focus.map(d => SHORT[d]).join(', ')}` : ''}</p>
      {history.length > 1 && (
        <div className="space-y-1.5">
          <p className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${muted}`}><History size={12} /> Revues précédentes</p>
          {history.map(r => {
            const a = Math.round((DOMAINS.reduce((s, d) => s + (r.scores[d] || 0), 0) / DOMAINS.length) * 10) / 10;
            return <p key={r.quarter} className={`text-[12px] font-semibold ${ink}`}>{qLabel(r.quarter)} · moyenne {a}{r.focus?.length ? ` · priorités : ${r.focus.map(d => SHORT[d]).join(', ')}` : ''}</p>;
          })}
        </div>
      )}
    </div>
  );
};

export default LifeWheel;
