// Helper functions for guide/overlay related functionality.
// Depends on Items.

import * as _ from 'lodash';
import * as paper from 'paper';

import { Handles, Items } from '.';
import { HandleType } from './Handles';

const GUIDE_LAYER_NAME = 'guideLayer';
const HOVER_PATH_NAME = 'hoverPath';
const SELECTION_BOX_NAME = 'selectionBox';
const SELECTION_GROUP_NAME = 'selectionGroup';
const ROTATION_HANDLE_NAME = 'rotationHandle';
const SCALE_HANDLE_NAME = 'scaleHandle';
const GUIDE_COLOR = '#009dec';
const SELECTION_BOX_COLOR = '#aaaaaa';

const DATA_HANDLE_TYPE = 'handleType';
const DATA_OPPOSITE_HANDLE_TYPE = 'oppositeHandleType';

// ======================= //
// ===== Guide layer ===== //
// ======================= //

export function createGuideLayer() {
  return Items.newLayer({ name: GUIDE_LAYER_NAME });
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
  const hoverPath = Items.newPath(path.segments);
  hoverPath.name = HOVER_PATH_NAME;
  hoverPath.closed = true;
  hoverPath.strokeColor = GUIDE_COLOR;
  hoverPath.fillColor = undefined;
  hoverPath.guide = true;
  hoverPath.strokeWidth = 1 / paper.view.zoom;
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

// ========================= //
// ===== Selection box ===== //
// ========================= //

export function getSelectionBoxPath() {
  return Items.findItemByName(SELECTION_BOX_NAME) as paper.Path;
}

export function showSelectionBoxPath(downPoint: paper.Point, point: paper.Point) {
  const clone = Items.newRectangle(createSelectionBoxRect(downPoint, point));
  clone.strokeWidth = 1 / paper.view.zoom;
  clone.guide = true;
  clone.name = SELECTION_BOX_NAME;
  clone.strokeColor = SELECTION_BOX_COLOR;
  clone.dashArray = [3 / paper.view.zoom, 3 / paper.view.zoom];
  getGuideLayer().addChild(clone);
  return clone;
}

function createSelectionBoxRect(from: paper.Point, to: paper.Point) {
  const half = new paper.Point(0.5 / paper.view.zoom, 0.5 / paper.view.zoom);
  return new paper.Rectangle(from.add(half), to.add(half));
}

// =========================== //
// ===== Selection group ===== //
// =========================== //

function getSelectionBoundsGroup() {
  return Items.findItemByName(SELECTION_GROUP_NAME) as paper.Group;
}

export function showSelectionBounds(bounds: paper.Rectangle) {
  const group = Items.newGroup({ name: SELECTION_GROUP_NAME });

  // Create the selection bounds rectangle.
  const rect = Items.newRectangle(bounds);
  rect.curves[0].divideAtTime(0.5);
  rect.curves[2].divideAtTime(0.5);
  rect.curves[4].divideAtTime(0.5);
  rect.curves[6].divideAtTime(0.5);
  rect.guide = true;
  rect.strokeScaling = false;
  rect.fullySelected = true;
  rect.strokeWidth = 1 / paper.view.zoom;
  rect.strokeColor = GUIDE_COLOR;
  group.addChild(rect);

  // TODO: make the rotation/scale handles easier to click
  rect.segments.forEach((segment, index) => {
    // Make the even index-ed scale handles a bit larger than the odd ones.
    const rotationHandleSize = (index % 2 === 0 ? 12 : 8) / paper.view.zoom;
    const scaleHandleSize = rotationHandleSize / 2;
    const handleType = Handles.getHandleType(index);
    const oppositeHandleType = Handles.getOppositeHandleType(index);

    // Create a rotation handle.
    const rotationHandle = Items.newRectangle(
      segment.point.subtract(rotationHandleSize / 2),
      new paper.Size(rotationHandleSize, rotationHandleSize),
    );
    Items.setSelectable(rotationHandle, false);
    Items.setHoverable(rotationHandle, false);
    rotationHandle.name = ROTATION_HANDLE_NAME;
    rotationHandle.data[DATA_HANDLE_TYPE] = handleType;
    rotationHandle.data[DATA_OPPOSITE_HANDLE_TYPE] = oppositeHandleType;
    group.addChild(rotationHandle);

    // Create a scale handle.
    const scaleHandle = Items.newRectangle(
      segment.point.subtract(scaleHandleSize / 2),
      new paper.Size(scaleHandleSize, scaleHandleSize),
    );
    Items.setSelectable(scaleHandle, false);
    Items.setHoverable(scaleHandle, false);
    scaleHandle.name = SCALE_HANDLE_NAME;
    scaleHandle.data[DATA_HANDLE_TYPE] = handleType;
    scaleHandle.data[DATA_OPPOSITE_HANDLE_TYPE] = oppositeHandleType;
    group.addChild(scaleHandle);
  });

  getGuideLayer().addChild(group);
  return group;
}

export function isScaleHandle(item: paper.Item): item is paper.Path.Rectangle {
  return item.name === SCALE_HANDLE_NAME;
}

export function isRotationHandle(item: paper.Item): item is paper.Path.Circle {
  return item.name === ROTATION_HANDLE_NAME;
}

export function getHandleType(item: paper.Item): HandleType {
  return item.data[DATA_HANDLE_TYPE];
}

export function getOppositeHandleType(item: paper.Item): HandleType {
  return item.data[DATA_OPPOSITE_HANDLE_TYPE];
}

export function hideSelectionBounds() {
  const selectionGroup = getSelectionBoundsGroup();
  if (selectionGroup) {
    selectionGroup.remove();
  }
}
