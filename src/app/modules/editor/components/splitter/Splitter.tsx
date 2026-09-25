import { getContentSize, setContentSize } from 'app/modules/editor/scripts/dom';
import { Dragger } from 'app/modules/editor/scripts/dragger';
import { type MouseEvent, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';

import './splitter.scss';

type Edge = 'left' | 'right' | 'top';

interface SplitterProps {
  readonly edge: Edge;
  readonly min?: number;
  // Used to save the size across page loads.
  readonly persistId?: string;
}

/**
 * Resizes its parent element when dragged. The splitter should be placed along the parent's
 * specified edge.
 */
export function Splitter({ edge, min = 100, persistId }: SplitterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const orientation = edge === 'left' || edge === 'right' ? 'vertical' : 'horizontal';
  const dimension = orientation === 'vertical' ? 'width' : 'height';
  const persistKey = persistId ? `$$splitter::${persistId}` : undefined;

  const setSize = (size: number) => {
    if (persistKey) {
      localStorage[persistKey] = size;
    }
    setContentSize(ref.current.parentElement, dimension, size);
  };

  // Restore the size from the last session, if there is one.
  const restoreSize = useEffectEvent(() => {
    if (persistKey && persistKey in localStorage) {
      setSize(Number(localStorage[persistKey]));
    }
  });
  useLayoutEffect(() => restoreSize(), []);

  const onMouseDown = (event: MouseEvent) => {
    const downSize = getContentSize(ref.current.parentElement, dimension);
    event.preventDefault();
    setIsDragging(true);
    new Dragger({
      downX: event.clientX,
      downY: event.clientY,
      direction: orientation === 'vertical' ? 'horizontal' : 'vertical',
      draggingCursor: orientation === 'vertical' ? 'col-resize' : 'row-resize',
      onDragFn: (_, p) => {
        const sign = edge === 'left' || edge === 'top' ? -1 : 1;
        const d = orientation === 'vertical' ? p.x : p.y;
        setSize(Math.max(min, downSize + sign * d));
      },
      onDropFn: () => setIsDragging(false),
    });
  };

  return (
    <div
      ref={ref}
      className={`app-splitter splt-${orientation} splt-edge-${edge}`}
      style={{ backgroundColor: isDragging || isHovering ? 'rgba(0, 0, 0, 0.1)' : 'transparent' }}
      onMouseDown={onMouseDown}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    />
  );
}
