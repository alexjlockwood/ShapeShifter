import { VectorLayer } from 'app/model/layers';
import { ToolMode } from 'app/model/paper';
import { PaperService } from 'app/services';
import { State, Store } from 'app/store';
import { getHoveredLayerId, getSelectedLayerIds, getVectorLayer } from 'app/store/layers/selectors';
import { getToolMode } from 'app/store/paper/selectors';
import * as paper from 'paper';
import { OutputSelector } from 'reselect';

import { MasterTool, Tool, ZoomPanTool } from './tool';
import * as Guides from './util/Guides';
import * as Items from './util/Items';
import * as Layers from './util/Layers';

let isInitialized = false;

export function initialize(canvas: HTMLCanvasElement, paperService: PaperService) {
  if (isInitialized) {
    return;
  }
  initializeCanvas(canvas);
  initializeTools(paperService);
  initializeListeners(paperService);
  isInitialized = true;
}

function initializeCanvas(canvas: HTMLCanvasElement) {
  paper.setup(canvas);
  paper.settings.handleSize = 8;
  paper.settings.applyMatrix = false;
  // TODO: should we set a hit tolerance here?
  paper.settings.hitTolerance = 0;
  const mainLayer = new paper.Layer({ name: 'mainLayer' });
  paper.project.addLayer(mainLayer);
  paper.project.addLayer(Guides.createGuideLayer());
  mainLayer.activate();
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
    // TODO: make this more efficient?
    paper.project.activeLayer.removeChildren();
    paper.project.activeLayer.addChild(Layers.fromVectorLayer(vl));
  });
  paperService.getSelectedLayerIdsObservable().subscribe(layerIds => {
    const { activeLayer } = paper.project;
    const selectedItems = activeLayer.getItems({ match: item => item.selected });
    selectedItems.forEach(item => (item.selected = layerIds.has(item.data.id)));
    layerIds.forEach(id => (Items.findItemById(id).selected = true));
  });
  paperService.getHoveredLayerIdObservable().subscribe(layerId => {
    if (layerId) {
      // TODO: implement this
    } else {
      Guides.hideHoverPath();
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
  paper.project.layers.forEach(l => {
    const sx = viewWidth / viewportWidth;
    const sy = viewHeight / viewportHeight;
    l.matrix = new paper.Matrix(sx, 0, 0, sy, 0, 0);
  });
}
