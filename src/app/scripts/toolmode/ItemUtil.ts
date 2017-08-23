import * as _ from 'lodash';
import * as paper from 'paper';

const MAIN_LAYER_NAME = 'mainLayer';
const GUIDE_LAYER_NAME = 'guideLayer';
const HOVER_PATH_NAME = 'hoverPath';
const SELECTION_BOX_NAME = 'selectionBox';
const SELECTION_GROUP_NAME = 'selectionGroup';
const ROTATION_HANDLE_NAME = 'rotationHandle';
const SCALE_HANDLE_NAME = 'scaleHandle';

const GUIDE_COLOR = '#009dec';
const SELECTION_BOX_COLOR = '#aaaaaa';

export function instanceOfPathItem(item: paper.Item): item is paper.PathItem {
  return item instanceof paper.PathItem;
}

export function isPath(item: paper.Item): item is paper.Path {
  return isSameClass(item, paper.Path);
}

export function isCompoundPath(item: paper.Item): item is paper.CompoundPath {
  return isSameClass(item, paper.CompoundPath);
}

export function isGroup(item: paper.Item): item is paper.Group {
  return isSameClass(item, paper.Group);
}

export function instanceofGroup(item: paper.Item): item is paper.Group {
  return item instanceof paper.Group;
}

export function isLayer(item: paper.Item): item is paper.Layer {
  return isSameClass(item, paper.Layer);
}

function isSameClass<T>(obj: any, cls: new (...args: any[]) => T): obj is T {
  return !_.isNil(obj) && obj.constructor === cls;
}

export function createMainLayer() {
  const mainLayer = new paper.Layer();
  mainLayer.remove();
  mainLayer.name = MAIN_LAYER_NAME;
  return mainLayer;
}

export function isMainLayer(item: paper.Item): item is paper.Layer {
  return isLayer(item) && item.name === MAIN_LAYER_NAME;
}

export function createGuideLayer() {
  const guideLayer = new paper.Layer();
  guideLayer.remove();
  guideLayer.name = GUIDE_LAYER_NAME;
  return guideLayer;
}

export function isGuideLayer(item: paper.Item): item is paper.Layer {
  return isLayer(item) && item.name === GUIDE_LAYER_NAME;
}

export function getGuideLayer() {
  return _.find(paper.project.layers, l => isGuideLayer(l));
}

/** Returns the first ancestor of 'item' that is an instance of the paper.Layer class. */
export function getParentLayer(item: paper.Item): paper.Layer {
  return item ? (isLayer(item) ? item : getParentLayer(item.parent)) : undefined;
}

/** Returns all items, optionally including guides. */
export function getAllItems(includeGuides = false) {
  const items: paper.Item[] = [];
  for (const layer of paper.project.layers) {
    for (const child of layer.children) {
      if (!child.guide || includeGuides) {
        items.push(child);
      }
    }
  }
  return items;
}

function findItemByName(name: string) {
  for (const layer of paper.project.layers) {
    const match = (function fn(item: paper.Item) {
      if (item.name === name) {
        return item;
      }
      for (const child of item.children || []) {
        const m = fn(child);
        if (m) {
          return m;
        }
      }
      return undefined;
    })(layer);
    if (match) {
      return match;
    }
  }
  return undefined;
}

// ===== Hover path =====

export function getHoverPath() {
  return findItemByName(HOVER_PATH_NAME);
}

export function maybeCreateHoverPath(point: paper.Point, hitOptions: paper.HitOptions) {
  // TODO: can this removal/addition be made more efficient?
  removeHoverPath();
  const hitResult = paper.project.hitTest(point, hitOptions);
  if (!hitResult) {
    return;
  }
  // TODO: support hover events for groups and layers?
  const { item } = hitResult;
  if (!item.selected && isPath(item)) {
    createHoverPath(item);
  }
}

function createHoverPath(path: paper.Path, addToGuideLayer = true) {
  const clone = new paper.Path(path.segments);
  clone.remove();
  applyDefaultGuideItemStyle(clone);
  clone.name = HOVER_PATH_NAME;
  clone.closed = true;
  clone.strokeColor = GUIDE_COLOR;
  clone.fillColor = undefined;
  clone.guide = true;
  // TODO: missing types
  clone.data.isHelperItem = true;
  if (addToGuideLayer) {
    getGuideLayer().addChild(clone);
    clone.bringToFront();
  }
  return clone;
}

export function removeHoverPath() {
  const hoverPath = getHoverPath();
  if (hoverPath) {
    hoverPath.remove();
    // TODO: check to see if this is actually necessary (might not be?)
    paper.view.update();
  }
}

// ===== Selection box ===== //

export function getSelectionBoxPath() {
  return findItemByName(SELECTION_BOX_NAME) as paper.Path;
}

export function createSelectionBoxPath(
  downPoint: paper.Point,
  point: paper.Point,
  addToGuideLayer = true,
) {
  const clone = new paper.Path.Rectangle(createSelectionBoxRect(downPoint, point));
  clone.remove();
  applyDefaultGuideItemStyle(clone);
  clone.name = SELECTION_BOX_NAME;
  clone.strokeColor = SELECTION_BOX_COLOR;
  clone.dashArray = [3 / paper.view.zoom, 3 / paper.view.zoom];
  // TODO: missing types
  clone.data.isRectSelect = true;
  // TODO: missing types
  clone.data.isHelperItem = true;
  if (addToGuideLayer) {
    getGuideLayer().addChild(clone);
    clone.bringToFront();
  }
  return clone;
}

function createSelectionBoxRect(downPoint: paper.Point, point: paper.Point) {
  const half = new paper.Point(0.5 / paper.view.zoom, 0.5 / paper.view.zoom);
  const start = downPoint.add(half);
  const end = point.add(half);
  return new paper.Rectangle(start, end);
}

// ===== Selection group ===== //

export function getSelectionGroup() {
  return findItemByName(SELECTION_GROUP_NAME) as paper.Group;
}

export function maybeCreateSelectionGroup() {
  // TODO: can this removal/addition be made more efficient?
  removeSelectionGroup();
  // TODO: support group selections, compound path selections, etc.
  const items = getSelectedPaths();
  if (items.length === 0) {
    return;
  }
  createSelectionGroup(items.map(i => i.bounds).reduce((p, c) => p.unite(c)));
}

export function createSelectionGroup(bounds: paper.Rectangle, addToGuideLayer = true) {
  const group = new paper.Group();
  group.remove();
  group.name = SELECTION_GROUP_NAME;

  // Create the selection bounds rectangle.
  const selectionRect = new paper.Path.Rectangle(bounds);
  selectionRect.remove();
  applyDefaultGuideItemStyle(selectionRect);
  selectionRect.fillColor = undefined;
  selectionRect.strokeScaling = false;
  // TODO: does this need to be selected?
  selectionRect.fullySelected = true;
  selectionRect.curves[0].divideAtTime(0.5);
  selectionRect.curves[2].divideAtTime(0.5);
  selectionRect.curves[4].divideAtTime(0.5);
  selectionRect.curves[6].divideAtTime(0.5);

  // Create the rotation handle.
  // TODO: provide different mechanism for rotating shapes
  const verticalOffset = new paper.Point(0, 10 / paper.view.zoom);
  const rotationHandle = new paper.Path.Circle({
    name: ROTATION_HANDLE_NAME,
    center: selectionRect.segments[7].point.add(verticalOffset),
    radius: 5 / paper.view.zoom,
    strokeWidth: 0.5 / paper.view.zoom,
    strokeColor: GUIDE_COLOR,
    fillColor: 'white',
    data: {
      offset: verticalOffset,
      isRotHandle: true,
      isHelperItem: true,
      noSelect: true,
      noHover: true,
    },
  });
  rotationHandle.remove();
  group.addChild(rotationHandle);

  // Create the scale handles.
  selectionRect.segments.forEach((segment, index) => {
    // Make the even index-ed scale handles a bit larger than the odd ones.
    const size = index % 2 === 0 ? 6 : 4;
    const scaleHandle = new paper.Path.Rectangle({
      name: SCALE_HANDLE_NAME,
      center: segment.point,
      size: [size / paper.view.zoom, size / paper.view.zoom],
      fillColor: GUIDE_COLOR,
      data: {
        index,
        isScaleHandle: true,
        isHelperItem: true,
        noSelect: true,
        noHover: true,
      },
    });
    scaleHandle.remove();
    group.addChild(scaleHandle);
  });

  if (addToGuideLayer) {
    getGuideLayer().addChild(group);
    group.bringToFront();
  }
  return group;
}

export function isScaleHandle(item: paper.Item) {
  return item.name === SCALE_HANDLE_NAME;
}

export function getScaleHandlePosition(item: paper.Item) {
  return isScaleHandle(item) ? item.data.index : -1;
}

export function isRotationHandle(item: paper.Item) {
  return item.name === ROTATION_HANDLE_NAME;
}

export function removeSelectionGroup() {
  const selectionGroup = getSelectionGroup();
  if (selectionGroup) {
    selectionGroup.remove();
    // TODO: check to see if this is actually necessary (might not be?)
    paper.view.update();
  }
}

function applyDefaultGuideItemStyle(item: paper.Item) {
  item.strokeWidth = 1 / paper.view.zoom;
  item.opacity = 1;
  item.blendMode = 'normal';
  item.guide = true;
}

export function getGuideColor() {
  return GUIDE_COLOR;
}

export function removeHelperItems() {
  getAllItems(true).forEach((item, index) => {
    if (item.data && item.data.isHelperItem) {
      item.remove();
    }
  });
}

/**
 * Returns all selected non-grouped items and groups (as opposed
 * to paper.project.selectedItems, which includes the parent group
 * as well as its children).
 */
export function getSelectedNonGroupedItems() {
  const itemsAndGroups: paper.Item[] = [];
  for (const item of paper.project.selectedItems) {
    if (!isGroup(item.parent) && item.data && !item.data.isSelectionBound) {
      itemsAndGroups.push(item);
    }
  }
  // Sort items by index (0 at bottom).
  itemsAndGroups.sort((a, b) => a.index - b.index);
  return itemsAndGroups as ReadonlyArray<paper.Item>;
}

/**
 * Only returns selected paths (no compound paths, groups, or any other stuff).
 */
export function getSelectedPaths() {
  return getSelectedNonGroupedItems().filter(p => isPath(p)) as paper.Path[];
}

export function cloneSelection() {
  getSelectedNonGroupedItems().forEach(item => {
    item.clone();
    item.selected = false;
  });
}

export function setItemSelection(item: paper.Item, isSelected: boolean) {
  const parentGroup = isGroup(item.parent) ? item.parent : undefined;
  const itemsCompoundPath = isCompoundPath(item.parent) ? item.parent : undefined;

  // If the selection is in a group, select the group, not the individual items.
  if (parentGroup) {
    setItemSelection(parentGroup, isSelected);
  } else if (itemsCompoundPath) {
    setItemSelection(itemsCompoundPath, isSelected);
  } else {
    if (item.data && item.data.noSelect) {
      return;
    }
    // Fully selected segments need to be unselected first, so
    // that the item can be normally selected.
    item.fullySelected = false;
    item.selected = isSelected;
    // Deselect children of compound paths and groups.
    if (isGroup(item) || isCompoundPath(item)) {
      (item.children || []).forEach(child => (child.selected = !isSelected));
    }
  }

  // TODO: figure out better way of sending notifications
  // $(document).trigger('SelectionChanged');
}

export function processRectangularSelection(
  event: paper.ToolEvent,
  rect: paper.Path.Rectangle,
  processDetails = false,
) {
  if (!rect) {
    throw new Error('null rect');
  }
  itemLoop: for (const item of getAllSelectableItems()) {
    // Check for item segment points inside the selection box.
    if (isGroup(item) || isCompoundPath(item)) {
      if (!rectangularSelectionGroupLoop(item, rect, item, event, processDetails)) {
        continue itemLoop;
      }
    } else {
      if (!handleRectangularSelectionItems(item, event, rect, processDetails)) {
        continue itemLoop;
      }
    }
  }
}

// If the rectangular selection found a group, drill into it recursively.
function rectangularSelectionGroupLoop(
  group: paper.Group | paper.CompoundPath,
  rect: paper.Path.Rectangle,
  root: paper.Item,
  event: paper.ToolEvent,
  processDetails: boolean,
) {
  for (const child of group.children) {
    if (isGroup(child) || isCompoundPath(child)) {
      rectangularSelectionGroupLoop(child, rect, root, event, processDetails);
    } else if (!handleRectangularSelectionItems(child, event, rect, processDetails)) {
      return false;
    }
  }
  return true;
}

function handleRectangularSelectionItems(
  item: paper.Item,
  event: paper.ToolEvent,
  rect: paper.Path.Rectangle,
  processDetails: boolean,
) {
  if (isPath(item)) {
    let segmentMode = false;

    // First round checks for segments inside the selectionRect.
    for (const seg of item.segments) {
      if (rect.contains(seg.point)) {
        if (processDetails) {
          if (event.modifiers.shift && seg.selected) {
            seg.selected = false;
          } else {
            seg.selected = true;
          }
          segmentMode = true;
        } else {
          if (event.modifiers.shift && item.selected) {
            setItemSelection(item, false);
          } else {
            setItemSelection(item, true);
          }
          return false;
        }
      }
    }

    // Second round checks for path intersections.
    const intersections = item.getIntersections(rect);
    if (intersections.length > 0 && !segmentMode) {
      // If in detail select mode, select the curves that intersect
      // with the selectionRect.
      if (processDetails) {
        for (let k = 0; k < intersections.length; k++) {
          const curve = intersections[k].curve;
          // Intersections contains every curve twice because
          // the selectionRect intersects a circle always at
          // two points. So we skip every other curve.
          if (k % 2 === 1) {
            continue;
          }

          if (event.modifiers.shift) {
            curve.selected = !curve.selected;
          } else {
            curve.selected = true;
          }
        }
      } else {
        if (event.modifiers.shift && item.selected) {
          setItemSelection(item, false);
        } else {
          setItemSelection(item, true);
        }
        return false;
      }
    }
  } else if (item instanceof paper.Shape) {
    if (checkBoundsItem(rect, item, event)) {
      return false;
    }
  }
  return true;
}

function checkBoundsItem(
  selectionRect: paper.Path.Rectangle,
  item: paper.Item,
  event: paper.ToolEvent,
) {
  // TODO: missing types
  const internalBounds = (item as any).internalBounds;
  const itemBounds = new paper.Path([
    item.localToGlobal(internalBounds.topLeft),
    item.localToGlobal(internalBounds.topRight),
    item.localToGlobal(internalBounds.bottomRight),
    item.localToGlobal(internalBounds.bottomLeft),
  ]);
  itemBounds.closed = true;
  itemBounds.guide = true;

  for (let i = 0; i < itemBounds.segments.length; i++) {
    const seg = itemBounds.segments[i];
    if (
      selectionRect.contains(seg.point) ||
      (i === 0 && selectionRect.getIntersections(itemBounds).length > 0)
    ) {
      if (event.modifiers.shift && item.selected) {
        setItemSelection(item, false);
      } else {
        setItemSelection(item, true);
      }
      itemBounds.remove();
      return true;
    }
  }

  itemBounds.remove();
  return false;
}

function getAllSelectableItems() {
  const selectables: paper.Item[] = [];
  for (const item of getAllItems()) {
    if (item.data && !item.data.isHelperItem) {
      selectables.push(item);
    }
  }
  return selectables;
}

export function clearSelection() {
  paper.project.deselectAll();
  removeHoverPath();
  // $(document).trigger('SelectionChanged');
}
