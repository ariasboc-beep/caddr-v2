// Chargement à la demande d'un onglet. Après une mise à jour de l'app, un ancien
// fichier peut avoir disparu : on recharge alors la page une seule fois.
import { lazy, ComponentType } from 'react';

export function lazyRetry<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const m = await load();
      try { sessionStorage.removeItem('caddr_chunk_reload'); } catch { /* rien */ }
      return m;
    } catch (e) {
      let already = false;
      try { already = sessionStorage.getItem('caddr_chunk_reload') === '1'; sessionStorage.setItem('caddr_chunk_reload', '1'); } catch { /* rien */ }
      if (!already) { window.location.reload(); return new Promise<{ default: T }>(() => { /* rechargement */ }); }
      throw e;
    }
  });
}

// Précharge les onglets en arrière-plan (ils seront disponibles hors ligne)
export function prefetchTabs(loaders: (() => Promise<unknown>)[]) {
  const run = () => loaders.forEach(l => l().catch(() => { /* hors ligne : plus tard */ }));
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 8000 }); else setTimeout(run, 4000);
}
