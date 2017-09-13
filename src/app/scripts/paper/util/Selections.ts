// Selection related helper functions. Depends on Items and GuideUtil.

import * as paper from 'paper';

import * as Guides from './Guides';
import * as Items from './Items';

// TODO: make sure we exclude selected items in the guide layer?
export function getSelectedItems() {
  return paper.project.selectedItems;
}

export function getSelectedPaths() {
  return getSelectedItems().filter(p => p instanceof paper.Path) as paper.Path[];
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

// TODO: figure out what to do with compound paths and groups
export function setSelection(item: paper.Item, isSelected: boolean) {
  item.selected = isSelected;
}

// TODO: figure out what to do with compound paths and groups
export function select(item: paper.Item) {
  setSelection(item, true);
}

// TODO: figure out what to do with compound paths and groups
export function deselect(item: paper.Item) {
  setSelection(item, false);
}

/**
 * Deselects everything in the project and removes all children from the guide layer.
 */
export function deselectAll() {
  Guides.getGuideLayer().removeChildren();
  paper.project.deselectAll();
}

/**
 * Returns true iff the given path is open and has a single selected
 * end point segment.
 */
export function hasSingleSelectedEndPointSegment(path: paper.Path) {
  const selectedSegments = path.segments.filter(s => s.selected);
  return (
    !path.closed &&
    selectedSegments.length === 1 &&
    (selectedSegments[0].isFirst() || selectedSegments[0].isLast())
  );
}
