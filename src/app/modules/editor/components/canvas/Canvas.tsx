import { useEditorStore, useServices } from 'app/modules/editor/context/EditorContext';
import type { Size } from 'app/modules/editor/hooks/useElementSize';
import { ActionSource } from 'app/modules/editor/model/actionmode';
import { useEffectEvent, useLayoutEffect, useRef } from 'react';

import './canvas.scss';
import { CanvasController } from './CanvasController';

interface CanvasProps {
  readonly actionSource: ActionSource;
  readonly canvasBounds: Size;
  readonly className?: string;
}

export function Canvas({ actionSource, canvasBounds, className }: CanvasProps) {
  const store = useEditorStore();
  const services = useServices();
  const rootRef = useRef<HTMLDivElement>(null);
  const horizontalRulerRef = useRef<HTMLCanvasElement>(null);
  const verticalRulerRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<CanvasController>(undefined);

  const setInitialCanvasBounds = useEffectEvent((controller: CanvasController) => {
    controller.setCanvasBounds(canvasBounds);
  });

  useLayoutEffect(() => {
    const controller = new CanvasController(
      {
        root: rootRef.current,
        horizontalRuler: horizontalRulerRef.current,
        verticalRuler: verticalRulerRef.current,
        container: containerRef.current,
        layers: layersRef.current,
        overlay: overlayRef.current,
      },
      actionSource,
      store,
      services,
    );
    controller.init();
    setInitialCanvasBounds(controller);
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = undefined;
    };
  }, [actionSource, store, services]);

  useLayoutEffect(() => {
    controllerRef.current?.setCanvasBounds(canvasBounds);
  }, [canvasBounds]);

  return (
    <div
      ref={rootRef}
      className={className ? `app-canvas ${className}` : 'app-canvas'}
      onMouseDown={event => controllerRef.current?.onMouseDown(event.nativeEvent)}
      onMouseMove={event => controllerRef.current?.onMouseMove(event.nativeEvent)}
      onMouseUp={event => controllerRef.current?.onMouseUp(event.nativeEvent)}
      onMouseLeave={event => controllerRef.current?.onMouseLeave(event.nativeEvent)}
    >
      <div className="app-canvas-container" onClick={event => event.stopPropagation()}>
        <canvas ref={horizontalRulerRef} className="canvas-ruler orientation-horizontal" />
        <canvas ref={verticalRulerRef} className="canvas-ruler orientation-vertical" />
        <div ref={containerRef} className="canvas-container">
          <canvas ref={layersRef} className="rendering-canvas mat-elevation-z4" />
          <canvas ref={overlayRef} className="overlay-canvas" />
        </div>
      </div>
    </div>
  );
}
