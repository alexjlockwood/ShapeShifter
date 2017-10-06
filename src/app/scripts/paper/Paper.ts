import { PaperLayer } from 'app/scripts/paper/item';
import { PaperService } from 'app/services';
import {
  getHiddenLayerIds,
  getHoveredLayerId,
  getSelectedLayerIds,
  getVectorLayer,
} from 'app/store/layers/selectors';
import {
  getCreatePathInfo,
  getFocusedPathInfo,
  getSelectionBox,
  getSnapGuideInfo,
  getSplitCurveInfo,
  getToolMode,
  getTooltipInfo,
  getZoomPanInfo,
} from 'app/store/paper/selectors';
import * as paper from 'paper';

import { MasterTool } from './tool';

// By default paper.js bakes matrix transformations directly into its children.
// This is usually not the behavior we want (especially for groups).
paper.settings.applyMatrix = false;

// By default paper.js automatically inserts newly created items into the active layer.
// This behavior makes it harder to explicitly position things in the item hierarchy.
paper.settings.insertItems = false;

// TODO: make it possible to deactivate/destroy an active paper.js project
let paperLayer: PaperLayer;

/**
 * Note that this must be called after the DOM has been initialized
 * (i.e. in an ngAfterViewInit callback).
 */
export function initialize(canvas: HTMLCanvasElement, ps: PaperService) {
  if (paperLayer) {
    throw new Error('A project already exists for the provided canvas!');
  }
  initializeCanvas(canvas);
  initializeMasterTool(ps);
  initializeListeners(ps);
}

function initializeCanvas(canvas: HTMLCanvasElement) {
  paper.setup(canvas);
  paperLayer = new PaperLayer();
  paper.project.addLayer(paperLayer);
}

function initializeMasterTool(ps: PaperService) {
  const masterTool = new MasterTool(ps);
  ps.store.select(getToolMode).subscribe(toolMode => masterTool.setToolMode(toolMode));
}

function initializeListeners(ps: PaperService) {
  const pl = paperLayer;
  ps.store.select(getVectorLayer).subscribe(vl => pl.setVectorLayer(vl));
  ps.store.select(getSelectedLayerIds).subscribe(ids => pl.setSelectedLayers(ids));
  ps.store.select(getHoveredLayerId).subscribe(id => pl.setHoveredLayer(id));
  ps.store.select(getCreatePathInfo).subscribe(info => pl.setCreatePathInfo(info));
  ps.store.select(getSplitCurveInfo).subscribe(info => pl.setSplitCurveInfo(info));
  ps.store.select(getFocusedPathInfo).subscribe(info => pl.setFocusedPathInfo(info));
  ps.store.select(getSnapGuideInfo).subscribe(info => pl.setSnapGuideInfo(info));
  ps.store.select(getHiddenLayerIds).subscribe(ids => pl.setHiddenLayers(ids));
  ps.store.select(getTooltipInfo).subscribe(info => pl.setTooltipInfo(info));
  ps.store.select(getSelectionBox).subscribe(box => {
    if (box) {
      const from = new paper.Point(box.from);
      const to = new paper.Point(box.to);
      pl.setSelectionBox({ from, to });
    } else {
      pl.setSelectionBox(undefined);
    }
  });
  ps.store.select(getZoomPanInfo).subscribe(({ zoom, translation: { tx, ty } }) => {
    paper.view.matrix = new paper.Matrix(zoom, 0, 0, zoom, tx, ty);
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
