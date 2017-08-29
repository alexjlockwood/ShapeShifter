// Selection related helper functions. Depends on Items and GuideUtil.

import * as paper from 'paper';

import * as Guides from './Guides';
import * as Items from './Items';

// =========================== //
// ===== Select/deselect ===== //
// =========================== //

export function setSelection(item: paper.Item, isSelected: boolean) {
  // const parentGroup = isGroup(item.parent) ? item.parent : undefined;
  // const itemsCompoundPath = isCompoundPath(item.parent) ? item.parent : undefined;

  // // If the selection is in a group, select the group, not the individual items.
  // if (parentGroup) {
  //   setSelection(parentGroup, isSelected);
  // } else if (itemsCompoundPath) {
  //   setSelection(itemsCompoundPath, isSelected);
  // } else {
  //   if (item.data && item.data.noSelect) {
  //     return;
  //   }

  // Fully selected segments need to be unselected first, so
  // that the item can be normally selected.
  item.fullySelected = false;
  item.selected = isSelected;

  //   // Deselect children of compound paths and groups.
  //   if (isGroup(item) || isCompoundPath(item)) {
  //     (item.children || []).forEach(child => (child.selected = !isSelected));
  //   }
  // }
}

export function deselectAll() {
  Guides.hideHoverPath();
  Guides.hideSelectionBounds();
  paper.project.deselectAll();
}

/**
 * Clones and deselects all currently selected items.
 */
export function cloneSelectedItems() {
  getSelectedItems().forEach(item => {
    item.clone();
    item.selected = false;
  });
}

export function getSelectedItems() {
  return paper.project.selectedItems;
}

/**
 * Only returns selected paths (no compound paths, groups, or any other stuff).
 */
export function getSelectedPaths() {
  return getSelectedItems().filter(p => Items.isPath(p)) as paper.Path[];
}

export function processRectangularSelection(
  event: paper.ToolEvent,
  rect: paper.Path.Rectangle,
  processDetails = false,
) {
  itemLoop: for (const item of getAllSelectableItems()) {
    // Check for item segment points inside the selection box.
    if (Items.isGroup(item) || Items.isCompoundPath(item)) {
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
    if (Items.isGroup(child) || Items.isCompoundPath(child)) {
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
  if (Items.isPath(item)) {
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
            setSelection(item, false);
          } else {
            setSelection(item, true);
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
          setSelection(item, false);
        } else {
          setSelection(item, true);
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
        setSelection(item, false);
      } else {
        setSelection(item, true);
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
  for (const item of Items.getAllItems()) {
    if (item.data && !item.data.isHelperItem) {
      selectables.push(item);
    }
  }
  return selectables;
}
