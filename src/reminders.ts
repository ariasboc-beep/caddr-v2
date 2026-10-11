// Rappels intelligents : tâches à heure fixe dont le créneau est passé sans être cochées
import type { AppData, Task } from './types';
import { getKeyFromDate, isDateInRange } from './utils';
import { resolveDay } from './analytics';

export interface LateTask { id: string; title: string; block: string; start: string; end: number; oneOff: boolean; important: boolean }

const toMin = (t?: string) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return isNaN(h) ? null : h * 60 + (m || 0); };

/** Tâches en retard (créneau terminé depuis 10 min à 3 h), selon le réglage choisi */
export function lateTasks(appData: AppData, now: Date, mode: 'off' | 'important' | 'all'): LateTask[] {
  if (mode === 'off') return [];
  const k = getKeyFromDate(now); const d = new Date(k + 'T12:00:00');
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const skipped = new Set((appData.skips || []).filter(s => s.date === k).map(s => s.taskId));
  const planIds = new Set(appData.blocks.flatMap(b => b.tasks.map(t => t.id)));
  const goalLinked = new Set((appData.longTermGoals || []).flatMap(g => g.linkedTasks || []));
  const goalBlocks = new Set((appData.longTermGoals || []).flatMap(g => g.linkedBlocks || []));
  const out: LateTask[] = [];
  resolveDay(appData, d).forEach(b => b.tasks.forEach((t: Task) => {
    if (!isDateInRange(d, t.recurrence, t.specificDate, t.startDate, t.endDate, t.stopDate)) return;
    if (t.completedDates?.includes(k) || skipped.has(t.id)) return;
    const s = toMin(t.startTime); if (s === null) return;
    const end = s + (t.duration || 30);
    if (nowMin < end + 10 || nowMin > end + 180) return;
    const important = t.priority === 'high' || !!t.isHabit || goalLinked.has(t.id) || goalBlocks.has(b.title);
    if (mode === 'important' && !important) return;
    out.push({ id: t.id, title: t.title, block: b.title, start: t.startTime!, end, oneOff: t.recurrence === 'specific' || t.recurrence === 'once' || !planIds.has(t.id), important });
  }));
  return out.sort((a, b) => a.end - b.end);
}

const KEY = 'caddr_reminded';
export function alreadyReminded(date: string): Set<string> { try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return new Set(v[date] || []); } catch { return new Set(); } }
export function markReminded(date: string, ids: string[]) { try { const cur = alreadyReminded(date); ids.forEach(i => cur.add(i)); localStorage.setItem(KEY, JSON.stringify({ [date]: [...cur] })); } catch { /* rien */ } }

/** Notification système (si autorisée), avec boutons d'action gérés par le service worker */
export async function notifyLate(t: LateTask, date: string) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker?.getRegistration();
    const body = `Prévue à ${t.start.replace(':', 'h')} (${t.block}). Tu la fais maintenant, ou on la ${t.oneOff ? 'reporte à demain' : 'saute pour aujourd’hui'} ?`;
    const opts = { body, tag: `caddr-late-${t.id}-${date}`, icon: '/icon-192.png', badge: '/icon-192.png', data: { kind: 'caddr-reminder', taskId: t.id, date }, actions: [{ action: 'done', title: '✓ Fait' }, { action: 'later', title: t.oneOff ? 'Demain' : 'Sauter' }] } as NotificationOptions;
    if (reg) await reg.showNotification(`« ${t.title} » pas encore faite`, opts);
    else new Notification(`« ${t.title} » pas encore faite`, { body, tag: opts.tag });
  } catch { /* non supporté */ }
}
