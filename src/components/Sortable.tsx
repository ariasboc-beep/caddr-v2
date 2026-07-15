import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Ligne triable générique : fournit une poignée de drag à ses enfants (render-prop).
export function Sortable({
  id,
  children,
  disabled,
}: {
  id: string;
  disabled?: boolean;
  children: (handle: React.HTMLAttributes<HTMLElement>) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
    position: 'relative',
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ ...listeners, ...attributes } as React.HTMLAttributes<HTMLElement>)}
    </div>
  );
}

export default Sortable;
