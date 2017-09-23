import { ToolMode } from 'app/model/paper';
import { PaperLayer } from 'app/scripts/paper/item';
import { PaperService } from 'app/services';
import { getHoveredLayerId, getSelectedLayerIds, getVectorLayer } from 'app/store/layers/selectors';
import {
  getFocusedPathInfo,
  getPathOverlayInfo,
  getSelectionBox,
  getSnapGuideInfo,
  getZoomPanInfo,
} from 'app/store/paper/selectors';
import { getToolMode } from 'app/store/paper/selectors';
import * as paper from 'paper';

import { Tool, newMasterTool, newZoomPanTool } from './tool';

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

  // By default paper.js bakes matrix transformations directly into its children.
  // This is usually not the behavior we want (especially for groups).
  paper.settings.applyMatrix = false;

  // By default paper.js automatically inserts newly created items into the active layer.
  // This behavior makes it harder to explicitly position things in the item hierarchy.
  paper.settings.insertItems = false;

  paperLayer = new PaperLayer();
  paper.project.addLayer(paperLayer);
}

function initializeTools(ps: PaperService) {
  const paperTool = new paper.Tool();
  const masterTool = newMasterTool(ps);
  const zoomPanTool = newZoomPanTool(ps);
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
  ps.store.select(getPathOverlayInfo).subscribe(info => pl.setPathOverlayInfo(info));
  ps.store.select(getFocusedPathInfo).subscribe(info => pl.setFocusedPathInfo(info));
  ps.store.select(getSnapGuideInfo).subscribe(info => pl.setSnapGuideInfo(info));
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
  ps.store.select(getZoomPanInfo).subscribe(info => {
    paper.view.zoom = info.zoom;
    paper.view.matrix.tx = info.translation.x;
    paper.view.matrix.ty = info.translation.y;
  });
}

/**
 * Update the project's dimensions with the new VectorLayer viewport
 * and/or canvas element size.
 */
export function updateDimensions(
  viewportWidth: number,
  viewportHeight: number,
  viewWidth: number,
  viewHeight: number,
) {
  // The view size represents the actual size of the canvas in CSS pixels.
  // The viewport size represents the user-visible dimensions (i.e. the default 24x24).
  paper.view.viewSize = new paper.Size(viewWidth, viewHeight);
  paperLayer.setDimensions(viewportWidth, viewportHeight, viewWidth, viewHeight);
}
