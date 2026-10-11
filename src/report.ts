// Rapport PDF de l'onglet Analytics : suit la période choisie (jour, semaine,
// mois, année ou période perso.). Police de l'app (Plus Jakarta Sans), aucun
// texte gris : encre foncée + couleur d'accent.
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AppData, TimeframeType } from './types';
import { getKeyFromDate } from './utils';
import { getWeekKey } from './streaks';
import {
  computePeriod, previousPeriod, blockAggregates, buildBuckets, habitAggregates,
  perfectStreak, eachDay, PeriodRange, objectiveStats,
} from './analytics';
import { activeHabits, habitStats as standaloneStats } from './habits';

type RGB = [number, number, number];
const INK: RGB = [24, 24, 27];
const RED: RGB = [185, 28, 28];
const WHITE: RGB = [255, 255, 255];
const hexToRgb = (h: string): RGB => (h.replace('#', '').match(/\w\w/g) || ['2f', 'b0', 'a6']).map(x => parseInt(x, 16)) as RGB;
const mix = (c: RGB, w: number): RGB => c.map(v => Math.round(v + (255 - v) * w)) as RGB; // w = part de blanc
const darken = (c: RGB, k: number): RGB => c.map(v => Math.round(v * (1 - k))) as RGB;

const MOOD: Record<string, string> = { great: 'Excellente', good: 'Bonne', neutral: 'Neutre', bad: 'Difficile' };
const TITLE: Record<TimeframeType, string> = { day: 'Rapport du jour', week: 'Rapport hebdomadaire', month: 'Rapport mensuel', year: 'Rapport annuel', custom: 'Rapport de période' };
const stripHtml = (h?: string) => (h || '').replace(/<\/(p|div|li|h\d)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<li[^>]*>/gi, '• ').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim();
const fmt = (k: string, o: Intl.DateTimeFormatOptions) => new Date(k + 'T12:00:00').toLocaleDateString('fr-FR', o).replace(/\.$/, '');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// --- Police : chargée à la demande depuis /fonts ---
let fontCache: Record<string, string> | null = null;
async function loadFonts(): Promise<Record<string, string> | null> {
  if (fontCache) return fontCache;
  try {
    const files = { normal: 'PlusJakartaSans-Regular.ttf', bold: 'PlusJakartaSans-Bold.ttf', extrabold: 'PlusJakartaSans-ExtraBold.ttf' };
    const out: Record<string, string> = {};
    for (const [style, file] of Object.entries(files)) {
      const buf = await (await fetch(`/fonts/${file}`)).arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      out[style] = btoa(bin);
    }
    fontCache = out;
    return out;
  } catch { return null; }
}

export async function generateReport(appData: AppData, tf: TimeframeType, period: PeriodRange, accentHex: string) {
  const ACC = hexToRgb(accentHex);
  const ACC_DARK = darken(ACC, 0.35);   // accent lisible pour du texte sur blanc
  const TINT = mix(ACC, 0.92);
  const TINT2 = mix(ACC, 0.82);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const fonts = await loadFonts();
  let F = 'helvetica';
  if (fonts) {
    Object.entries(fonts).forEach(([style, b64]) => {
      doc.addFileToVFS(`PJS-${style}.ttf`, b64);
      doc.addFont(`PJS-${style}.ttf`, 'PJS', style);
    });
    F = 'PJS';
  }
  const font = (style: 'normal' | 'bold' | 'extrabold', size: number, color: RGB = INK) => {
    doc.setFont(F, fonts ? style : (style === 'normal' ? 'normal' : 'bold'));
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const W = 210, M = 14, CW = W - 2 * M;
  const todayKey = getKeyFromDate(new Date());
  const stats = computePeriod(appData, period.start, period.end, todayKey);
  const prevR = previousPeriod(tf, period);
  const prev = computePeriod(appData, prevR.start, prevR.end, todayKey);
  const blocks = blockAggregates(stats.days, prev.days);
  const buckets = buildBuckets(stats.days, tf);
  const habits = habitAggregates(appData, eachDay(period.start, period.end), todayKey);
  const streak = perfectStreak(appData, todayKey);
  const title = TITLE[tf];
  const unplannedIds = new Set((appData.taskLog || []).filter(e => e.kind === 'unplanned').map(e => `${e.taskId}|${e.date}`));

  // ---------- En-tête ----------
  doc.setFillColor(...ACC);
  doc.rect(0, 0, W, 40, 'F');
  font('extrabold', 24, WHITE); doc.text('Caddr.', M, 17);
  font('bold', 13, WHITE); doc.text(title, M, 27);
  font('normal', 10.5, WHITE); doc.text(period.label, M, 33.5);
  font('normal', 8.5, WHITE);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`, W - M, 17, { align: 'right' });
  let y = 50;

  // Un titre de section ne reste jamais seul en bas de page : on garde de la place pour le contenu
  const sectionTitle = (t: string, sub?: string, need = 40) => {
    if (y + need > 278) { doc.addPage(); y = 20; }
    doc.setFillColor(...ACC); doc.roundedRect(M, y - 3.6, 2.2, 4.6, 0.8, 0.8, 'F');
    font('bold', 12.5); doc.text(t, M + 5, y);
    if (sub) { font('normal', 8.5); doc.text(sub, M + 5, y + 5); y += 5; }
    y += 6;
  };

  // ---------- Chiffres clés ----------
  const delta = (now: number | null, p: number | null) => now === null || p === null ? null : now - p;
  const d = delta(stats.rate, prev.rate);
  const prevName = tf === 'week' ? 'semaine précédente' : tf === 'month' ? 'mois précédent' : tf === 'year' ? 'année précédente' : tf === 'day' ? 'veille' : 'période précédente';
  const cards: { label: string; value: string; foot: string; footColor?: RGB }[] = [
    { label: 'TAUX DE RÉALISATION', value: stats.rate === null ? '—' : `${stats.rate} %`, foot: d === null ? 'Pas de comparaison' : `${d > 0 ? '+' : ''}${d} pts vs ${prevName}`, footColor: d === null ? INK : d >= 0 ? ACC_DARK : RED },
    { label: 'TÂCHES FAITES', value: `${stats.done} / ${stats.total}`, foot: stats.total - stats.done > 0 ? `${stats.total - stats.done} non faite${stats.total - stats.done > 1 ? 's' : ''}` : stats.total ? 'Tout est fait' : 'Rien de prévu' },
    tf === 'day'
      ? { label: 'BLOCS TERMINÉS', value: `${stats.days[0]?.blocks.filter(b => b.done === b.total).length || 0} / ${stats.days[0]?.blocks.length || 0}`, foot: 'blocs faits à 100 %' }
      : { label: 'JOURNÉES PARFAITES', value: `${stats.perfectDays} / ${stats.activeDays}`, foot: 'jours avec des tâches' },
    { label: 'SÉRIE EN COURS', value: `${streak.current} j`, foot: `Record : ${streak.best} j à 100 %` },
  ];
  const cw = (CW - 3 * 4) / 4;
  cards.forEach((c, i) => {
    const x = M + i * (cw + 4);
    doc.setFillColor(...TINT); doc.setDrawColor(...TINT2); doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cw, 27, 3, 3, 'FD');
    font('bold', 6.8); doc.text(c.label, x + 4, y + 6.5);
    font('extrabold', 16); doc.text(c.value, x + 4, y + 16);
    font('bold', 7.2, c.footColor || INK); doc.text(doc.splitTextToSize(c.foot, cw - 8)[0], x + 4, y + 22.5);
  });
  y += 37;

  // ---------- Objectif prioritaire (mis en avant) ----------
  const obj = objectiveStats(appData, period.start, period.end, todayKey);
  {
    const h = 30;
    doc.setFillColor(...WHITE); doc.setDrawColor(...ACC); doc.setLineWidth(0.8);
    doc.roundedRect(M, y, CW, h, 3, 3, 'FD');
    doc.setFillColor(...ACC); doc.roundedRect(M, y, 4, h, 2, 2, 'F'); doc.rect(M + 2, y, 2, h, 'F');
    font('bold', 7.5, ACC_DARK); doc.text('OBJECTIF PRIORITAIRE', M + 9, y + 7);
    if (tf === 'day') {
      const o = obj.list[0];
      font('extrabold', 14); doc.text(doc.splitTextToSize(o ? o.title : 'Aucun objectif défini ce jour-là', CW - 60)[0], M + 9, y + 16.5);
      if (o) { font('extrabold', 12, o.done ? ACC_DARK : o.today ? INK : RED); doc.text(o.done ? 'Atteint' : o.today ? 'En cours' : 'Non atteint', W - M - 6, y + 16.5, { align: 'right' }); }
      font('normal', 8); doc.text(`Série d'objectifs atteints : ${obj.current} j  ·  record ${obj.best} j`, M + 9, y + 24.5);
    } else if (!obj.list.length) {
      font('bold', 11); doc.text('Aucun objectif prioritaire défini sur cette période.', M + 9, y + 17);
    } else {
      font('extrabold', 22); doc.text(`${obj.done} / ${obj.defined}`, M + 9, y + 19.5);
      const wv = doc.getTextWidth(`${obj.done} / ${obj.defined}`);
      font('bold', 10); doc.text('jours où l’objectif a été atteint', M + 12 + wv, y + 19.5);
      font('extrabold', 22, ACC_DARK); doc.text(obj.rate === null ? '—' : `${obj.rate} %`, W - M - 6, y + 19.5, { align: 'right' });
      font('normal', 8); doc.text(`Série en cours : ${obj.current} j  ·  record : ${obj.best} j`, M + 9, y + 26);
      // barre de progression
      const bx = W - M - 62, by = y + 24, bw2 = 56;
      doc.setFillColor(...TINT2); doc.roundedRect(bx, by, bw2, 2.4, 1.2, 1.2, 'F');
      if (obj.rate) { doc.setFillColor(...ACC); doc.roundedRect(bx, by, Math.max(2.4, bw2 * obj.rate / 100), 2.4, 1.2, 1.2, 'F'); }
    }
    y += h + 10;
  }

  // ---------- Graphique de constance ----------
  const withData = buckets.filter(b => b.rate !== null);
  if (tf !== 'day' && withData.length) {
    const unit = buckets[0]?.days > 1 || tf === 'year' ? (tf === 'year' || stats.days.length > 120 ? 'mois' : 'semaine') : 'jour';
    sectionTitle(`Constance par ${unit}`, 'Part des tâches prévues qui ont été faites');
    const ch = 52, left = M + 9, cwid = CW - 9, top = y + 2, base = top + ch;
    // grille
    [0, 25, 50, 75, 100].forEach(v => {
      const gy = base - (v / 100) * ch;
      doc.setDrawColor(...TINT2); doc.setLineWidth(v === 0 ? 0.4 : 0.2); doc.line(left, gy, left + cwid, gy);
      font('normal', 6.5); doc.text(`${v} %`, left - 1.5, gy + 1.2, { align: 'right' });
    });
    const n = buckets.length, slot = cwid / n, bw = Math.min(slot * 0.62, 9);
    const every = n > 16 ? Math.ceil(n / 12) : 1;
    buckets.forEach((b, i) => {
      const cx = left + slot * i + slot / 2;
      if (b.rate !== null) {
        if (b.rate === 0) { doc.setFillColor(...RED); doc.rect(cx - bw / 2, base - 0.8, bw, 0.8, 'F'); }
        else {
          const h = (b.rate / 100) * ch;
          doc.setFillColor(...(b.perfect ? ACC : mix(ACC, 0.3)));
          doc.roundedRect(cx - bw / 2, base - h, bw, h, Math.min(1, bw / 3), Math.min(1, bw / 3), 'F');
          doc.rect(cx - bw / 2, base - Math.min(h, 1.2), bw, Math.min(h, 1.2), 'F'); // base carrée
          if (n <= 16) { font('bold', 6.2); doc.text(`${b.rate}`, cx, base - h - 1.4, { align: 'center' }); }
        }
      }
      if (i % every === 0) { font('normal', 6.3); doc.text(b.label, cx, base + 4.2, { align: 'center' }); }
    });
    if (stats.rate !== null) {
      const ay = base - (stats.rate / 100) * ch;
      doc.setDrawColor(...ACC_DARK); doc.setLineWidth(0.4);
      (doc as any).setLineDashPattern([1.6, 1.2], 0); doc.line(left, ay, left + cwid, ay); (doc as any).setLineDashPattern([], 0);
      font('bold', 6.8, ACC_DARK); doc.text(`Moyenne ${stats.rate} %`, left + cwid, ay - 1.4, { align: 'right' });
    }
    y = base + 9;
    font('normal', 7.2);
    doc.text('Barre pleine = journée à 100 %   ·   trait rouge = 0 %   ·   pas de barre = rien de prévu ou à venir', M, y);
    y += 9;
  }

  // ---------- Blocs ----------
  const table = (head: string[], body: (string | number)[][], opts: any = {}) => {
    const userParse = opts.didParseCell;
    autoTable(doc, {
      startY: y, head: [head], body, margin: { left: M, right: M },
      styles: { font: F, fontSize: 8.5, textColor: INK, cellPadding: { top: 2.4, bottom: 2.4, left: 3, right: 3 }, lineColor: TINT2, lineWidth: 0.2 },
      headStyles: { fillColor: ACC, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: TINT },
      bodyStyles: { fillColor: WHITE },
      theme: 'grid',
      ...opts,
      // En-têtes alignés comme leur colonne (chiffres à droite)
      didParseCell: (h: any) => {
        if (h.section === 'head') { const cs = opts.columnStyles?.[h.column.index]; if (cs?.halign) h.cell.styles.halign = cs.halign; }
        if (userParse) userParse(h);
      },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  };

  if (tf === 'day') {
    const day = stats.days[0];
    sectionTitle('Détail de la journée', 'Tâches par bloc');
    if (!day || !day.blocks.length) { font('normal', 9); doc.text('Aucune tâche prévue ce jour-là.', M, y); y += 10; }
    else table(['Bloc', 'Tâche', 'Statut'], day.tasks.map(t => [t.block, `${t.isSub ? '   ↳ ' : ''}${t.title}${unplannedIds.has(`${t.id}|${day.date}`) ? '  (imprévue)' : ''}`, t.done ? 'Faite' : 'Non faite']),
      { didParseCell: (h: any) => { if (h.section === 'body' && h.column.index === 2) { h.cell.styles.fontStyle = 'bold'; h.cell.styles.textColor = h.cell.raw === 'Faite' ? ACC_DARK : RED; } } });
  } else if (blocks.length) {
    sectionTitle('Constance par bloc', 'Tâches faites dans chaque bloc et jours où le bloc a été bouclé à 100 %');
    table(['Bloc', 'Taux', 'Tâches faites', 'Jours bouclés à 100 %', `Évolution`],
      blocks.map(b => {
        const dd = b.prevRate === null ? null : b.rate - b.prevRate;
        return [b.title, `${b.rate} %`, `${b.done} / ${b.total}`, `${b.daysComplete} / ${b.daysScheduled}`, dd === null ? '—' : `${dd > 0 ? '+' : ''}${dd} pts`];
      }),
      {
        columnStyles: { 1: { cellWidth: 38 }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
        didParseCell: (h: any) => {
          if (h.section === 'body' && h.column.index === 4 && typeof h.cell.raw === 'string' && h.cell.raw !== '—') h.cell.styles.textColor = h.cell.raw.startsWith('-') ? RED : ACC_DARK;
          if (h.section === 'body' && h.column.index === 0) h.cell.styles.fontStyle = 'bold';
        },
        didDrawCell: (h: any) => {
          if (h.section !== 'body' || h.column.index !== 1) return;
          const r = parseInt(String(h.cell.raw)) || 0;
          const bx = h.cell.x + 16, by = h.cell.y + h.cell.height / 2 - 1.1, bwid = h.cell.width - 19;
          doc.setFillColor(...TINT2); doc.roundedRect(bx, by, bwid, 2.2, 1.1, 1.1, 'F');
          if (r > 0) { doc.setFillColor(...ACC); doc.roundedRect(bx, by, Math.max(2.2, (bwid * r) / 100), 2.2, 1.1, 1.1, 'F'); }
        },
      });
  }

  // ---------- Mouvements des tâches : reports, annulations, imprévus, affectations ----------
  {
    const from = getKeyFromDate(period.start), to = getKeyFromDate(period.end);
    const STATUS: Record<string, string> = { pending: 'en attente', accepted: 'acceptée', declined: 'refusée', done: 'faite' };
    type Mv = { date: string; title: string; kind: string; detail: string };
    const rows: Mv[] = [];
    (appData.taskLog || []).filter(e => e.date >= from && e.date <= to).forEach(e => {
      if (e.kind === 'postponed') rows.push({ date: e.date, title: e.taskTitle, kind: 'Reportée', detail: e.to ? `au ${fmt(e.to, { weekday: 'short', day: 'numeric', month: 'short' })}` : '' });
      if (e.kind === 'cancelled') rows.push({ date: e.date, title: e.taskTitle, kind: 'Annulée', detail: e.reason || '' });
      if (e.kind === 'unplanned') rows.push({ date: e.date, title: e.taskTitle, kind: 'Imprévue', detail: 'Ajoutée le jour même, hors programme' });
      if (e.kind === 'assigned') rows.push({ date: e.date, title: e.taskTitle, kind: 'Affectée', detail: `à ${e.email || '—'} · ${STATUS[e.status || 'pending']}${e.reason ? ` · « ${e.reason} »` : ''}` });
    });
    // Tâches sautées (ancien fonctionnement, ou via Cady avant ce suivi)
    (appData.skips || []).filter(s => (!s.kind || s.kind === 'skip') && s.date >= from && s.date <= to)
      .forEach(s => rows.push({ date: s.date, title: s.taskTitle, kind: 'Sautée', detail: s.reason || '' }));
    if (rows.length) {
      rows.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
      const count = (k: string) => rows.filter(r => r.kind === k).length;
      const parts = [['Reportée', 'reportée'], ['Annulée', 'annulée'], ['Imprévue', 'imprévue'], ['Affectée', 'affectée'], ['Sautée', 'sautée']]
        .map(([k, l]) => { const n = count(k); return n ? `${n} ${l}${n > 1 ? 's' : ''}` : ''; }).filter(Boolean).join('  ·  ');
      sectionTitle('Mouvements des tâches', parts);
      const GOLD_DARK: RGB = [154, 116, 0];
      table(['Date', 'Tâche', 'Mouvement', 'Détail'],
        rows.map(r => [cap(fmt(r.date, { weekday: 'short', day: 'numeric', month: 'short' })), r.title, r.kind, r.detail]),
        {
          columnStyles: { 0: { cellWidth: 26 }, 1: { cellWidth: 58, fontStyle: 'bold' }, 2: { cellWidth: 24, fontStyle: 'bold' } },
          didParseCell: (h: any) => {
            if (h.section !== 'body' || h.column.index !== 2) return;
            h.cell.styles.textColor = h.cell.raw === 'Annulée' ? RED : h.cell.raw === 'Imprévue' ? GOLD_DARK : h.cell.raw === 'Affectée' || h.cell.raw === 'Reportée' ? ACC_DARK : INK;
          },
        });
      font('normal', 7.5); doc.text('Les tâches annulées, reportées, affectées ou sautées ne comptent pas dans le taux de réalisation du jour concerné.', M, y - 6); y += 2;
    }
  }

  // ---------- Habitudes ----------
  if (habits.length) {
    sectionTitle('Habitudes de tâches', 'Tâches de tes blocs suivies comme habitudes');
    table(['Habitude', 'Bloc', 'Série en cours', 'Record', 'Régularité'],
      habits.map(h => [h.title, h.block, `${h.current} j`, `${h.best} j`, h.rate === null ? '—' : `${h.rate} %  (${h.done}/${h.due})`]),
      { columnStyles: { 0: { fontStyle: 'bold' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } } });
  }

  // ---------- Objectifs jour par jour (ou mois par mois) ----------
  if (tf !== 'day' && obj.list.length) {
    if (obj.list.length > 31) {
      sectionTitle('Objectif prioritaire, mois par mois');
      const m = new Map<string, { done: number; total: number }>();
      obj.list.forEach(o => { if (o.today && !o.done) return; const k = o.date.slice(0, 7); const v = m.get(k) || { done: 0, total: 0 }; v.total++; if (o.done) v.done++; m.set(k, v); });
      table(['Mois', 'Jours avec objectif', 'Atteints', 'Taux'],
        [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [cap(fmt(k + '-01', { month: 'long', year: 'numeric' })), `${v.total}`, `${v.done}`, `${v.total ? Math.round(v.done / v.total * 100) : 0} %`]),
        { columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } } });
    } else {
      sectionTitle('Objectif prioritaire, jour par jour');
      table(['Date', 'Objectif du jour', 'Résultat'],
        [...obj.list].reverse().map(o => [cap(fmt(o.date, { weekday: 'short', day: 'numeric', month: 'short' })), o.title, o.done ? 'Atteint' : o.today ? 'En cours' : 'Non atteint']),
        {
          columnStyles: { 0: { cellWidth: 30 }, 2: { cellWidth: 26, fontStyle: 'bold' } },
          didParseCell: (h: any) => { if (h.section === 'body' && h.column.index === 2) h.cell.styles.textColor = h.cell.raw === 'Atteint' ? ACC_DARK : h.cell.raw === 'Non atteint' ? RED : INK; },
        });
    }
  }

  // ---------- Habitudes indépendantes ----------
  const sh = activeHabits(appData.habits);
  if (sh.length) {
    const from = getKeyFromDate(period.start), to = getKeyFromDate(period.end);
    sectionTitle('Habitudes indépendantes', 'Suivies dans l’onglet Habitudes');
    table(['Habitude', 'Type', 'Série en cours', 'Record', 'Réussite sur la période', 'Sans rechute'],
      sh.map(h => { const a = standaloneStats(h); const p = standaloneStats(h, from, to); const due = p.done + p.fail + p.open;
        return [h.name, h.kind === 'quit' ? 'À arrêter' : 'À prendre', `${a.current} j`, `${a.best} j`, due ? `${Math.round(p.done / due * 100)} %  (${p.done}/${due})` : '—', h.kind === 'quit' ? `${a.sinceLastFail} j` : '—']; }),
      { columnStyles: { 0: { fontStyle: 'bold' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } } });
    const notes: (string)[][] = [];
    sh.forEach(h => Object.entries(h.entries || {}).forEach(([k, e]) => {
      const txt = stripHtml(e.note);
      if (k >= from && k <= to && txt) notes.push([cap(fmt(k, { weekday: 'short', day: 'numeric', month: 'short' })), h.name, e.s === 'done' ? (h.kind === 'quit' ? 'Tenu' : 'Fait') : e.s === 'fail' ? (h.kind === 'quit' ? 'Rechute' : 'Pas fait') : e.s === 'skip' ? 'Ignoré' : '—', txt, k]);
    }));
    if (notes.length) {
      sectionTitle('Notes des habitudes');
      table(['Date', 'Habitude', 'Jour', 'Note'], notes.sort((a, b) => a[4].localeCompare(b[4])).map(n => n.slice(0, 4)),
        { columnStyles: { 0: { cellWidth: 26 }, 1: { cellWidth: 38, fontStyle: 'bold' }, 2: { cellWidth: 18 } },
          didParseCell: (h: any) => { if (h.section === 'body' && h.column.index === 2) h.cell.styles.textColor = ['Tenu', 'Fait'].includes(h.cell.raw) ? ACC_DARK : ['Rechute', 'Pas fait'].includes(h.cell.raw) ? RED : INK; } });
    }
  }

  // ---------- Bilans écrits de la période ----------
  const reviews: { title: string; wins?: string; improve?: string; ai?: string }[] = [];
  const pk = getKeyFromDate(period.start), ek = getKeyFromDate(period.end);
  Object.entries(appData.monthlyReviews || {}).forEach(([k, r]) => {
    if (`${k}-01` <= ek && `${k}-31` >= pk) reviews.push({ title: `Bilan de ${fmt(k + '-01', { month: 'long', year: 'numeric' })}`, wins: r.wins, improve: r.improve, ai: r.aiFeedback?.feedback });
  });
  const weekKeys = new Set(eachDay(period.start, period.end).map(k => getWeekKey(new Date(k + 'T12:00:00'))));
  Object.entries(appData.weeklyReviews || {}).sort(([a], [b]) => a.localeCompare(b)).forEach(([k, r]) => {
    if (weekKeys.has(k) && tf !== 'year') reviews.push({ title: `Bilan de la semaine ${k.split('-W')[1]}`, wins: r.wins, improve: r.improve, ai: r.aiFeedback?.feedback });
  });
  const filled = reviews.filter(r => stripHtml(r.wins) || stripHtml(r.improve) || r.ai);
  if (filled.length) {
    sectionTitle('Bilans écrits', undefined, 45);
    filled.forEach(r => {
      if (y > 255) { doc.addPage(); y = 20; }
      font('bold', 10, ACC_DARK); doc.text(cap(r.title), M, y); y += 5.5;
      ([['Ce qui a marché', r.wins], ['À améliorer', r.improve], ['Analyse IA', r.ai]] as [string, string | undefined][]).forEach(([lab, txt]) => {
        const t = stripHtml(txt);
        if (!t) return;
        font('bold', 8.5); doc.text(lab, M, y); y += 4.5;
        font('normal', 9);
        doc.splitTextToSize(t, CW).forEach((line: string) => { if (y > 280) { doc.addPage(); y = 20; } doc.text(line, M, y); y += 4.4; });
        y += 2;
      });
      y += 4;
    });
  }

  // ---------- Détail jour par jour (ou mois par mois) ----------
  if (tf !== 'day') {
    if (tf === 'year' || stats.days.length > 62) {
      sectionTitle(tf === 'year' ? 'Détail mois par mois' : 'Détail par période');
      table(['Période', 'Taux', 'Tâches faites', 'Jours avec des tâches'],
        buckets.filter(b => !b.future).map(b => [b.sub, b.rate === null ? '—' : `${b.rate} %`, `${b.done} / ${b.total}`, `${b.days}`]),
        { columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'right' }, 3: { halign: 'right' } } });
    } else {
      sectionTitle('Journal jour par jour');
      table(['Date', 'Taux', 'Tâches', 'Humeur', 'Objectif'],
        stats.days.filter(dd => !dd.future).map(dd => {
          const day = appData.days[dd.date];
          return [cap(fmt(dd.date, { weekday: 'short', day: 'numeric', month: 'short' })) + (dd.date === todayKey ? ' (en cours)' : ''), dd.rate === null ? '—' : `${dd.rate} %`, dd.total ? `${dd.done} / ${dd.total}` : '—', day?.mood ? MOOD[day.mood] || day.mood : '—', (() => { const o = obj.list.find(x => x.date === dd.date); return o ? (o.done ? 'Atteint' : o.today ? 'En cours' : 'Non atteint') : '—'; })()];
        }),
        {
          columnStyles: { 0: { cellWidth: 38 }, 1: { halign: 'right', fontStyle: 'bold', cellWidth: 18 }, 2: { halign: 'right', cellWidth: 20 }, 3: { cellWidth: 24 } },
          didParseCell: (h: any) => { if (h.section === 'body' && h.column.index === 1 && h.cell.raw === '100 %') h.cell.styles.textColor = ACC_DARK; if (h.section === 'body' && h.column.index === 1 && h.cell.raw === '0 %' && !String(h.row.raw?.[0] || '').includes('en cours')) h.cell.styles.textColor = RED; if (h.section === 'body' && h.column.index === 4) { h.cell.styles.fontStyle = 'bold'; h.cell.styles.textColor = h.cell.raw === 'Atteint' ? ACC_DARK : h.cell.raw === 'Non atteint' ? RED : INK; } },
        });
    }
  }

  // ---------- Pied de page ----------
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...TINT2); doc.setLineWidth(0.3); doc.line(M, 286, W - M, 286);
    font('bold', 7.5, ACC_DARK); doc.text('Caddr.', M, 291);
    font('normal', 7.5); doc.text(`${title} · ${period.label}`, M + 12, 291);
    doc.text(`Page ${i} / ${pages}`, W - M, 291, { align: 'right' });
  }

  const slug = tf === 'year' ? `annuel-${period.start.getFullYear()}` : tf === 'month' ? `mensuel-${getKeyFromDate(period.start).slice(0, 7)}` : tf === 'week' ? `hebdo-${getWeekKey(period.start)}` : tf === 'day' ? `jour-${getKeyFromDate(period.start)}` : `periode-${getKeyFromDate(period.start)}_${getKeyFromDate(period.end)}`;
  doc.save(`caddr-rapport-${slug}.pdf`);
}
