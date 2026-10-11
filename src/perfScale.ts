// Échelle de couleur unique pour tous les taux de réalisation (0 à 100 %).
// Un même chiffre a toujours la même couleur, partout dans l'app.
export interface PerfLevel { min: number; label: string; color: string }

export const PERF_LEVELS: PerfLevel[] = [
  { min: 80, label: 'Excellent', color: '#16a34a' },   // vert
  { min: 60, label: 'Bon', color: '#84b11c' },          // vert clair
  { min: 40, label: 'Moyen', color: '#e8930c' },        // orange
  { min: 0, label: 'Faible', color: '#e5383b' },        // rouge
];

export const perfLevel = (rate: number | null | undefined): PerfLevel | null =>
  rate === null || rate === undefined || isNaN(rate) ? null : PERF_LEVELS.find(l => rate >= l.min) || PERF_LEVELS[PERF_LEVELS.length - 1];

/** Couleur d'un taux ; undefined si pas de donnée (on garde alors la couleur du texte) */
export const perfColor = (rate: number | null | undefined): string | undefined => perfLevel(rate)?.color;

/** Style prêt à l'emploi pour un chiffre */
export const perfStyle = (rate: number | null | undefined): { color?: string } => { const c = perfColor(rate); return c ? { color: c } : {}; };

export const PERF_LEGEND = [
  { label: '80 % et plus', name: 'Excellent', color: PERF_LEVELS[0].color },
  { label: '60 à 79 %', name: 'Bon', color: PERF_LEVELS[1].color },
  { label: '40 à 59 %', name: 'Moyen', color: PERF_LEVELS[2].color },
  { label: 'moins de 40 %', name: 'Faible', color: PERF_LEVELS[3].color },
];
