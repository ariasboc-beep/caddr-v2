import React, { useCallback, useState } from 'react';

// Lecture / écriture prudentes (navigation privée, stockage bloqué…)
const readNumber = (key: string, fallback: number, min: number) => {
  try { const v = parseInt(localStorage.getItem(key) || '', 10); return v >= min ? v : fallback; } catch { return fallback; }
};
const writeNumber = (key: string, value: number) => {
  try { localStorage.setItem(key, String(value)); } catch {}
};

// Glisser horizontal ou vertical avec la souris ou le doigt
const startDrag = (
  e: React.PointerEvent,
  axis: 'x' | 'y',
  onDelta: (delta: number) => void,
  onEnd: () => void,
) => {
  e.preventDefault();
  e.stopPropagation();
  const start = axis === 'x' ? e.clientX : e.clientY;
  const onMove = (ev: PointerEvent) => onDelta((axis === 'x' ? ev.clientX : ev.clientY) - start);
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    onEnd();
  };
  document.body.style.cursor = axis === 'x' ? 'ew-resize' : 'ns-resize';
  document.body.style.userSelect = 'none';
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
};

/**
 * Largeur d'une fenêtre centrée, redimensionnable par ses bords gauche/droit.
 * La fenêtre étant centrée, déplacer un bord de dx change la largeur de 2*dx.
 * La largeur choisie est mémorisée sur l'appareil (clé localStorage).
 */
export function useResizableWidth(storageKey: string, defaultWidth = 384, minWidth = 320) {
  const [width, setWidth] = useState<number>(() => readNumber(storageKey, defaultWidth, minWidth));

  const startResize = useCallback((e: React.PointerEvent, side: 'left' | 'right') => {
    const startW = width;
    let latest = startW;
    startDrag(e, 'x', (dx) => {
      const max = Math.max(minWidth, window.innerWidth - 32);
      latest = Math.round(Math.min(max, Math.max(minWidth, startW + dx * 2 * (side === 'right' ? 1 : -1))));
      setWidth(latest);
    }, () => writeNumber(storageKey, latest));
  }, [width, storageKey, minWidth]);

  const reset = useCallback(() => { setWidth(defaultWidth); writeNumber(storageKey, defaultWidth); }, [defaultWidth, storageKey]);

  return { width, startResize, reset };
}

/** Hauteur d'une zone (ex. éditeur de notes), étirable par une poignée en bas. */
export function useResizableHeight(storageKey: string, defaultHeight = 200, minHeight = 120) {
  const [height, setHeight] = useState<number>(() => readNumber(storageKey, defaultHeight, minHeight));

  const startResize = useCallback((e: React.PointerEvent) => {
    const startH = height;
    let latest = startH;
    startDrag(e, 'y', (dy) => {
      const max = Math.max(minHeight, window.innerHeight - 260);
      latest = Math.round(Math.min(max, Math.max(minHeight, startH + dy)));
      setHeight(latest);
    }, () => writeNumber(storageKey, latest));
  }, [height, storageKey, minHeight]);

  const reset = useCallback(() => { setHeight(defaultHeight); writeNumber(storageKey, defaultHeight); }, [defaultHeight, storageKey]);

  return { height, startResize, reset };
}

/** Poignées verticales sur les bords gauche et droit d'une fenêtre (masquées sur mobile). */
export function SideResizeHandles({ onStart, onReset }: {
  onStart: (e: React.PointerEvent, side: 'left' | 'right') => void;
  onReset: () => void;
}) {
  return (
    <>
      {(['left', 'right'] as const).map(side => (
        <div
          key={side}
          onPointerDown={(e) => onStart(e, side)}
          onDoubleClick={onReset}
          title="Glisser pour élargir · double-clic pour revenir à la taille d'origine"
          className={`group/resize hidden sm:flex absolute top-0 bottom-0 ${side === 'left' ? '-left-3' : '-right-3'} w-6 cursor-ew-resize items-center justify-center z-10 touch-none`}
        >
          <span className="w-1 h-14 rounded-full bg-[#18181B]/15 dark:bg-[#E6E8E6]/15 group-hover/resize:bg-accent group-hover/resize:h-24 transition-all" />
        </div>
      ))}
    </>
  );
}

/** Poignée horizontale sous une zone, pour l'étirer vers le bas. */
export function BottomResizeHandle({ onStart, onReset }: {
  onStart: (e: React.PointerEvent) => void;
  onReset: () => void;
}) {
  return (
    <div
      onPointerDown={onStart}
      onDoubleClick={onReset}
      title="Glisser pour agrandir la zone · double-clic pour revenir à la taille d'origine"
      className="group/vresize flex h-4 -mt-1 cursor-ns-resize items-center justify-center touch-none"
    >
      <span className="h-1 w-14 rounded-full bg-[#18181B]/15 dark:bg-[#E6E8E6]/15 group-hover/vresize:bg-accent group-hover/vresize:w-24 transition-all" />
    </div>
  );
}
