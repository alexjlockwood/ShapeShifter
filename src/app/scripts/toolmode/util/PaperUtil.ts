import { ClipPathLayer, GroupLayer, Layer, PathLayer, VectorLayer } from 'app/model/layers';
import * as $ from 'jquery';
import * as _ from 'lodash';
import * as paper from 'paper';

import * as HoverUtil from './HoverUtil';
import * as PaperUtil from './PaperUtil';

let isPaperJsSetup = false;

export function setupPaperJs(canvas: HTMLCanvasElement) {
  if (isPaperJsSetup) {
    return;
  }
  paper.setup(canvas);
  paper.settings.handleSize = 8;
  const defaultLayer = new paper.Layer();
  defaultLayer.name = 'Default layer';
  defaultLayer.data.isDefaultLayer = true;
  const guideLayer = new paper.Layer();
  guideLayer.name = 'Guide layer';
  guideLayer.data.isGuideLayer = true;
  guideLayer.bringToFront();
  defaultLayer.activate();
  isPaperJsSetup = true;
}

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

export function findGuideLayer() {
  return _.find(paper.project.layers, l => l.data && l.data.isGuideLayer);
}

/**
 * Returns the first ancestor of 'item' that is an instance of the paper.Layer class.
 */
export function findParentLayer(item: paper.Item): paper.Layer {
  return item ? (isLayer(item) ? item : findParentLayer(item.parent)) : undefined;
}

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

export function clearSelection() {
  paper.project.deselectAll();
  HoverUtil.clearHoveredItem();
  $(document).trigger('SelectionChanged');
}

// export function splitPathAtSelectedSegments() {
//   const items = getSelectedNonGroupedItems().filter(p => PaperUtil.isPath(p)) as paper.Path[];
//   for (const item of items) {
//     for (let j = 0; j < item.segments.length; j++) {
//       const seg = item.segments[j];
//       if (!seg.selected) {
//         continue;
//       }
//       const { next, previous } = seg;
//       if (item.closed || (next && !next.selected && previous && !previous.selected)) {
//         splitPathRetainSelection(item, j, true);
//         splitPathAtSelectedSegments();
//         return;
//       }
//     }
//   }
// }

// function splitPathRetainSelection(path: paper.Path, index: number, deselectSplitSegments: boolean) {
//   const selectedPoints: paper.Point[] = [];

//   // Collect points of selected segments, so we can reselect them
//   // once the path is split.
//   for (let i = 0; i < path.segments.length; i++) {
//     const seg = path.segments[i];
//     if (!seg.selected || (deselectSplitSegments && i === index)) {
//       continue;
//     }
//     selectedPoints.push(seg.point);
//   }

//   const newPath = path.split(index, 0);
//   if (!newPath) {
//     return;
//   }

//   // Reselect all of the newPaths segments that are in the exact same location
//   // as the ones that are stored in selectedPoints.
//   newPath.segments.forEach(s =>
//     selectedPoints.forEach(p => {
//       if (p.x === s.point.x && p.y === s.point.y) {
//         s.selected = true;
//       }
//     }),
//   );

//   // Only do this if path and newPath are different (split at more than one point).
//   if (path !== newPath) {
//     path.segments.forEach(s =>
//       selectedPoints.forEach(p => {
//         if (p.x === s.point.x && p.y === s.point.y) {
//           s.selected = true;
//         }
//       }),
//     );
//   }
// }

export function cloneSelection() {
  getSelectedNonGroupedItems().forEach(item => {
    item.clone();
    item.selected = false;
  });
}

export function setItemSelection(item: paper.Item, isSelected: boolean) {
  const parentGroup = getParentGroup(item);
  const itemsCompoundPath = PaperUtil.isCompoundPath(item.parent) ? item.parent : undefined;

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
    if (PaperUtil.isGroup(item) || PaperUtil.isCompoundPath(item)) {
      (item.children || []).forEach(child => (child.selected = !isSelected));
    }
  }

  // TODO: figure out better way of sending notifications
  $(document).trigger('SelectionChanged');
}

/**
 * Returns all selected non-grouped items and groups (as opposed
 * to paper.project.selectedItems, which includes the parent group
 * as well as its children).
 */
function getSelectedNonGroupedItems() {
  const itemsAndGroups: paper.Item[] = [];
  for (const item of paper.project.selectedItems) {
    if (!PaperUtil.isGroup(item.parent) && item.data && !item.data.isSelectionBound) {
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
  return getSelectedNonGroupedItems().filter(p => PaperUtil.isPath(p)) as paper.Path[];
}

export function processRectangularSelection(
  event: paper.ToolEvent,
  rect: paper.Path.Rectangle,
  processDetails = false,
) {
  itemLoop: for (const item of getAllSelectableItems()) {
    // Check for item segment points inside selectionRect.
    if (PaperUtil.isGroup(item) || PaperUtil.isCompoundPath(item)) {
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
    if (PaperUtil.isGroup(child) || PaperUtil.isCompoundPath(child)) {
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
  if (PaperUtil.isPath(item)) {
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

/** Returns the parent group, or undefined if the parent is not a group. */
function getParentGroup(item: paper.Item) {
  return PaperUtil.isGroup(item.parent) ? item.parent : undefined;
}

function getAllSelectableItems() {
  const selectables: paper.Item[] = [];
  for (const item of PaperUtil.getAllItems()) {
    if (item.data && !item.data.isHelperItem) {
      selectables.push(item);
    }
  }
  return selectables;
}

export function snapDeltaToAngle(delta: paper.Point, snapAngle: number) {
  let angle = Math.atan2(delta.y, delta.x);
  angle = Math.round(angle / snapAngle) * snapAngle;
  const dirx = Math.cos(angle);
  const diry = Math.sin(angle);
  const d = dirx * delta.x + diry * delta.y;
  return new paper.Point(dirx * d, diry * d);
}

// TODO: move this somewhere else?
// export function fromLayer(vl: VectorLayer) {
//   return (function recurseFn(layer: Layer) {
//     if (layer instanceof PathLayer) {
//       // TODO: what to do about the 'stroke scaling' property for items?
//       const pathStr = layer.pathData ? layer.pathData.getPathString() : '';
//       const item = new paper.CompoundPath(pathStr);
//       item.fillColor = layer.fillColor;
//       item.strokeColor = layer.strokeColor;
//       item.strokeWidth = layer.strokeWidth;
//       item.miterLimit = layer.strokeMiterLimit;
//       item.strokeJoin = layer.strokeLinejoin;
//       item.strokeCap = layer.strokeLinecap;
//       if (layer.fillType === 'evenOdd') {
//         // Note that the 'o' is intentionally not capitalized here.
//         item.fillRule = 'evenodd';
//       }
//       // TODO: convert trim path properties to/from stroke dash array
//       // TODO: deal with fill and stroke opacity!!!!!
//       const { trimPathStart, trimPathEnd, trimPathOffset, fillAlpha, strokeAlpha } = layer;
//       item.data = {
//         trimPathStart,
//         trimPathEnd,
//         trimPathOffset,
//         fillAlpha,
//         strokeAlpha,
//       };
//       return item;
//     }
//     if (layer instanceof ClipPathLayer) {
//       const pathStr = layer.pathData ? layer.pathData.getPathString() : '';
//       const item = new paper.CompoundPath(pathStr);
//       item.clipMask = true;
//       return item;
//     }
//     if (layer instanceof GroupLayer) {
//       const item = new paper.Group();
//       item.applyMatrix = false;
//       const { pivotX, pivotY, scaleX, scaleY, translateX, translateY, rotation } = layer;
//       item.data = {
//         pivotX,
//         pivotY,
//         scaleX,
//         scaleY,
//         translateX,
//         translateY,
//         rotation,
//       };
//       const children = layer.children.map(l => recurseFn(l));
//       item.addChildren(children);
//       return item;
//     }
//     if (layer instanceof VectorLayer) {
//       const item = new paper.Group();
//       item.applyMatrix = false;
//       const children = layer.children.map(l => recurseFn(l));
//       item.addChildren(children);
//       return item;
//     }
//     throw new TypeError('Unknown layer type: ' + layer);
//   })(vl) as paper.Group;
// }
