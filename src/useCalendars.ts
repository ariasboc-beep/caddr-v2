// Chargement des agendas externes (adresse ICS) avec cache local et actualisation.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExternalCalendar, ExtEventRaw } from './types';
import { cachedEvents, fetchCalendar, storeEvents } from './icsImport';

const STALE_MS = 30 * 60 * 1000; // 30 min

export function useCalendars(calendars: ExternalCalendar[]) {
  const [version, setVersion] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const inFlight = useRef(new Set<string>());

  const load = useCallback(async (cal: ExternalCalendar, force = false) => {
    if (!cal.url || inFlight.current.has(cal.id)) return;
    const cached = cachedEvents(cal.id);
    if (!force && cached && Date.now() - cached.at < STALE_MS) return;
    inFlight.current.add(cal.id);
    setLoading(l => ({ ...l, [cal.id]: true }));
    try {
      const events = await fetchCalendar(cal.url);
      storeEvents(cal.id, events);
      setErrors(e => { const n = { ...e }; delete n[cal.id]; return n; });
      setVersion(v => v + 1);
    } catch (err) {
      setErrors(e => ({ ...e, [cal.id]: (err as Error)?.message || 'Agenda inaccessible.' }));
    } finally {
      inFlight.current.delete(cal.id);
      setLoading(l => ({ ...l, [cal.id]: false }));
    }
  }, []);

  const urls = calendars.filter(c => c.url && !c.hidden).map(c => c.id + c.url).join('|');
  useEffect(() => {
    calendars.forEach(c => { if (c.url && !c.hidden) load(c); });
    const t = window.setInterval(() => calendars.forEach(c => { if (c.url && !c.hidden) load(c); }), STALE_MS);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls, load]);

  const eventsOf = useCallback((c: ExternalCalendar): ExtEventRaw[] => c.events || cachedEvents(c.id)?.events || [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]);

  const lastSync = (id: string) => cachedEvents(id)?.at;

  return { version, errors, loading, eventsOf, refresh: (c: ExternalCalendar) => load(c, true), lastSync, bump: () => setVersion(v => v + 1) };
}
