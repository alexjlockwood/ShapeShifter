import * as _ from 'lodash';
import * as paper from 'paper';

// ================================ //
// ===== Item instance checks ===== //
// ================================ //

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

// ============================ //
// ===== Helper functions ===== //
// ============================ //

/** Computes the bounding box for the specified items. */
export function computeBoundingBox(items: ReadonlyArray<paper.Item>) {
  return items.reduce((p, c) => p.unite(c.bounds), items[0].bounds);
}
