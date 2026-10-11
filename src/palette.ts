// Charte de couleurs Caddr : teal (couleur principale), or, crimson, gris, blanc, noir.
// Teal = action et réussite · Or = récompenses (séries, records, XP, priorités) · Crimson = alertes, à petite dose.
export const GOLD = '#FDCA40';
export const CRIMSON = '#DF2935';
export const GREY = '#8A8A93';

/** Couleurs proposées pour les habitudes, blocs et calendriers ('' = couleur d'accent) */
export const BRAND_SWATCHES = ['', GOLD, CRIMSON, GREY];

/** Ramène toute couleur ancienne (bleu, violet, vert…) dans la charte */
export const brandColor = (c: string | undefined, accent: string): string =>
  !c ? accent : [GOLD, CRIMSON, GREY].includes(c.toUpperCase()) ? c.toUpperCase() : accent;
