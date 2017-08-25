// Helper functions for guide/overlay related functionality.
// Depends on Items.

import * as _ from 'lodash';
import * as paper from 'paper';

import { Items } from '.';

const GUIDE_LAYER_NAME = 'guideLayer';
const HOVER_PATH_NAME = 'hoverPath';
const SELECTION_BOX_NAME = 'selectionBox';
const SELECTION_GROUP_NAME = 'selectionGroup';
const ROTATION_HANDLE_NAME = 'rotationHandle';
const SCALE_HANDLE_NAME = 'scaleHandle';
const GUIDE_COLOR = '#009dec';
const SELECTION_BOX_COLOR = '#aaaaaa';

// ======================= //
// ===== Guide layer ===== //
// ======================= //

export function createGuideLayer() {
  const guideLayer = new paper.Layer();
  guideLayer.remove();
  guideLayer.name = GUIDE_LAYER_NAME;
  return guideLayer;
}

export function getGuideLayer() {
  return _.find(paper.project.layers, l => l.name === GUIDE_LAYER_NAME);
}

// ====================== //
// ===== Hover path ===== //
// ====================== //

function getHoverPath() {
  return Items.findItemByName(HOVER_PATH_NAME) as paper.Path;
}

export function showHoverPath(path: paper.Path) {
  const clone = new paper.Path(path.segments);
  clone.remove();
  clone.name = HOVER_PATH_NAME;
  clone.closed = true;
  clone.strokeColor = GUIDE_COLOR;
  clone.fillColor = undefined;
  clone.guide = true;
  clone.strokeWidth = 1 / paper.view.zoom;
  clone.data.isHelperItem = true; // TODO: missing types
  getGuideLayer().addChild(clone);
  clone.bringToFront();
  return clone;
}

export function hideHoverPath() {
  const hoverPath = getHoverPath();
  if (hoverPath) {
    hoverPath.remove();
  }
}

// ========================= //
// ===== Selection box ===== //
// ========================= //

export function getSelectionBoxPath() {
  return Items.findItemByName(SELECTION_BOX_NAME) as paper.Path;
}

export function showSelectionBoxPath(downPoint: paper.Point, point: paper.Point) {
  const clone = new paper.Path.Rectangle(createSelectionBoxRect(downPoint, point));
  clone.remove();
  clone.strokeWidth = 1 / paper.view.zoom;
  clone.guide = true;
  clone.name = SELECTION_BOX_NAME;
  clone.strokeColor = SELECTION_BOX_COLOR;
  clone.dashArray = [3 / paper.view.zoom, 3 / paper.view.zoom];
  // TODO: missing types
  clone.data.isRectSelect = true;
  // TODO: missing types
  clone.data.isHelperItem = true;
  getGuideLayer().addChild(clone);
  clone.bringToFront();
  return clone;
}

function createSelectionBoxRect(downPoint: paper.Point, point: paper.Point) {
  const half = new paper.Point(0.5 / paper.view.zoom, 0.5 / paper.view.zoom);
  const start = downPoint.add(half);
  const end = point.add(half);
  return new paper.Rectangle(start, end);
}

// =========================== //
// ===== Selection group ===== //
// =========================== //

export function getSelectionGroup() {
  return Items.findItemByName(SELECTION_GROUP_NAME) as paper.Group;
}

export function showSelectionBounds(bounds: paper.Rectangle) {
  const group = new paper.Group({ name: SELECTION_GROUP_NAME });
  group.remove();

  // Create the selection bounds rectangle.
  const selectionRect = new paper.Path.Rectangle(bounds);
  selectionRect.remove();
  selectionRect.curves[0].divideAtTime(0.5);
  selectionRect.curves[2].divideAtTime(0.5);
  selectionRect.curves[4].divideAtTime(0.5);
  selectionRect.curves[6].divideAtTime(0.5);
  selectionRect.guide = true;
  selectionRect.strokeScaling = false;
  selectionRect.fullySelected = true;
  selectionRect.strokeWidth = 1 / paper.view.zoom;

  // Create the rotation handle.
  // TODO: provide different mechanism for rotating shapes
  const verticalOffset = new paper.Point(0, 10 / paper.view.zoom);
  const rotationHandle = new paper.Path.Circle(
    selectionRect.segments[7].point.add(verticalOffset),
    5 / paper.view.zoom,
  );
  rotationHandle.remove();
  rotationHandle.name = ROTATION_HANDLE_NAME;
  rotationHandle.strokeWidth = 0.5 / paper.view.zoom;
  rotationHandle.strokeColor = GUIDE_COLOR;
  rotationHandle.fillColor = 'white';
  rotationHandle.data = {
    offset: verticalOffset,
    isRotHandle: true,
    isHelperItem: true,
    noSelect: true,
    noHover: true,
  };
  group.addChild(rotationHandle);

  // Create the scale handles.
  selectionRect.segments.forEach((segment, index) => {
    // Make the even index-ed scale handles a bit larger than the odd ones.
    const size = index % 2 === 0 ? 6 : 4;
    const scaleHandle = new paper.Path.Rectangle(
      segment.point,
      new paper.Size(size / paper.view.zoom, size / paper.view.zoom),
    );
    scaleHandle.remove();
    scaleHandle.name = SCALE_HANDLE_NAME;
    scaleHandle.fillColor = GUIDE_COLOR;
    scaleHandle.data = {
      index,
      isScaleHandle: true,
      isHelperItem: true,
      noSelect: true,
      noHover: true,
    };
    group.addChild(scaleHandle);
  });

  getGuideLayer().addChild(group);
  group.bringToFront();
  return group;
}

export function isScaleHandle(item: paper.Item): item is paper.Path.Rectangle {
  return item.name === SCALE_HANDLE_NAME;
}

export function getScaleHandleIndex(item: paper.Item) {
  return isScaleHandle(item) ? item.data.index : -1;
}

export function isRotationHandle(item: paper.Item): item is paper.Path.Circle {
  return item.name === ROTATION_HANDLE_NAME;
}

export function hideSelectionBounds() {
  const selectionGroup = getSelectionGroup();
  if (selectionGroup) {
    selectionGroup.remove();
  }
}
