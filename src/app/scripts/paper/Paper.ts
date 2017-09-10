import { VectorLayer } from 'app/model/layers';
import { ToolMode } from 'app/model/paper';
import { Matrix } from 'app/scripts/common';
import { PaperLayer } from 'app/scripts/paper/PaperLayer';
import { PaperService } from 'app/services';
import { State, Store } from 'app/store';
import { getHoveredLayerId, getSelectedLayerIds, getVectorLayer } from 'app/store/layers/selectors';
import { getFocusedEditPath, getPathPreview, getSelectionBox } from 'app/store/paper/selectors';
import { getToolMode } from 'app/store/paper/selectors';
import * as paper from 'paper';
import { OutputSelector } from 'reselect';

import { MasterTool, Tool, ZoomPanTool } from './tool';
import { Guides, Items } from './util';

let paperLayer: PaperLayer;

export function initialize(canvas: HTMLCanvasElement, paperService: PaperService) {
  if (paperLayer) {
    return;
  }
  initializeCanvas(canvas);
  initializeTools(paperService);
  initializeListeners(paperService);
}

function initializeCanvas(canvas: HTMLCanvasElement) {
  paper.setup(canvas);
  paper.settings.applyMatrix = false;
  paper.settings.insertItems = false;
  // TODO: should we set a hit tolerance here (physical or viewport pixels?)
  paper.settings.hitTolerance = 0;
  paperLayer = new PaperLayer();
  paper.project.addLayer(paperLayer);
}

function initializeTools(ps: PaperService) {
  const paperTool = new paper.Tool();
  const masterTool = new MasterTool(ps);
  const zoomPanTool = new ZoomPanTool(ps);
  let currentTool: Tool;

  const onEventFn = (event?: paper.ToolEvent | paper.KeyEvent) => {
    const prevTool = currentTool;
    currentTool =
      ps.getToolMode() === ToolMode.ZoomPan || (event && event.modifiers.space)
        ? zoomPanTool
        : masterTool;
    if (prevTool !== currentTool) {
      if (prevTool) {
        prevTool.onDeactivate();
      }
      if (currentTool) {
        currentTool.onActivate();
      }
    }
    if (currentTool) {
      if (event instanceof paper.ToolEvent) {
        currentTool.onMouseEvent(event);
      } else if (event instanceof paper.KeyEvent) {
        currentTool.onKeyEvent(event);
      }
    }
  };

  ps.store.select(getToolMode).subscribe(toolMode => {
    // TODO: clean this fixed distance code up?
    // TODO: should the '4' here be in terms of physical pixels or viewport pixels?
    paperTool.fixedDistance = toolMode === ToolMode.Pencil ? 4 : undefined;
    onEventFn();
  });

  paperTool.on({
    mousedown: onEventFn,
    mousedrag: onEventFn,
    mousemove: onEventFn,
    mouseup: onEventFn,
    keydown: onEventFn,
    keyup: onEventFn,
  });
}

function initializeListeners(ps: PaperService) {
  const pl = paperLayer;
  ps.store.select(getVectorLayer).subscribe(vl => pl.setVectorLayer(vl));
  ps.store.select(getSelectedLayerIds).subscribe(ids => pl.setSelectedLayers(ids));
  ps.store.select(getHoveredLayerId).subscribe(id => pl.setHoveredLayer(id));
  ps.store.select(getPathPreview).subscribe(pathData => pl.setPathPreview(pathData));
  ps.store
    .select(getFocusedEditPath)
    .subscribe(focusedEditPath => pl.setFocusedEditPath(focusedEditPath));
  ps.store.select(getSelectionBox).subscribe(box => {
    if (box) {
      pl.setSelectionBox({
        from: new paper.Point(box.from),
        to: new paper.Point(box.to),
      });
    } else {
      pl.setSelectionBox(undefined);
    }
  });
}

export function updateProjectDimensions(
  viewportWidth: number,
  viewportHeight: number,
  viewWidth: number,
  viewHeight: number,
) {
  paper.view.viewSize = new paper.Size(viewWidth, viewHeight);
  const sx = viewWidth / viewportWidth;
  const sy = viewHeight / viewportHeight;
  paperLayer.matrix = new paper.Matrix(sx, 0, 0, sy, 0, 0);
}
