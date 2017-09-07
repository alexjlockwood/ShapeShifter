import { VectorLayer } from 'app/model/layers';
import { ToolMode } from 'app/model/paper';
import { Matrix } from 'app/scripts/common';
import { PaperService } from 'app/services';
import { State, Store } from 'app/store';
import { getHoveredLayerId, getSelectedLayerIds, getVectorLayer } from 'app/store/layers/selectors';
import { getToolMode } from 'app/store/paper/selectors';
import * as paper from 'paper';
import { OutputSelector } from 'reselect';

import { PaperLayer } from './item';
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
  paper.settings.handleSize = 8;
  paper.settings.applyMatrix = false;
  paper.settings.insertItems = false;
  // TODO: should we set a hit tolerance here?
  paper.settings.hitTolerance = 0;
  paperLayer = new PaperLayer();
  paper.project.addLayer(paperLayer);
}

function initializeTools(paperService: PaperService) {
  const paperTool = new paper.Tool();
  const masterTool = new MasterTool(paperService);
  const zoomPanTool = new ZoomPanTool(paperService);
  let currentTool: Tool;

  const onEventFn = (event?: paper.ToolEvent | paper.KeyEvent) => {
    const prevTool = currentTool;
    currentTool =
      paperService.getToolMode() === ToolMode.ZoomPan || (event && event.modifiers.space)
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

  paperService.getToolModeObservable().subscribe(m => {
    // TODO: clean this fixed distance code up?
    paperTool.fixedDistance = m === ToolMode.Pencil ? 4 : undefined;
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

function initializeListeners(paperService: PaperService) {
  paperService.getVectorLayerObservable().subscribe(vl => {
    paperLayer.setVectorLayer(vl);
  });
  paperService.getSelectedLayerIdsObservable().subscribe(layerIds => {
    paperLayer.setSelectedLayers(layerIds);
  });
  paperService.getHoveredLayerIdObservable().subscribe(layerId => {
    paperLayer.setHoveredLayer(layerId);
  });
  paperService.getSelectionBoxObservable().subscribe(box => {
    if (box) {
      paperLayer.setSelectionBox({ from: new paper.Point(box.from), to: new paper.Point(box.to) });
    } else {
      paperLayer.clearSelectionBox();
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
