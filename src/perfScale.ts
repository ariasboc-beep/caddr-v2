// Échelle unique pour les taux de réalisation (0 à 100 %), dans la charte Caddr :
// teal plein = excellent, teal atténué = correct, crimson = à renforcer (alerte).
export interface PerfLevel { min: number; label: string; color: string; text: string }

const CRIMSON = '#DF2935';

export const PERF_LEVELS: PerfLevel[] = [
  { min: 80, label: 'Excellent', color: 'var(--accent)', text: 'var(--accent-text)' },
  { min: 50, label: 'Correct', color: 'rgb(var(--accent-rgb) / 0.45)', text: 'color-mix(in srgb, var(--accent-text) 75%, transparent)' },
  { min: 0, label: 'À renforcer', color: 'rgb(223 41 53 / 0.8)', text: CRIMSON },
];

export const perfLevel = (rate: number | null | undefined): PerfLevel | null =>
  rate === null || rate === undefined || isNaN(rate) ? null : PERF_LEVELS.find(l => rate >= l.min) || PERF_LEVELS[PERF_LEVELS.length - 1];

/** Couleur de remplissage (barres, cases) ; undefined si pas de donnée */
export const perfColor = (rate: number | null | undefined): string | undefined => perfLevel(rate)?.color;

/** Style d'un chiffre */
export const perfStyle = (rate: number | null | undefined): { color?: string } => { const l = perfLevel(rate); return l ? { color: l.text } : {}; };

export const PERF_LEGEND = [
  { label: '80 % et plus', name: 'Excellent', color: PERF_LEVELS[0].color },
  { label: '50 à 79 %', name: 'Correct', color: PERF_LEVELS[1].color },
  { label: 'moins de 50 %', name: 'À renforcer', color: PERF_LEVELS[2].color },
];

/** Variante en hexadécimal pour les graphiques SVG (recharts) */
export const perfFill = (rate: number | null | undefined, accentHex: string): string | undefined => {
  const l = perfLevel(rate); if (!l) return undefined;
  return l.min >= 80 ? accentHex : l.min >= 50 ? `${accentHex}73` : '#DF2935CC';
};
