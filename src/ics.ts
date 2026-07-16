import { AppData, Block } from './types';
import { getKeyFromDate, isDateInRange } from './utils';

// Génère un fichier .ics (iCalendar) des tâches horodatées sur `days` jours.
// Importable dans Google Calendar, Apple Calendar, Outlook, etc.
export function buildICS(appData: AppData, days = 28): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Caddr//Routine//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Caddr. — Routine',
  ];

  const pad = (n: number) => String(n).padStart(2, '0');
  const esc = (s: string) => s.replace(/[\\;,]/g, (m) => '\\' + m).replace(/\n/g, '\\n');

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    const key = getKeyFromDate(date);

    const blocks: Block[] = appData.days[key]?.blocks
      ? appData.days[key].blocks!
      : appData.blocks.filter((b) => isDateInRange(date, b.recurrence, b.specificDate, b.startDate, b.endDate));

    blocks.forEach((b) => {
      (b.tasks || []).forEach((t) => {
        if (!t.startTime || !isDateInRange(date, t.recurrence, t.specificDate, t.startDate, t.endDate)) return;
        const [h, m] = t.startTime.split(':').map(Number);
        const dtStart = new Date(date);
        dtStart.setHours(h, m, 0, 0);
        const dtEnd = new Date(dtStart.getTime() + (t.duration || 30) * 60000);

        const fmt = (d: Date) =>
          `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

        lines.push(
          'BEGIN:VEVENT',
          `UID:${t.id}-${key}@caddr`,
          `DTSTAMP:${fmt(new Date())}`,
          `DTSTART:${fmt(dtStart)}`,
          `DTEND:${fmt(dtEnd)}`,
          `SUMMARY:${esc(t.title)}`,
          `DESCRIPTION:${esc(b.title)}`,
          'END:VEVENT'
        );
      });
    });
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadICS(appData: AppData) {
  const blob = new Blob([buildICS(appData)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'caddr-routine.ics';
  a.click();
  URL.revokeObjectURL(url);
}
