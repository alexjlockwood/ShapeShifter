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
  const layersRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<CanvasController>(undefined);

  useLayoutEffect(() => {
    const controller = new CanvasController(
      {
        root: requireRef(rootRef),
        artboard: requireRef(artboardRef),
        horizontalRuler: requireRef(horizontalRulerRef),
        verticalRuler: requireRef(verticalRulerRef),
        layers: requireRef(layersRef),
        overlay: requireRef(overlayRef),
      },
      actionSource,
      store,
      services,
    );
    controller.init();
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = undefined;
    };
  }, [actionSource, store, services]);

  return (
    <div ref={rootRef} className={className ? `app-canvas ${className}` : 'app-canvas'}>
      {/* The canvases cover the panel and ignore the mouse, so mouse events go to the artboard
          under them, and clicks around it still reach the workspace. */}
      <div
        ref={artboardRef}
        className="canvas-artboard mat-elevation-z4"
        onMouseDown={event => controllerRef.current?.onMouseDown(event.nativeEvent)}
        onMouseMove={event => controllerRef.current?.onMouseMove(event.nativeEvent)}
        onMouseUp={event => controllerRef.current?.onMouseUp(event.nativeEvent)}
        onMouseLeave={event => controllerRef.current?.onMouseLeave(event.nativeEvent)}
        onClick={event => event.stopPropagation()}
      >
        <canvas ref={horizontalRulerRef} className="canvas-ruler orientation-horizontal" />
        <canvas ref={verticalRulerRef} className="canvas-ruler orientation-vertical" />
      </div>
      <canvas ref={layersRef} className="rendering-canvas" />
      <canvas ref={overlayRef} className="overlay-canvas" />
    </div>
  );
}
