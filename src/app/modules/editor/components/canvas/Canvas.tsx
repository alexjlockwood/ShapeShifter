import { useEditorStore, useServices } from 'app/modules/editor/context/EditorContext';
import { requireRef } from 'app/modules/editor/hooks/requireRef';
import { ActionSource } from 'app/modules/editor/model/actionmode';
import { useLayoutEffect, useRef } from 'react';

import './canvas.scss';
import { CanvasController } from './CanvasController';

interface CanvasProps {
  readonly actionSource: ActionSource;
  readonly className?: string;
}

export function Canvas({ actionSource, className }: CanvasProps) {
  const store = useEditorStore();
  const services = useServices();
  const rootRef = useRef<HTMLDivElement>(null);
  const artboardRef = useRef<HTMLDivElement>(null);
  const horizontalRulerRef = useRef<HTMLCanvasElement>(null);
  const verticalRulerRef = useRef<HTMLCanvasElement>(null);
  const rulerCornerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const controller = new CanvasController(
      {
        root: requireRef(rootRef),
        artboard: requireRef(artboardRef),
        horizontalRuler: requireRef(horizontalRulerRef),
        verticalRuler: requireRef(verticalRulerRef),
        rulerCorner: requireRef(rulerCornerRef),
        layers: requireRef(layersRef),
        overlay: requireRef(overlayRef),
      },
      actionSource,
      store,
      services,
    );
    controller.init();
    return () => controller.dispose();
  }, [actionSource, store, services]);

  return (
    <div ref={rootRef} className={className ? `app-canvas ${className}` : 'app-canvas'}>
      {/* The canvases cover the panel and ignore the mouse, so pointer events go to the artboard
          under them (CanvasController listens to them), and clicks around it still reach the
          workspace. */}
      <div
        ref={artboardRef}
        className="canvas-artboard mat-elevation-z4"
        onClick={event => event.stopPropagation()}
      >
        <canvas ref={horizontalRulerRef} className="canvas-ruler orientation-horizontal" />
        <canvas ref={verticalRulerRef} className="canvas-ruler orientation-vertical" />
        <div ref={rulerCornerRef} className="canvas-ruler canvas-ruler-corner" />
      </div>
      <canvas ref={layersRef} className="rendering-canvas" />
      <canvas ref={overlayRef} className="overlay-canvas" />
    </div>
  );
}
