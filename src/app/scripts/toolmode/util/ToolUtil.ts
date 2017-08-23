import * as $ from 'jquery';
import * as paper from 'paper';

import * as HoverUtil from './HoverUtil';
import * as PaperUtil from './PaperUtil';

export function clearSelection() {
  paper.project.deselectAll();
  // pg.stylebar.sanitizeSettings();

  // pg.statusbar.update();
  // pg.stylebar.blurInputs();
  HoverUtil.clearHoveredItem();
  $(document).trigger('SelectionChanged');
}

export function splitPathAtSelectedSegments() {
  const items = getSelectedNonGroupedItems().filter(i => i instanceof paper.Path) as paper.Path[];
  for (const item of items) {
    for (let j = 0; j < item.segments.length; j++) {
      const seg = item.segments[j];
      if (!seg.selected) {
        continue;
      }
      const { next, previous } = seg;
      if (item.closed || (next && !next.selected && previous && !previous.selected)) {
        splitPathRetainSelection(item, j, true);
        splitPathAtSelectedSegments();
        return;
      }
    }
  }
}

function splitPathRetainSelection(path: paper.Path, index: number, deselectSplitSegments: boolean) {
  const selectedPoints: paper.Point[] = [];

  // Collect points of selected segments, so we can reselect them
  // once the path is split.
  for (let i = 0; i < path.segments.length; i++) {
    const seg = path.segments[i];
    if (!seg.selected || (deselectSplitSegments && i === index)) {
      continue;
    }
    selectedPoints.push(seg.point);
  }

  const newPath = path.split(index, 0);
  if (!newPath) {
    return;
  }

  // Reselect all of the newPaths segments that are in the exact same location
  // as the ones that are stored in selectedPoints.
  newPath.segments.forEach(s =>
    selectedPoints.forEach(p => {
      if (p.x === s.point.x && p.y === s.point.y) {
        s.selected = true;
      }
    }),
  );

  // Only do this if path and newPath are different (split at more than one point).
  if (path !== newPath) {
    path.segments.forEach(s =>
      selectedPoints.forEach(p => {
        if (p.x === s.point.x && p.y === s.point.y) {
          s.selected = true;
        }
      }),
    );
  }
}

export function cloneSelection() {
  getSelectedNonGroupedItems().forEach(item => {
    item.clone();
    item.selected = false;
  });
  // pg.undo.snapshot('cloneSelection');
}

export function setItemSelection(item: paper.Item, isSelected: boolean) {
  const parentGroup = getItemsGroup(item);
  const itemsCompoundPath = item.parent instanceof paper.CompoundPath ? item.parent : undefined;

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
  // pg.statusbar.update();
  // pg.stylebar.updateFromSelection();
  // pg.stylebar.blurInputs();

  // TODO: figure out better way of sending notifications
  $(document).trigger('SelectionChanged');
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
  return itemsAndGroups;
}

/**
 * Only returns selected paths (no compound paths, groups, or any other stuff).
 */
export function getSelectedPaths() {
  return getSelectedNonGroupedItems().filter(p => p instanceof paper.Path) as paper.Path[];
}

export function processRectangularSelection(
  event: paper.ToolEvent,
  rect: paper.Path.Rectangle,
  processDetails = false,
) {
  itemLoop: for (const item of getAllSelectableItems()) {
    // Check for item segment points inside selectionRect.
    if (isGroup(item) || item instanceof paper.CompoundPath) {
      if (!rectangularSelectionGroupLoop(item as paper.Group, rect, item, event, processDetails)) {
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
    if (isGroup(child) || child instanceof paper.CompoundPath) {
      rectangularSelectionGroupLoop(child as paper.Group, rect, root, event, processDetails);
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
  if (item instanceof paper.Path) {
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
    // pg.statusbar.update();
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

function getItemsGroup(item) {
  const itemParent = item.parent;
  if (isGroup(itemParent)) {
    return itemParent;
  } else {
    return undefined;
  }
}

function isGroup(item: paper.Item) {
  return item && item.className && item.className === 'Group';
}

export function getAllSelectableItems() {
  const selectables: paper.Item[] = [];
  for (const item of PaperUtil.getAllPaperItems()) {
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
