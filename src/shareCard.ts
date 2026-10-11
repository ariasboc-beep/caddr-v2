// Carte de partage des performances : calcul des chiffres choisis et dessin d'une image
// aux couleurs de Caddr. (canvas, sans bibliothèque). Aucune donnée n'est envoyée :
// l'image est créée sur l'appareil, puis partagée par la feuille de partage du téléphone.
import type { AppData } from './types';
import { getKeyFromDate } from './utils';
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
    try {
      const faces = [new FontFace('CaddrShare', 'url(/fonts/PlusJakartaSans-ExtraBold.ttf)', { weight: '800' }), new FontFace('CaddrShare', 'url(/fonts/PlusJakartaSans-Bold.ttf)', { weight: '700' }), new FontFace('CaddrShare', 'url(/fonts/PlusJakartaSans-Regular.ttf)', { weight: '400' })];
      (await Promise.all(faces.map(f => f.load()))).forEach(f => (document as any).fonts.add(f));
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
  // En-tête : logo + nom
  drawLogo(c, P, y, 96);
  c.fillStyle = INK; c.font = F(800, 52); c.textBaseline = 'middle'; c.fillText('Caddr', P + 124, y + 48);
  const cw = c.measureText('Caddr').width; c.fillStyle = GOLD; c.fillText('.', P + 124 + cw, y + 48);
  y += 96 + 76;
  // Titre
  c.textBaseline = 'alphabetic';
  c.fillStyle = TEAL; c.font = F(800, 30); c.fillText(inp.periodTitle.toUpperCase(), P, y);
  y += 22;
  const who = inp.name ? `La discipline de ${inp.name}` : 'Ma discipline';
  const s = fit(c, who, W - 2 * P, 76, 800, 44); c.fillStyle = INK; c.font = F(800, s); y += s; c.fillText(who, P, y);
  y += 46; c.fillStyle = MUTED; c.font = F(400, 32); c.fillText(inp.periodLabel, P, y);
  y += 64;
  // Tuiles : la première (mise en avant) en pleine largeur si c'est le taux
  const list = inp.metrics.slice(0, 6);
  const gap = 28, colW = (W - 2 * P - gap) / 2;
  const footer = inp.message ? 260 : 170;
  const avail = H - y - footer - (inp.format === 'story' ? 140 : 40);
  const hero = list[0]?.highlight ? list[0] : null;
  const rest = hero ? list.slice(1) : list;
  const rows = Math.ceil(rest.length / 2);
  const story = inp.format === 'story';
  const heroH = hero ? Math.min(story ? 460 : 300, avail * (rest.length ? 0.42 : 0.7)) : 0;
  const tileH = Math.min(story ? 340 : 250, rows ? (avail - heroH - (hero ? gap : 0) - (rows - 1) * gap) / rows : 0);
  if (hero) {
    c.fillStyle = TEAL; rr(c, P, y, W - 2 * P, heroH, 40); c.fill();
    c.fillStyle = 'rgba(11,12,13,0.72)'; c.font = F(800, 28); c.fillText(hero.label.toUpperCase(), P + 48, y + 70);
    const hs = fit(c, hero.value, W - 2 * P - 96, Math.min(150, heroH * 0.5), 800, 60); c.fillStyle = '#0B0C0D'; c.font = F(800, hs); c.fillText(hero.value, P + 44, y + heroH - 56);
    y += heroH + gap;
  }
  rest.forEach((m, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = P + col * (colW + gap), ty = y + row * (tileH + gap);
    const w = rest.length % 2 === 1 && i === rest.length - 1 ? W - 2 * P : colW;
    c.fillStyle = CARD; rr(c, x, ty, w, tileH, 34); c.fill();
    c.strokeStyle = 'rgba(242,243,241,0.07)'; c.lineWidth = 2; rr(c, x + 1, ty + 1, w - 2, tileH - 2, 33); c.stroke();
    const gold = m.id === 'streak' || m.id === 'best' || m.id === 'perfect';
    c.fillStyle = gold ? GOLD : TEAL; rr(c, x + 36, ty + 38, 44, 8, 4); c.fill();
    c.fillStyle = MUTED; c.font = F(700, 26); c.fillText(m.label, x + 36, ty + 92);
    const vs = fit(c, m.value, w - 72, Math.min(96, tileH * 0.42), 800, 40); c.fillStyle = INK; c.font = F(800, vs);
    c.fillText(m.value, x + 34, ty + tileH - 44);
    if (m.sub) { const vw = c.measureText(m.value).width; c.fillStyle = MUTED; c.font = F(700, 28); c.fillText(m.sub, x + 34 + vw + 16, ty + tileH - 46); }
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
  c.strokeStyle = 'rgba(242,243,241,0.1)'; c.lineWidth = 2; c.beginPath(); c.moveTo(P, fy - 34); c.lineTo(W - P, fy - 34); c.stroke();
  c.fillStyle = MUTED; c.font = F(700, 28); c.fillText('Organiser · Structurer · Réussir', P, fy + 4);
  c.fillStyle = TEAL; c.font = F(800, 28); const tag = 'caddr-v2.netlify.app'; c.fillText(tag, W - P - c.measureText(tag).width, fy + 4);
  return cv;
}

export const canvasToBlob = (cv: HTMLCanvasElement): Promise<Blob> => new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('image')), 'image/png'));

export function shareText(metrics: Metric[], periodTitle: string): string {
  const parts = metrics.map(m => `${m.label} : ${m.value}${m.sub ? ` ${m.sub}` : ''}`);
  return `${periodTitle} avec Caddr. 💪\n${parts.join('\n')}\n#discipline #Caddr`;
}
