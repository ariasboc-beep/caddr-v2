// Relais pour lire un agenda externe au format iCalendar (.ics) : Google Agenda,
// Outlook, iCloud… Le navigateur ne peut pas lire ces adresses directement (CORS).
// Sécurité : https uniquement, pas d'adresse interne, réponse obligatoirement au
// format iCalendar, taille et durée limitées, nombre de requêtes limité par IP.

import { lookup } from 'node:dns/promises';

const MAX_BYTES = 5_000_000;
const RATE_MAX = 30;            // requêtes
const RATE_WINDOW_MS = 60_000;  // par minute
const hits = new Map<string, number[]>();

function rateLimited(ip: string) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every(t => now - t >= RATE_WINDOW_MS)) hits.delete(k);
  return arr.length > RATE_MAX;
}

// Refuse les adresses locales / privées (empêche d'utiliser le relais vers l'intérieur)
export function isForbiddenHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (!h || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (/^\d+$/.test(h)) return true; // IP en notation décimale
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [+v4[1], +v4[2]];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (h.includes(':')) return h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80') || h.startsWith('::ffff:') || h === '::';
  return false;
}

// Le nom de domaine ne doit pas pointer vers une adresse interne
async function resolvesPrivate(host: string): Promise<boolean> {
  try {
    const addrs = await lookup(host, { all: true });
    return addrs.length === 0 || addrs.some(a => isForbiddenHost(a.address));
  } catch { return true; }
}

const json = (obj: unknown, status: number) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req: Request) => {
  if (req.method !== 'GET') return json({ message: 'Méthode non autorisée.' }, 405);
  const ip = req.headers.get('x-nf-client-connection-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) return json({ message: 'Trop de requêtes, réessaie dans une minute.' }, 429);

  const raw = new URL(req.url).searchParams.get('url') || '';
  let target: URL;
  try { target = new URL(raw.trim().replace(/^webcals?:\/\//i, 'https://')); } catch { return json({ message: 'Adresse invalide.' }, 400); }
  if (target.protocol !== 'https:') return json({ message: "L'adresse doit commencer par https:// (ou webcal://)." }, 400);
  if (target.port && target.port !== '443') return json({ message: 'Port non autorisé.' }, 400);
  if (target.username || target.password || isForbiddenHost(target.hostname)) return json({ message: 'Adresse non autorisée.' }, 400);

  if (await resolvesPrivate(target.hostname)) return json({ message: 'Adresse non autorisée ou introuvable.' }, 400);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    let url = target; let res: Response | null = null;
    // Redirections suivies à la main pour revérifier chaque destination
    for (let i = 0; i < 4; i++) {
      res = await fetch(url, { redirect: 'manual', signal: ctrl.signal, headers: { 'User-Agent': 'Caddr-Calendar/1.0', Accept: 'text/calendar, text/plain;q=0.8, */*;q=0.1' } });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        const nextUrl = new URL(res.headers.get('location')!, url);
        if (nextUrl.protocol !== 'https:' || isForbiddenHost(nextUrl.hostname) || await resolvesPrivate(nextUrl.hostname)) return json({ message: 'Redirection non autorisée.' }, 400);
        url = nextUrl; continue;
      }
      break;
    }
    if (!res || !res.ok) return json({ message: `L'agenda a répondu par une erreur (${res?.status ?? '?'}). Vérifie l'adresse : elle doit être l'adresse secrète ou publique au format iCal.` }, 502);
    const len = Number(res.headers.get('content-length') || 0);
    if (len > MAX_BYTES) return json({ message: 'Agenda trop volumineux.' }, 413);
    // Lecture limitée en taille
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = []; let total = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) { ctrl.abort(); return json({ message: 'Agenda trop volumineux.' }, 413); }
        chunks.push(value);
      }
    }
    const buf = new Uint8Array(total); let off = 0; chunks.forEach(c => { buf.set(c, off); off += c.byteLength; });
    const text = new TextDecoder('utf-8').decode(buf);
    if (!/^﻿?\s*BEGIN:VCALENDAR/i.test(text)) return json({ message: "Cette adresse ne renvoie pas un agenda au format iCal (.ics)." }, 415);
    return new Response(text, { status: 200, headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=300' } });
  } catch (e) {
    const aborted = (e as Error)?.name === 'AbortError';
    return json({ message: aborted ? "L'agenda met trop de temps à répondre." : "Impossible de joindre l'agenda." }, 504);
  } finally {
    clearTimeout(timer);
  }
};
