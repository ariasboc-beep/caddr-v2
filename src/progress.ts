// Leviers de constance : jour difficile, jokers de série, identité et votes, paliers de
// maîtrise, cartes surprises. Fonctions pures, testables.
import type { AppData, Block, Task, Identity, RewardCard } from './types';
import { generateId, getKeyFromDate } from './utils';

const atNoon = (k: string) => new Date(k + 'T12:00:00');
const addDays = (k: string, n: number) => { const d = atNoon(k); d.setDate(d.getDate() + n); return getKeyFromDate(d); };

// ---------- Jour difficile ----------
export const isHardDay = (d: AppData, k: string) => (d.hardDays || []).includes(k);
export const setHardDay = (d: AppData, k: string, on: boolean): AppData => ({ ...d, hardDays: on ? Array.from(new Set([...(d.hardDays || []), k])) : (d.hardDays || []).filter(x => x !== k) });

// ---------- Jokers de série : 2 par mois, jamais deux jours de suite ----------
export const JOKERS_PER_MONTH = 2;
export const jokersUsedInMonth = (d: AppData, k: string) => (d.streakJokers || []).filter(x => x.slice(0, 7) === k.slice(0, 7)).length;
export const jokersLeft = (d: AppData, k: string) => Math.max(0, JOKERS_PER_MONTH - jokersUsedInMonth(d, k));
export function canUseJoker(d: AppData, k: string): { ok: boolean; reason?: string } {
  const used = d.streakJokers || [];
  if (used.includes(k)) return { ok: false, reason: 'Joker déjà utilisé ce jour-là.' };
  if (jokersLeft(d, k) <= 0) return { ok: false, reason: 'Plus de joker ce mois-ci.' };
  if (used.includes(addDays(k, -1)) || used.includes(addDays(k, 1))) return { ok: false, reason: 'Jamais deux jokers de suite : la règle qui protège ta constance.' };
  return { ok: true };
}
export const useJoker = (d: AppData, k: string): AppData => canUseJoker(d, k).ok ? { ...d, streakJokers: [...(d.streakJokers || []), k] } : d;

/** Un jour « tenu » pour la série : 100 %, ou jour difficile avec au moins une tâche faite. */
export const dayKept = (d: AppData, k: string, rate: number | null, done: number) => rate === 100 || (isHardDay(d, k) && done > 0);
/** Jour protégé par un joker : il ne casse pas la série et ne la prolonge pas. */
export const dayProtected = (d: AppData, k: string) => (d.streakJokers || []).includes(k);

// ---------- Identité et votes ----------
export const activeIdentities = (d: AppData): Identity[] => (d.identities || []).filter(i => !i.deleted);
export const addIdentity = (d: AppData, text: string): AppData => ({ ...d, identities: [...(d.identities || []), { id: generateId(), text: text.trim(), createdAt: new Date().toISOString() }] });
export const removeIdentity = (d: AppData, id: string): AppData => ({ ...d, identities: (d.identities || []).map(i => i.id === id ? { ...i, deleted: true } : i) });

/** Chaque tâche cochée reliée à une identité = un vote (une fois par tâche et par jour). */
export function identityVotes(d: AppData): Record<string, number> {
  const seen = new Set<string>(); const out: Record<string, number> = {};
  const scan = (tasks: Task[]) => tasks.forEach(t => {
    if (t.identityId) (t.completedDates || []).forEach(k => { const key = `${t.id}|${k}`; if (!seen.has(key)) { seen.add(key); out[t.identityId!] = (out[t.identityId!] || 0) + 1; } });
    if (t.subTasks?.length) scan(t.subTasks);
  });
  d.blocks.forEach(b => scan(b.tasks));
  Object.values(d.days).forEach(day => day.blocks?.forEach(b => scan(b.tasks)));
  return out;
}

/** Modifie une tâche dans le plan ET dans toutes les copies de jours (champs « de fond » : pourquoi, identité, version minimale). */
export function patchTaskEverywhere(d: AppData, taskId: string, fields: Partial<Task>): AppData {
  const upd = (tasks: Task[]): Task[] => tasks.map(t => t.id === taskId ? { ...t, ...fields } : t.subTasks?.length ? { ...t, subTasks: upd(t.subTasks) } : t);
  const ub = (bs: Block[]) => bs.map(b => ({ ...b, tasks: upd(b.tasks) }));
  const days = { ...d.days };
  Object.keys(days).forEach(k => { if (days[k]?.blocks) days[k] = { ...days[k], blocks: ub(days[k].blocks!) }; });
  return { ...d, blocks: ub(d.blocks), days, inboxTasks: upd(d.inboxTasks || []) };
}

// ---------- Paliers de maîtrise ----------
export type MasteryKey = 'seed' | 'sprout' | 'tree' | 'forest';
export interface Mastery { key: MasteryKey; label: string; min: number; next: { label: string; at: number } | null; progress: number; days: number }
const LEVELS: { key: MasteryKey; label: string; min: number }[] = [
  { key: 'seed', label: 'Graine', min: 0 }, { key: 'sprout', label: 'Pousse', min: 7 }, { key: 'tree', label: 'Arbre', min: 21 }, { key: 'forest', label: 'Forêt', min: 66 },
];
export function mastery(daysDone: number): Mastery {
  let i = 0; LEVELS.forEach((l, j) => { if (daysDone >= l.min) i = j; });
  const cur = LEVELS[i], nxt = LEVELS[i + 1];
  const progress = nxt ? Math.min(1, (daysDone - cur.min) / (nxt.min - cur.min)) : 1;
  return { key: cur.key, label: cur.label, min: cur.min, next: nxt ? { label: nxt.label, at: nxt.min } : null, progress, days: daysDone };
}
export const MASTERY_STEPS = LEVELS;

// ---------- Cartes surprises (journées parfaites) ----------
export interface CardDef { id: string; kind: 'quote' | 'badge'; rarity: 'commune' | 'rare' | 'légendaire'; title: string; text: string }
export const CARDS: CardDef[] = [
  { id: 'q1', kind: 'quote', rarity: 'commune', title: 'Pensée', text: 'Ce que tu fais chaque jour compte plus que ce que tu fais de temps en temps.' },
  { id: 'q2', kind: 'quote', rarity: 'commune', title: 'Pensée', text: 'Une journée parfaite n’est pas un hasard : c’est une décision tenue heure après heure.' },
  { id: 'q3', kind: 'quote', rarity: 'commune', title: 'Pensée', text: 'Tu viens de prouver que tu peux. Demain, tu sauras que tu peux encore.' },
  { id: 'q4', kind: 'quote', rarity: 'commune', title: 'Pensée', text: 'La discipline d’aujourd’hui est la liberté de demain.' },
  { id: 'q5', kind: 'quote', rarity: 'commune', title: 'Pensée', text: 'Les promesses tenues envers soi-même construisent la confiance la plus solide.' },
  { id: 'q6', kind: 'quote', rarity: 'rare', title: 'Pensée rare', text: 'On ne trouve pas le temps : on le choisit, une tâche après l’autre.' },
  { id: 'q7', kind: 'quote', rarity: 'rare', title: 'Pensée rare', text: 'Tu n’as pas suivi ta motivation aujourd’hui. Tu as suivi ton engagement. C’est plus fort.' },
  { id: 'q8', kind: 'quote', rarity: 'rare', title: 'Pensée rare', text: 'Chaque journée tenue est une brique. Tu es en train de bâtir quelque chose de grand.' },
  { id: 'q9', kind: 'quote', rarity: 'légendaire', title: 'Pensée légendaire', text: 'La personne que tu veux devenir te remercie déjà pour cette journée.' },
  { id: 'b1', kind: 'badge', rarity: 'commune', title: 'Badge · Journée tenue', text: 'Tout ce qui était prévu a été fait. Simple, et immense.' },
  { id: 'b2', kind: 'badge', rarity: 'commune', title: 'Badge · Esprit clair', text: 'Une journée sans rien laisser traîner : l’esprit léger ce soir.' },
  { id: 'b3', kind: 'badge', rarity: 'rare', title: 'Badge · Maître du temps', text: 'Tu as dirigé ta journée au lieu de la subir.' },
  { id: 'b4', kind: 'badge', rarity: 'rare', title: 'Badge · Parole tenue', text: 'Ce que tu as promis ce matin, tu l’as tenu ce soir.' },
  { id: 'b5', kind: 'badge', rarity: 'rare', title: 'Badge · Inarrêtable', text: 'Ni la fatigue ni les imprévus ne t’ont arrêté·e aujourd’hui.' },
  { id: 'b6', kind: 'badge', rarity: 'légendaire', title: 'Badge · Bâtisseur', text: 'Réservé aux journées où tout s’aligne. Rare, comme toi aujourd’hui.' },
];
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/** Tirage du jour (stable) : une carte environ 2 journées parfaites sur 3, rareté pondérée. */
export function drawCard(k: string): CardDef | null {
  const r = hash(k + ':card') % 100;
  if (r >= 66) return null;
  const roll = hash(k + ':rarity') % 100;
  const rarity = roll < 8 ? 'légendaire' : roll < 35 ? 'rare' : 'commune';
  const pool = CARDS.filter(c => c.rarity === rarity);
  return pool[hash(k + ':pick') % pool.length];
}
export const addReward = (d: AppData, card: CardDef, k: string): AppData =>
  (d.rewards || []).some(r => r.date === k) ? d : { ...d, rewards: [...(d.rewards || []), { id: generateId(), cardId: card.id, date: k } as RewardCard] };

// ---------- Proposition de joker après une série cassée ----------
import { computeDay, perfectStreak } from './analytics';
/** Hier a cassé une série d'au moins 2 jours, sans jour difficile ni joker : on propose un joker. */
export function jokerOffer(d: AppData, todayKey: string): { date: string; streak: number; left: number; ok: boolean; reason?: string } | null {
  const y = addDays(todayKey, -1);
  const day = computeDay(d, y, todayKey);
  if (day.rate === null || dayKept(d, y, day.rate, day.done) || dayProtected(d, y)) return null;
  const before = perfectStreak(d, y).current; // série jusqu'à avant-hier (hier est traité comme « en cours »)
  if (before < 2) return null;
  const c = canUseJoker(d, y);
  return { date: y, streak: before, left: jokersLeft(d, y), ok: c.ok, reason: c.reason };
}
