// Sauvegardes automatiques locales (IndexedDB) : une copie par jour (14 derniers jours)
// et une par semaine (8 dernières semaines), sur cet appareil. Indépendant du cloud :
// protège contre une fausse manipulation ou une synchronisation qui écraserait des données.
import type { AppData } from './types';
import { getKeyFromDate } from './utils';
import { getWeekKey } from './streaks';

const DB = 'caddr-backups', STORE = 'snapshots';
export interface Snapshot { id: string; kind: 'day' | 'week'; at: string; size: number; counts: { blocks: number; days: number; journal: number; habits: number }; data: string }
export type SnapshotMeta = Omit<Snapshot, 'data'>;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB indisponible')); return; }
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'id' }); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
const tx = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> => {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode); const st = t.objectStore(STORE);
    const req = fn(st);
    t.oncomplete = () => { resolve(req ? (req as IDBRequest<T>).result : undefined); db.close(); };
    t.onerror = () => { reject(t.error); db.close(); };
  });
};

const countsOf = (d: AppData) => ({ blocks: d.blocks?.length || 0, days: Object.keys(d.days || {}).length, journal: Object.keys(d.journal || {}).length, habits: (d.habits || []).filter(h => !h.deleted).length });
// Une copie vide ne doit jamais remplacer une copie pleine
const isEmpty = (d: AppData) => !d.blocks?.length && !Object.keys(d.days || {}).length && !Object.keys(d.journal || {}).length;

/** Enregistre (ou met à jour) la copie du jour et celle de la semaine, puis élague les anciennes. */
export async function snapshot(data: AppData): Promise<void> {
  if (isEmpty(data)) return;
  const now = new Date();
  const json = JSON.stringify(data);
  const base = { at: now.toISOString(), size: json.length, counts: countsOf(data), data: json };
  await tx('readwrite', s => { s.put({ id: `day:${getKeyFromDate(now)}`, kind: 'day', ...base }); });
  await tx('readwrite', s => { s.put({ id: `week:${getWeekKey(now)}`, kind: 'week', ...base }); });
  const all = await listSnapshots();
  const old = [...all.filter(x => x.kind === 'day').slice(14), ...all.filter(x => x.kind === 'week').slice(8)];
  for (const o of old) await tx('readwrite', s => { s.delete(o.id); });
}

export async function listSnapshots(): Promise<SnapshotMeta[]> {
  const all = (await tx<Snapshot[]>('readonly', s => s.getAll())) || [];
  return all.map(({ data: _d, ...m }) => m).sort((a, b) => b.at.localeCompare(a.at));
}

export async function readSnapshot(id: string): Promise<AppData | null> {
  const s = await tx<Snapshot>('readonly', st => st.get(id));
  return s ? JSON.parse(s.data) as AppData : null;
}
