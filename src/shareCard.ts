// Carte de partage des performances : calcul des chiffres choisis et dessin d'une image
// aux couleurs de Caddr. (canvas, sans bibliothèque). Aucune donnée n'est envoyée :
// l'image est créée sur l'appareil, puis partagée par la feuille de partage du téléphone.
import type { AppData } from './types';
import { getKeyFromDate, fontUrl } from './utils';
import { computePeriod, getPeriod, perfectStreak, objectiveStats, eachDay } from './analytics';
import { activeHabits, habitStats } from './habits';
import { filled } from './journal';

export type SharePeriod = 'day' | 'week' | 'month';
export type MetricId = 'rate' | 'done' | 'perfect' | 'streak' | 'best' | 'objective' | 'habits' | 'journal' | 'focus' | 'level';

export interface Metric { id: MetricId; label: string; value: string; sub?: string; available: boolean; highlight?: boolean }

export const PERIOD_LABEL: Record<SharePeriod, string> = { day: "Aujourd'hui", week: 'Cette semaine', month: 'Ce mois-ci' };

const fmtMin = (m: number) => m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}` : `${m} min`;

export function computeShareMetrics(data: AppData, period: SharePeriod, now = new Date()): { metrics: Metric[]; periodLabel: string } {
  const todayKey = getKeyFromDate(now);
  const p = getPeriod(period, now);
  const end = p.end.getTime() > now.getTime() ? now : p.end;
  const st = computePeriod(data, p.start, end, todayKey);
  const streak = perfectStreak(data, todayKey);
  const obj = objectiveStats(data, p.start, end, todayKey);
  const from = getKeyFromDate(p.start), to = todayKey < getKeyFromDate(p.end) ? todayKey : getKeyFromDate(p.end);
  // Habitudes indépendantes sur la période
  let hDone = 0, hDue = 0;
  activeHabits(data.habits).forEach(h => { const s = habitStats(h, from, to); hDone += s.done; hDue += s.done + s.fail + s.open; });
  const journalDays = eachDay(p.start, end).filter(k => { const e = data.journal?.[k]; return e && (filled(e.gratitude).length || filled(e.pride).length); }).length;
  const focusMin = (data.focusSessions || []).filter(f => f.date >= from && f.date <= to).reduce((s, f) => s + (f.actualMin || f.durationMin || 0), 0);
  const metrics: Metric[] = [
    { id: 'rate', label: 'Taux de réalisation', value: st.rate === null ? '—' : `${st.rate} %`, available: st.rate !== null, highlight: true },
    { id: 'done', label: 'Tâches accomplies', value: `${st.done}`, sub: `sur ${st.total}`, available: st.total > 0 },
    { id: 'perfect', label: 'Journées parfaites', value: `${st.perfectDays}`, sub: `sur ${st.activeDays}`, available: period !== 'day' && st.activeDays > 0 },
    { id: 'streak', label: 'Série en cours', value: `${streak.current} j`, sub: 'à 100 %', available: streak.current > 0 },
    { id: 'best', label: 'Record de série', value: `${streak.best} j`, available: streak.best > 0 },
    { id: 'objective', label: period === 'day' ? 'Objectif du jour' : 'Objectifs atteints', value: period === 'day' ? (obj.list[0]?.done ? 'Atteint' : obj.list[0] ? 'En cours' : '—') : `${obj.done}`, sub: period === 'day' ? undefined : `sur ${obj.defined}`, available: obj.defined > 0 },
    { id: 'habits', label: 'Habitudes tenues', value: hDue ? `${Math.round((hDone / hDue) * 100)} %` : '—', sub: hDue ? `${hDone} / ${hDue}` : undefined, available: hDue > 0 },
    { id: 'journal', label: 'Journal de gratitude', value: `${journalDays} j`, sub: period === 'day' ? undefined : 'remplis', available: journalDays > 0 },
    { id: 'focus', label: 'Concentration', value: fmtMin(focusMin), available: focusMin > 0 },
    { id: 'level', label: 'Niveau', value: `${data.userProfile?.level || 1}`, available: true },
  ];
  return { metrics, periodLabel: p.label };
}

/** Choix par défaut : les chiffres les plus parlants disponibles (4 au maximum) */
export function defaultSelection(metrics: Metric[]): MetricId[] {
  const order: MetricId[] = ['rate', 'streak', 'done', 'perfect', 'habits', 'objective', 'journal', 'focus', 'best', 'level'];
  return order.filter(id => metrics.find(m => m.id === id)?.available).slice(0, 4);
}

// ---------- Dessin ----------
let fontsReady: Promise<void> | null = null;
function loadFonts(): Promise<void> {
  if (fontsReady) return fontsReady;
  fontsReady = (async () => {
    // Exactement la police de l'app (Plus Jakarta Sans), servie depuis /fonts :
    // le woff2 d'abord, le ttf en secours. L'image porte ainsi la typographie de Caddr.
    try {
      const src = (n: string) => `url(${fontUrl(`PlusJakartaSans-${n}.woff2`)}) format('woff2'), url(${fontUrl(`PlusJakartaSans-${n}.ttf`)}) format('truetype')`;
      const faces = [new FontFace('CaddrShare', src('ExtraBold'), { weight: '800' }), new FontFace('CaddrShare', src('Bold'), { weight: '700' }), new FontFace('CaddrShare', src('Regular'), { weight: '400' })];
      (await Promise.all(faces.map(f => f.load()))).forEach(f => (document as any).fonts.add(f));
      await (document as any).fonts.ready;
    } catch { /* police système en secours */ }
  })();
  return fontsReady;
}

export type ShareFormat = 'square' | 'story';
const TEAL = '#2FB0A6', GOLD = '#FDCA40', BG = '#0B0C0D', CARD = '#16181A', INK = '#F2F3F1', MUTED = 'rgba(242,243,241,0.62)';

const rr = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };

function drawLogo(c: CanvasRenderingContext2D, x: number, y: number, size: number) {
  c.save(); c.translate(x, y); c.scale(size / 512, size / 512);
  c.fillStyle = '#121416'; rr(c, 0, 0, 512, 512, 116); c.fill();
  c.translate(-6, 0); c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = TEAL; c.lineWidth = 54; c.stroke(new Path2D('M 307.8 165.6 A 118 118 0 1 0 307.8 346.4'));
  c.strokeStyle = GOLD; c.lineWidth = 44; c.stroke(new Path2D('M 262 262 L 305 305 L 392 206'));
  c.restore();
}

function fit(c: CanvasRenderingContext2D, text: string, maxW: number, size: number, weight: number, min = 18): number {
  let s = size; c.font = `${weight} ${s}px CaddrShare, system-ui, sans-serif`;
  while (c.measureText(text).width > maxW && s > min) { s -= 2; c.font = `${weight} ${s}px CaddrShare, system-ui, sans-serif`; }
  return s;
}

/** Tronque proprement un intitulé trop long pour sa tuile. */
function fit2(c: CanvasRenderingContext2D, text: string, maxW: number, size: number): string {
  c.font = `700 ${size}px CaddrShare, system-ui, sans-serif`;
  if (c.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 4 && c.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}

function wrap(c: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/); const lines: string[] = []; let line = '';
  words.forEach(w => { const t = line ? `${line} ${w}` : w; if (c.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
  if (line) lines.push(line); return lines.slice(0, 3);
}

export interface DrawInput { metrics: Metric[]; periodTitle: string; periodLabel: string; name?: string; message?: string; format: ShareFormat }

export async function drawShareCard(inp: DrawInput): Promise<HTMLCanvasElement> {
  await loadFonts();
  const W = 1080, H = inp.format === 'story' ? 1920 : 1350;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d')!;
  const F = (w: number, s: number) => `${w} ${s}px CaddrShare, system-ui, sans-serif`;
  // Fond : noir profond et halo teal discret
  c.fillStyle = BG; c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(W * 0.85, H * 0.08, 20, W * 0.85, H * 0.08, W * 0.9); g.addColorStop(0, 'rgba(47,176,166,0.28)'); g.addColorStop(1, 'rgba(47,176,166,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const P = 84; let y = inp.format === 'story' ? 200 : 96;
  const track = (px: string) => { try { (c as any).letterSpacing = px; } catch { /* non géré */ } };
  // En-tête : logo + nom
  drawLogo(c, P, y, 96);
  c.fillStyle = INK; c.font = F(800, 52); c.textBaseline = 'middle'; c.fillText('Caddr', P + 124, y + 48);
  const cw = c.measureText('Caddr').width; c.fillStyle = GOLD; c.fillText('.', P + 124 + cw, y + 48);
  y += 96 + 72;
  // Titre
  c.textBaseline = 'alphabetic';
  track('4px'); c.fillStyle = TEAL; c.font = F(800, 28); c.fillText(inp.periodTitle.toUpperCase(), P, y); track('0px');
  y += 26;
  const who = inp.name ? `La discipline de ${inp.name}` : 'Ma discipline';
  const s = fit(c, who, W - 2 * P, 76, 800, 44); c.fillStyle = INK; c.font = F(800, s); y += s; c.fillText(who, P, y);
  y += 44; c.fillStyle = MUTED; c.font = F(400, 30); c.fillText(inp.periodLabel, P, y);
  // Filet teal discret sous le titre
  y += 36; c.strokeStyle = 'rgba(47,176,166,0.45)'; c.lineWidth = 3; c.beginPath(); c.moveTo(P, y); c.lineTo(P + 96, y); c.stroke();
  y += 52;
  // Tuiles : la première (mise en avant) en pleine largeur si c'est le taux
  const list = inp.metrics.slice(0, 6);
  const gap = 28, colW = (W - 2 * P - gap) / 2;
  const footer = inp.message ? 260 : 170;
  const avail = H - y - footer - (inp.format === 'story' ? 140 : 40);
  const hero = list[0]?.highlight ? list[0] : null;
  const rest = hero ? list.slice(1) : list;
  const rows = Math.ceil(rest.length / 2);
  const story = inp.format === 'story';
  // Hauteurs : les tuiles gardent de quoi respirer (intitulé au-dessus, chiffre en bas) ;
  // c'est la tuile principale qui cède de la place quand il y a beaucoup de chiffres.
  const MIN_TILE = story ? 210 : 176;
  const restH = rows ? rows * MIN_TILE + (rows - 1) * gap : 0;
  let heroH = hero ? Math.min(story ? 460 : 300, avail * (rest.length ? 0.42 : 0.7)) : 0;
  if (hero && rows && avail - heroH - gap < restH) heroH = Math.max(story ? 300 : 210, avail - restH - gap);
  const tileH = rows ? Math.max(MIN_TILE, Math.min(story ? 340 : 250, (avail - heroH - (hero ? gap : 0) - (rows - 1) * gap) / rows)) : 0;
  if (hero) {
    c.fillStyle = TEAL; rr(c, P, y, W - 2 * P, heroH, 40); c.fill();
    // Anneau discret : la même lecture que dans l'app, quand le chiffre est un pourcentage
    const pct = parseFloat(hero.value.replace(/\s/g, '').replace(',', '.'));
    const ring = /%/.test(hero.value) && !isNaN(pct);
    let rad = 0;
    if (ring) {
      rad = Math.min(heroH * 0.28, 82);
      const cx = W - P - 60 - rad, cy = y + heroH / 2;
      c.save(); c.lineCap = 'round'; c.lineWidth = Math.max(11, rad * 0.19);
      c.strokeStyle = 'rgba(11,12,13,0.16)'; c.beginPath(); c.arc(cx, cy, rad, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = 'rgba(11,12,13,0.88)'; c.beginPath();
      c.arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, Math.min(1, pct / 100))); c.stroke();
      c.restore();
    }
    track('3px'); c.fillStyle = 'rgba(11,12,13,0.66)'; c.font = F(800, 26); c.fillText(hero.label.toUpperCase(), P + 48, y + 74); track('0px');
    const maxV = W - 2 * P - 96 - (ring ? rad * 2 + 72 : 0);
    const hs = fit(c, hero.value, maxV, Math.max(56, Math.min(152, heroH - 128)), 800, 50);
    // Le chiffre suit l'intitulé sur une grande tuile, se cale en bas sur une petite
    const hvy = Math.min(y + heroH - 56, y + 104 + hs);
    c.fillStyle = '#0B0C0D'; c.font = F(800, hs); c.fillText(hero.value, P + 44, hvy);
    if (hero.sub) { const vw = c.measureText(hero.value).width; c.fillStyle = 'rgba(11,12,13,0.6)'; c.font = F(700, 30); c.fillText(hero.sub, P + 48 + vw + 16, hvy - 6); }
    y += heroH + gap;
  }
  rest.forEach((m, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = P + col * (colW + gap), ty = y + row * (tileH + gap);
    const w = rest.length % 2 === 1 && i === rest.length - 1 ? W - 2 * P : colW;
    c.fillStyle = CARD; rr(c, x, ty, w, tileH, 34); c.fill();
    c.strokeStyle = 'rgba(242,243,241,0.07)'; c.lineWidth = 2; rr(c, x + 1, ty + 1, w - 2, tileH - 2, 33); c.stroke();
    const gold = m.id === 'streak' || m.id === 'best' || m.id === 'perfect';
    // Tuile pleine largeur (chiffre impair en dernier) : intitulé à gauche, chiffre à droite
    if (w > colW + gap) {
      const mid = ty + tileH / 2;
      c.fillStyle = gold ? GOLD : TEAL; rr(c, x + 36, mid - 22, 40, 7, 4); c.fill();
      track('1px'); c.fillStyle = MUTED; c.font = F(700, 26); c.fillText(fit2(c, m.label, w * 0.5, 26), x + 36, mid + 22); track('0px');
      const ws = fit(c, m.value, w * 0.4, Math.min(72, tileH * 0.46), 800, 34); c.font = F(800, ws);
      const sw = m.sub ? (c.font = F(700, 26), c.measureText(m.sub).width + 14) : 0;
      c.font = F(800, ws); const vw2 = c.measureText(m.value).width;
      c.fillStyle = INK; c.fillText(m.value, x + w - 40 - vw2 - sw, mid + ws * 0.35);
      if (m.sub) { c.fillStyle = MUTED; c.font = F(700, 26); c.fillText(m.sub, x + w - 40 - sw + 14, mid + ws * 0.35); }
      return;
    }
    c.fillStyle = gold ? GOLD : TEAL; rr(c, x + 36, ty + 34, 40, 7, 4); c.fill();
    track('1px'); c.fillStyle = MUTED; c.font = F(700, 25); c.fillText(fit2(c, m.label, w - 72, 25), x + 36, ty + 84); track('0px');
    const vs = fit(c, m.value, w - 72, Math.max(34, Math.min(92, tileH - 122)), 800, 34); c.fillStyle = INK; c.font = F(800, vs);
    const vy = Math.min(ty + tileH - 36, ty + 116 + vs);
    c.fillText(m.value, x + 34, vy);
    if (m.sub) { const vw = c.measureText(m.value).width; c.fillStyle = MUTED; c.font = F(700, Math.min(28, vs * 0.42)); c.fillText(m.sub, x + 34 + vw + 14, vy - 2); }
  });
  y += rows * tileH + Math.max(0, rows - 1) * gap;
  // Message personnel
  let fy = H - (inp.format === 'story' ? 220 : 110);
  if (inp.message) {
    c.font = F(700, 36); const lines = wrap(c, `« ${inp.message.trim()} »`, W - 2 * P);
    let my = fy - 70 - (lines.length - 1) * 48;
    c.fillStyle = INK; lines.forEach(l => { c.fillText(l, P, my); my += 48; });
  }
  // Pied de page
  c.strokeStyle = 'rgba(242,243,241,0.1)'; c.lineWidth = 2; c.beginPath(); c.moveTo(P, fy - 36); c.lineTo(W - P, fy - 36); c.stroke();
  track('2px');
  c.fillStyle = MUTED; c.font = F(700, 26); c.fillText('Organiser · Structurer · Réussir', P, fy + 4);
  c.fillStyle = TEAL; c.font = F(800, 26); const tag = 'caddr-v2.netlify.app'; c.fillText(tag, W - P - c.measureText(tag).width, fy + 4);
  track('0px');
  return cv;
}

export const canvasToBlob = (cv: HTMLCanvasElement): Promise<Blob> => new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('image')), 'image/png'));

export function shareText(metrics: Metric[], periodTitle: string): string {
  const parts = metrics.map(m => `${m.label} : ${m.value}${m.sub ? ` ${m.sub}` : ''}`);
  return `${periodTitle} avec Caddr. 💪\n${parts.join('\n')}\n#discipline #Caddr`;
}
