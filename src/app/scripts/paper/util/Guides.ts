// Helper functions for guide/overlay related functionality.
// Depends on Items and Handles.

import * as paper from 'paper';

import * as Items from './Items';

const GUIDE_LAYER_NAME = 'guideLayer';
const HOVER_PATH_NAME = 'hoverPath';
const SELECTION_BOX_NAME = 'selectionBox';
const SELECTION_PATH_NAME = 'selectionPath';
const ADD_SEGMENT_TO_CURVE_HOVER_GROUP_NAME = 'addSegmentToCurveHoverGroup';
const PEN_PREVIEW_PATH = 'penPreviewPath';
// TODO: implement a 'rotation tool' similar to sketch
// TODO: implement a 'transform tool' similar to sketch
const GUIDE_COLOR = '#009dec';
const SELECTION_BOX_COLOR = '#aaaaaa';

// ======================= //
// ===== Guide layer ===== //
// ======================= //

export function createGuideLayer() {
  return Items.newLayer({ name: GUIDE_LAYER_NAME });
}

export function getGuideLayer() {
  // TODO: Project#getItem() is missing types
  return paper.project.getItem({ name: GUIDE_LAYER_NAME });
}

// ====================== //
// ===== Hover path ===== //
// ====================== //

function getHoverPath() {
  return getGuideLayer().getItem<Partial<paper.PathProps>>({ name: HOVER_PATH_NAME }) as paper.Path;
}

export function showHoverPath(path: paper.Path) {
  hideHoverPath();

  const hoverPath = Items.newPath(path.segments);
  hoverPath.name = HOVER_PATH_NAME;
  hoverPath.closed = path.closed;
  hoverPath.strokeColor = GUIDE_COLOR;
  hoverPath.guide = true;
  hoverPath.strokeWidth = 1.5 / paper.view.zoom;
  hoverPath.matrix = path.matrix.clone();
  getGuideLayer().addChild(hoverPath);
  return hoverPath;
}

export function hideHoverPath() {
  const hoverPath = getHoverPath();
  if (hoverPath) {
    hoverPath.remove();
  }
}

// ========================== //
// ===== Selection path ===== //
// ========================== //

export function isSelectionBoundsPath() {
  return getGuideLayer().getItem({ name: SELECTION_PATH_NAME }) as paper.Path.Rectangle;
}

export function getSelectionBoundsPath() {
  return getGuideLayer().getItem({ name: SELECTION_PATH_NAME }) as paper.Path.Rectangle;
}

export function showSelectionBoundsPath(bounds: paper.Rectangle) {
  hideSelectionBoundsPath();

  const rect = Items.newRectangle(bounds);
  rect.name = SELECTION_PATH_NAME;
  rect.curves[0].divideAtTime(0.5);
  rect.curves[2].divideAtTime(0.5);
  rect.curves[4].divideAtTime(0.5);
  rect.curves[6].divideAtTime(0.5);
  rect.strokeScaling = false;
  rect.fullySelected = true;
  rect.strokeWidth = 1 / paper.view.zoom;
  rect.strokeColor = GUIDE_COLOR;
  getGuideLayer().addChild(rect);
  return rect;
}

export function hideSelectionBoundsPath() {
  const selectionPath = getSelectionBoundsPath();
  if (selectionPath) {
    selectionPath.remove();
  }
}

// ========================= //
// ===== Selection box ===== //
// ========================= //

export function getSelectionBoxPath() {
  return getGuideLayer().getItem({ name: SELECTION_BOX_NAME }) as paper.Path;
}

export function showSelectionBoxPath(downPoint: paper.Point, point: paper.Point) {
  hideSelectionBoxPath();

  const rect = Items.newRectangle(createSelectionBoxRect(downPoint, point));
  rect.strokeWidth = 1 / paper.view.zoom;
  rect.guide = true;
  rect.name = SELECTION_BOX_NAME;
  rect.strokeColor = SELECTION_BOX_COLOR;
  rect.dashArray = [3 / paper.view.zoom, 3 / paper.view.zoom];
  getGuideLayer().addChild(rect);
  return rect;
}

function createSelectionBoxRect(from: paper.Point, to: paper.Point) {
  const half = new paper.Point(0.5 / paper.view.zoom, 0.5 / paper.view.zoom);
  return new paper.Rectangle(from.add(half), to.add(half));
}

function hideSelectionBoxPath() {
  const selectionBox = getSelectionBoxPath();
  if (selectionBox) {
    selectionBox.remove();
  }
}

// ======================-=============== //
// ===== Add segment to curve hover ===== //
// ====================================== //

function getAddSegmentToCurveHoverGroup() {
  return getGuideLayer().getItem({ name: ADD_SEGMENT_TO_CURVE_HOVER_GROUP_NAME }) as paper.Group;
}

export function showAddSegmentToCurveHoverGroup(location: paper.CurveLocation) {
  hideAddSegmentToCurveHoverGroup();

  const group = Items.newGroup({ name: ADD_SEGMENT_TO_CURVE_HOVER_GROUP_NAME });
  group.guide = true;

  const { curve, point } = location;

  const highlightedCurve = Items.newPath([curve.segment1, curve.segment2]);
  highlightedCurve.guide = true;
  highlightedCurve.matrix = location.path.matrix.clone();
  highlightedCurve.strokeColor = 'red';
  highlightedCurve.strokeWidth = 4 / paper.view.zoom;
  group.addChild(highlightedCurve);

  const highlightedPoint = Items.newCircle(point, 7 / paper.view.zoom);
  highlightedPoint.guide = true;
  highlightedPoint.fillColor = 'green';
  group.addChild(highlightedPoint);

  getGuideLayer().addChild(group);
  return group;
}

export function hideAddSegmentToCurveHoverGroup() {
  const hoverGroup = getAddSegmentToCurveHoverGroup();
  if (hoverGroup) {
    hoverGroup.remove();
  }
}

// ================================= //
// ===== Pen path preview path ===== //
// ================================= //

function getPenPathPreviewPath() {
  return getGuideLayer().getItem({ name: PEN_PREVIEW_PATH }) as paper.Path;
}

export function showPenPathPreviewPath(from: paper.Segment, to: paper.Point) {
  hidePenPathPreviewPath();

  const path = Items.newPath({
    name: PEN_PREVIEW_PATH,
    guide: true,
    strokeWidth: 4 / paper.view.zoom,
    strokeColor: 'red',
  });
  const fromPoint = from.point.clone();
  const fromHandleIn = from.handleIn ? from.handleIn.clone() : undefined;
  const fromHandleOut = from.handleOut ? from.handleOut.clone() : undefined;
  path.add(
    new paper.Segment({
      point: fromPoint,
      handleIn: fromHandleIn,
      handleOut: fromHandleOut,
    }),
  );
  path.add(to.clone());

  getGuideLayer().addChild(path);
  return path;
}

export function hidePenPathPreviewPath() {
  const path = getPenPathPreviewPath();
  if (path) {
    path.remove();
  }
}
