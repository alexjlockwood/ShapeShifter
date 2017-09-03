import * as _ from 'lodash';
import * as paper from 'paper';

const DATA_DISABLE_SELECT = 'disableSelect';

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

// ============================== //
// ===== Metadata functions ===== //
// ============================== //

export function isSelectable(item: paper.Item) {
  return !item.data[DATA_DISABLE_SELECT];
}

export function setSelectable(item: paper.Item, selectable: boolean) {
  item.data[DATA_DISABLE_SELECT] = !selectable;
}

// ========================== //
// ===== Item factories ===== //
// ========================== //

/**
 * Returns a new compound path. Takes an SVG string or an object
 * containing a subset of CompoundPath properties.
 */
export function newCompoundPath(obj?: string | Partial<paper.PathProps>) {
  return applyMatrixAndRemove(new paper.Path(obj));
}

/**
 * Returns a new path. Takes an SVG string, a list of segments, or an object
 * containing a subset of Path properties.
 */
export function newPath(obj?: string | ReadonlyArray<paper.Segment> | Partial<paper.PathProps>) {
  return applyMatrixAndRemove(new paper.Path(obj));
}

export function newRectangle(bounds: paper.Rectangle): paper.Path.Rectangle;
export function newRectangle(point: paper.Point, size: paper.Size): paper.Path.Rectangle;
export function newRectangle(arg1: paper.Rectangle | paper.Point, arg2?: paper.Size) {
  let rect: paper.Path.Rectangle;
  if (arg1 instanceof paper.Rectangle) {
    rect = new paper.Path.Rectangle(arg1);
  } else {
    rect = new paper.Path.Rectangle(arg1, arg2);
  }
  return applyMatrixAndRemove(rect);
}

export function newCircle(point: paper.Point, radius: number) {
  return applyMatrixAndRemove(new paper.Path.Circle(point, radius));
}

export function newLine(from: paper.Point, to: paper.Point) {
  return applyMatrixAndRemove(new paper.Path.Line(from, to));
}

export function newGroup(obj?: Partial<paper.GroupProps>) {
  return applyMatrixAndRemove(new paper.Group(obj), false /* applyMatrix */);
}

export function newLayer(obj?: Partial<paper.LayerProps>) {
  return applyMatrixAndRemove(new paper.Layer(obj), false /* applyMatrix */);
}

function applyMatrixAndRemove<T extends paper.Item>(item: T, applyMatrix = false) {
  item.applyMatrix = applyMatrix;
  item.remove();
  return item;
}

// ============================ //
// ===== Helper functions ===== //
// ============================ //

/** Computes the bounding box for the specified items. */
export function computeBoundingBox(items: ReadonlyArray<paper.Item>) {
  return items.reduce((p, c) => p.unite(c.bounds), items[0].bounds);
}
