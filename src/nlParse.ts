import { RecurrenceType } from './types';
import { getKeyFromDate } from './utils';

export interface ParsedCapture {
  title: string;
  specificDate?: string;
  startTime?: string;
  priority?: 'high' | 'medium' | 'low';
  recurrence?: RecurrenceType;
}

const WEEKDAYS: Record<string, number> = {
  dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
};

// Analyse "Appeler Paul demain 15h p1" ou "Sport chaque mardi 7h30"
export function parseCapture(input: string): ParsedCapture {
  let text = ' ' + input.trim() + ' ';
  const result: ParsedCapture = { title: input.trim() };

  const strip = (re: RegExp) => { text = text.replace(re, ' '); };

  // Priorité : p1/p2/p3 ou !haute/!moyenne/!basse
  if (/\bp1\b|!haute?\b/i.test(text)) { result.priority = 'high'; strip(/\bp1\b|!haute?\b/gi); }
  else if (/\bp3\b|!basse?\b/i.test(text)) { result.priority = 'low'; strip(/\bp3\b|!basse?\b/gi); }
  else if (/\bp2\b|!moyenne?\b/i.test(text)) { result.priority = 'medium'; strip(/\bp2\b|!moyenne?\b/gi); }

  // Récurrence : "chaque <jour>", "tous les jours", "en semaine", "week-end"
  if (/\btous les jours\b|\bchaque jour\b/i.test(text)) { result.recurrence = 'daily'; strip(/\btous les jours\b|\bchaque jour\b/gi); }
  else if (/\ben semaine\b/i.test(text)) { result.recurrence = 'weekdays'; strip(/\ben semaine\b/gi); }
  else if (/\bweek-?end\b/i.test(text)) { result.recurrence = 'weekends'; strip(/\bweek-?end\b/gi); }
  else {
    const rec = text.match(/\bchaque\s+(dimanche|lundi|mardi|mercredi|jeudi|vendredi|samedi)\b/i);
    if (rec) {
      // Récurrence hebdo un jour précis : on approxime avec la date du prochain jour concerné
      result.recurrence = 'daily'; // pas de "weekly single day" natif → on garde daily + date
      const target = nextWeekday(WEEKDAYS[rec[1].toLowerCase()]);
      result.specificDate = getKeyFromDate(target);
      strip(/\bchaque\s+(dimanche|lundi|mardi|mercredi|jeudi|vendredi|samedi)\b/gi);
    }
  }

  // Dates relatives
  if (!result.specificDate) {
    if (/\baujourd'?hui\b/i.test(text)) { result.specificDate = getKeyFromDate(new Date()); strip(/\baujourd'?hui\b/gi); }
    else if (/\bdemain\b/i.test(text)) { const d = new Date(); d.setDate(d.getDate() + 1); result.specificDate = getKeyFromDate(d); strip(/\bdemain\b/gi); }
    else if (/\baprès-?demain\b/i.test(text)) { const d = new Date(); d.setDate(d.getDate() + 2); result.specificDate = getKeyFromDate(d); strip(/\baprès-?demain\b/gi); }
    else {
      const wd = text.match(/\b(dimanche|lundi|mardi|mercredi|jeudi|vendredi|samedi)\b/i);
      if (wd) { result.specificDate = getKeyFromDate(nextWeekday(WEEKDAYS[wd[1].toLowerCase()])); strip(/\b(dimanche|lundi|mardi|mercredi|jeudi|vendredi|samedi)\b/gi); }
    }
  }

  // Heure : "15h", "15h30", "8:00", "à 9h"
  const time = text.match(/\b(\d{1,2})\s*[h:]\s*(\d{2})?\b/i);
  if (time) {
    const h = parseInt(time[1]);
    const m = time[2] ? parseInt(time[2]) : 0;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      result.startTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      strip(/\bà\s+/gi);
      strip(/\b\d{1,2}\s*[h:]\s*\d{2}?\b/i);
    }
  }

  result.title = text.replace(/\s+/g, ' ').trim() || input.trim();
  return result;
}

function nextWeekday(target: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const diff = (target - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}
