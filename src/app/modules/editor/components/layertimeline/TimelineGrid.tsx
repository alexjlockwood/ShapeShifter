import { useServices } from 'app/modules/editor/context/EditorContext';
import { requireRef } from 'app/modules/editor/hooks/requireRef';
import { useStoreEffect } from 'app/modules/editor/hooks/useStoreEffect';
import type { Animation } from 'app/modules/editor/model/timeline';
import { getCurrentTime } from 'app/modules/editor/store/playback/selectors';
import { getThemeType } from 'app/modules/editor/store/theme/selectors';
import { useLayoutEffect, useRef } from 'react';

import { type ScrubEvent, TimelineGridRenderer } from './TimelineGridRenderer';

interface TimelineGridProps {
  readonly className: string;
  readonly isHeader: boolean;
  readonly animation: Animation;
  readonly horizZoom: number;
  readonly onScrub?: (event: ScrubEvent) => void;
}

export function TimelineGrid({
  className,
  isHeader,
  animation,
  horizZoom,
  onScrub,
}: TimelineGridProps) {
  const { themeService } = useServices();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<TimelineGridRenderer>(undefined);

  useLayoutEffect(() => {
    const canvas = requireRef(canvasRef);
    const renderer = new TimelineGridRenderer(canvas, isHeader, themeService);
    rendererRef.current = renderer;
    // Redraw whenever the canvas is resized (e.g. by the timeline's splitter).
    const observer = new ResizeObserver(() => renderer.redraw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [isHeader, themeService]);

  // The effect above creates the renderer before any of the code below runs.
  useLayoutEffect(() => {
    const renderer = rendererRef.current;
    if (renderer) {
      renderer.animation = animation;
      renderer.horizZoom = horizZoom;
    }
  }, [animation, horizZoom]);

  useStoreEffect(getCurrentTime, currentTime => {
    const renderer = rendererRef.current;
    if (renderer) {
      renderer.currentTime = currentTime;
    }
  });

  useStoreEffect(getThemeType, () => rendererRef.current?.redraw());

  return (
    <canvas
      ref={canvasRef}
      className={className}
      onMouseDown={
        onScrub &&
        (event => {
          event.preventDefault();
          rendererRef.current?.startScrubbing(event.nativeEvent, onScrub);
        })
      }
      // Clicks on the grid shouldn't clear the current selection.
      onClick={event => event.stopPropagation()}
    />
  );
}
