// Lecture des agendas au format iCalendar (.ics) : Google Agenda, Outlook, iCloud…
// - parseICS : texte .ics → événements simplifiés (heures converties en heure locale)
// - occurrencesBetween : déroule les répétitions (RRULE) sur une période
import type { ExtEventRaw, ExternalCalendar } from './types';

// Fuseaux Windows (Outlook) → fuseaux IANA les plus courants
const WIN_TZ: Record<string, string> = {
  'W. Central Africa Standard Time': 'Africa/Lagos', 'Romance Standard Time': 'Europe/Paris',
  'W. Europe Standard Time': 'Europe/Berlin', 'GMT Standard Time': 'Europe/London', 'Greenwich Standard Time': 'Atlantic/Reykjavik',
  'Central Europe Standard Time': 'Europe/Budapest', 'Central European Standard Time': 'Europe/Warsaw',
  'Eastern Standard Time': 'America/New_York', 'Central Standard Time': 'America/Chicago', 'Mountain Standard Time': 'America/Denver',
  'Pacific Standard Time': 'America/Los_Angeles', 'E. Africa Standard Time': 'Africa/Nairobi', 'South Africa Standard Time': 'Africa/Johannesburg',
  'Morocco Standard Time': 'Africa/Casablanca', 'Egypt Standard Time': 'Africa/Cairo', 'UTC': 'UTC', 'Coordinated Universal Time': 'UTC',
};

const pad = (n: number) => String(n).padStart(2, '0');
export const localIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dayIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Décalage (minutes) d'un fuseau IANA à un instant donné
function tzOffset(tz: string, utcMs: number): number {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p: Record<string, number> = {};
  f.formatToParts(new Date(utcMs)).forEach(x => { if (x.type !== 'literal') p[x.type] = Number(x.value); });
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return (asUtc - utcMs) / 60000;
}

// Heure « murale » dans un fuseau → Date (instant réel)
function zonedToDate(y: number, mo: number, d: number, h: number, mi: number, tz?: string): Date {
  const zone = tz ? (WIN_TZ[tz] || tz) : undefined;
  if (!zone) return new Date(y, mo - 1, d, h, mi);
  try {
    const guess = Date.UTC(y, mo - 1, d, h, mi);
    let off = tzOffset(zone, guess);
    off = tzOffset(zone, guess - off * 60000);
    return new Date(guess - off * 60000);
  } catch {
    return new Date(y, mo - 1, d, h, mi); // fuseau inconnu : heure locale
  }
}

interface Prop { name: string; params: Record<string, string>; value: string }

function parseLine(line: string): Prop | null {
  // NOM;PARAM=VAL;PARAM="VAL":VALEUR  (les « : » entre guillemets ne comptent pas)
  let inQ = false, idx = -1;
  for (let i = 0; i < line.length; i++) { const c = line[i]; if (c === '"') inQ = !inQ; else if (c === ':' && !inQ) { idx = i; break; } }
  if (idx < 0) return null;
  const head = line.slice(0, idx); const value = line.slice(idx + 1);
  const parts = head.split(';');
  const params: Record<string, string> = {};
  parts.slice(1).forEach(p => { const e = p.indexOf('='); if (e > 0) params[p.slice(0, e).toUpperCase()] = p.slice(e + 1).replace(/^"|"$/g, ''); });
  return { name: parts[0].toUpperCase(), params, value };
}

const unescape = (v: string) => v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();

// Valeur de date iCalendar → { iso local, journée entière }
function parseDate(p: Prop): { iso: string; allDay: boolean } | null {
  const v = p.value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (!h || p.params.VALUE === 'DATE') return { iso: `${y}-${mo}-${d}`, allDay: true };
  const date = z ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi)) : zonedToDate(+y, +mo, +d, +h, +mi, p.params.TZID);
  return { iso: localIso(date), allDay: false };
}

function parseDuration(v: string): number { // minutes
  const m = v.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  return ((+(m[2] || 0)) * 7 * 1440) + ((+(m[3] || 0)) * 1440) + ((+(m[4] || 0)) * 60) + (+(m[5] || 0));
}

export function parseICS(text: string): ExtEventRaw[] {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events: ExtEventRaw[] = [];
  const overrides: { uid: string; recId: string; ev: ExtEventRaw }[] = [];
  let cur: Prop[] | null = null; let depth = 0;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line === 'BEGIN:VEVENT') { cur = []; depth = 0; continue; }
    if (!cur) continue;
    if (line.startsWith('BEGIN:')) { depth++; continue; }      // VALARM… ignorés
    if (line.startsWith('END:') && depth > 0) { depth--; continue; }
    if (line === 'END:VEVENT') {
      const get = (n: string) => cur!.find(p => p.name === n);
      const st = get('DTSTART') && parseDate(get('DTSTART')!);
      if (st && (get('STATUS')?.value || '').toUpperCase() !== 'CANCELLED') {
        let end: string | undefined;
        const de = get('DTEND') && parseDate(get('DTEND')!);
        if (de) end = de.iso;
        else if (get('DURATION')) {
          const mins = parseDuration(get('DURATION')!.value);
          const base = new Date(st.iso.length === 10 ? st.iso + 'T00:00' : st.iso);
          base.setMinutes(base.getMinutes() + mins);
          end = st.allDay ? dayIso(base) : localIso(base);
        }
        const exdates: string[] = [];
        cur.filter(p => p.name === 'EXDATE').forEach(p => p.value.split(',').forEach(v => { const r = parseDate({ ...p, value: v }); if (r) exdates.push(r.iso); }));
        const ev: ExtEventRaw = {
          uid: get('UID')?.value || `${st.iso}-${Math.random().toString(36).slice(2, 8)}`,
          title: unescape(get('SUMMARY')?.value || '(Sans titre)'),
          start: st.iso, end, allDay: st.allDay,
          location: get('LOCATION') ? unescape(get('LOCATION')!.value) : undefined,
          rrule: get('RRULE')?.value, exdates: exdates.length ? exdates : undefined,
        };
        const rec = get('RECURRENCE-ID') && parseDate(get('RECURRENCE-ID')!);
        if (rec) overrides.push({ uid: ev.uid, recId: rec.iso, ev: { ...ev, uid: `${ev.uid}#${rec.iso}`, rrule: undefined } });
        else events.push(ev);
      }
      cur = null; continue;
    }
    if (depth === 0) { const p = parseLine(line); if (p) cur.push(p); }
  }
  // Occurrence modifiée : on exclut l'originale et on ajoute la version modifiée
  overrides.forEach(o => {
    const master = events.find(e => e.uid === o.uid);
    if (master) master.exdates = [...(master.exdates || []), o.recId];
    events.push(o.ev);
  });
  return events;
}

/** Garde ce qui peut encore servir (répétitions, et événements depuis `sinceDays` jours). */
export function trimEvents(events: ExtEventRaw[], sinceDays = 60, max = 2500): ExtEventRaw[] {
  const lim = new Date(); lim.setDate(lim.getDate() - sinceDays);
  const limIso = dayIso(lim);
  return events.filter(e => e.rrule || (e.end || e.start).slice(0, 10) >= limIso).slice(0, max);
}

// ---------- Répétitions ----------
const DOW: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function parseRule(rule: string) {
  const r: Record<string, string> = {};
  rule.split(';').forEach(kv => { const [k, v] = kv.split('='); if (k && v) r[k.toUpperCase()] = v; });
  return r;
}

const toDate = (iso: string) => iso.length === 10 ? new Date(iso + 'T00:00') : new Date(iso);

export interface Occurrence { uid: string; title: string; start: Date; end: Date; allDay: boolean; location?: string; calendarId: string; calendarName: string; color: string }

export function occurrencesBetween(cals: ExternalCalendar[], eventsOf: (c: ExternalCalendar) => ExtEventRaw[], from: Date, to: Date): Occurrence[] {
  const out: Occurrence[] = [];
  cals.filter(c => !c.hidden).forEach(c => {
    eventsOf(c).forEach(e => {
      const s0 = toDate(e.start);
      const e0 = e.end ? toDate(e.end) : new Date(s0.getTime() + (e.allDay ? 86400000 : 3600000));
      const len = Math.max(e.allDay ? 86400000 : 15 * 60000, e0.getTime() - s0.getTime());
      const push = (s: Date) => {
        const en = new Date(s.getTime() + len);
        if (en > from && s < to) out.push({ uid: `${e.uid}@${s.getTime()}`, title: e.title, start: s, end: en, allDay: !!e.allDay, location: e.location, calendarId: c.id, calendarName: c.name, color: c.color });
      };
      if (!e.rrule) { push(s0); return; }
      const r = parseRule(e.rrule);
      const freq = r.FREQ; const interval = Math.max(1, +(r.INTERVAL || 1));
      const count = r.COUNT ? +r.COUNT : Infinity;
      const until = r.UNTIL ? (() => { const m = r.UNTIL.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/); if (!m) return null; return m[7] ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 23), +(m[5] || 59))) : new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 23), +(m[5] || 59)); })() : null;
      const ex = new Set((e.exdates || []).map(x => x.slice(0, e.allDay ? 10 : 16)));
      const byDay = (r.BYDAY || '').split(',').filter(Boolean).map(x => { const m = x.match(/^([+-]?\d+)?([A-Z]{2})$/); return m ? { n: m[1] ? +m[1] : 0, d: DOW[m[2]] } : null; }).filter(Boolean) as { n: number; d: number }[];
      const byMonthDay = (r.BYMONTHDAY || '').split(',').filter(Boolean).map(Number);
      const h = s0.getHours(), mi = s0.getMinutes();
      let n = 0, guard = 0;
      const emit = (d: Date) => {
        if (d < s0) return true;
        if (until && d > until) return false;
        if (n >= count) return false;
        n++;
        const k = e.allDay ? dayIso(d) : localIso(d);
        if (!ex.has(k)) push(d);
        return d < to;
      };
      const at = (y: number, m: number, day: number) => new Date(y, m, day, h, mi);
      if (freq === 'DAILY') {
        for (let d = new Date(s0); guard++ < 5000; d = at(d.getFullYear(), d.getMonth(), d.getDate() + interval)) {
          if (byDay.length && !byDay.some(b => b.d === d.getDay())) { if (d > to || (until && d > until)) break; continue; }
          if (!emit(d)) break;
        }
      } else if (freq === 'WEEKLY') {
        const days = byDay.length ? byDay.map(b => b.d) : [s0.getDay()];
        const wk = at(s0.getFullYear(), s0.getMonth(), s0.getDate() - ((s0.getDay() + 6) % 7)); // lundi
        outer: for (let w = 0; guard++ < 3000; w += interval) {
          const order = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
          for (const dd of order) {
            const d = at(wk.getFullYear(), wk.getMonth(), wk.getDate() + w * 7 + ((dd + 6) % 7));
            if (!emit(d)) break outer;
          }
        }
      } else if (freq === 'MONTHLY') {
        for (let mo = 0; guard++ < 1200; mo += interval) {
          const y = s0.getFullYear(), m = s0.getMonth() + mo;
          const first = new Date(y, m, 1); const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
          let cands: number[] = [];
          if (byMonthDay.length) cands = byMonthDay.map(x => x < 0 ? dim + 1 + x : x).filter(x => x >= 1 && x <= dim);
          else if (byDay.length) {
            byDay.forEach(b => {
              const all: number[] = []; for (let dd = 1; dd <= dim; dd++) if (new Date(first.getFullYear(), first.getMonth(), dd).getDay() === b.d) all.push(dd);
              if (b.n > 0) { if (all[b.n - 1]) cands.push(all[b.n - 1]); } else if (b.n < 0) { if (all[all.length + b.n]) cands.push(all[all.length + b.n]); } else cands.push(...all);
            });
          } else if (s0.getDate() <= dim) cands = [s0.getDate()];
          let stop = false;
          for (const dd of cands.sort((a, b) => a - b)) { if (!emit(at(first.getFullYear(), first.getMonth(), dd))) { stop = true; break; } }
          if (stop) break;
        }
      } else if (freq === 'YEARLY') {
        for (let yy = 0; guard++ < 200; yy += interval) {
          const d = at(s0.getFullYear() + yy, s0.getMonth(), s0.getDate());
          if (d.getMonth() !== s0.getMonth()) continue; // 29 février
          if (!emit(d)) break;
        }
      } else push(s0);
    });
  });
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

// ---------- Cache local des agendas par adresse (non synchronisé) ----------
const CACHE = (id: string) => `caddr_cal_${id}`;
export function cachedEvents(id: string): { events: ExtEventRaw[]; at: number } | null {
  try { const v = localStorage.getItem(CACHE(id)); return v ? JSON.parse(v) : null; } catch { return null; }
}
export function storeEvents(id: string, events: ExtEventRaw[]) {
  try { localStorage.setItem(CACHE(id), JSON.stringify({ events, at: Date.now() })); } catch { /* stockage plein ou bloqué */ }
}
export function dropCache(id: string) { try { localStorage.removeItem(CACHE(id)); } catch { /* rien */ } }

const PROD_SITE = 'https://caddr-v2.netlify.app';
export async function fetchCalendar(url: string): Promise<ExtEventRaw[]> {
  const isDesktop = typeof window !== 'undefined' && !window.location.protocol.startsWith('http');
  const res = await fetch(`${isDesktop ? PROD_SITE : ''}/.netlify/functions/calendar?url=${encodeURIComponent(url.trim())}`);
  const text = await res.text();
  if (!res.ok) { let msg = 'Agenda inaccessible.'; try { msg = JSON.parse(text).message || msg; } catch { /* texte brut */ } throw new Error(msg); }
  return trimEvents(parseICS(text));
}
