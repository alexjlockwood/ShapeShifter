import * as $ from 'jquery';
import * as paper from 'paper';

export function snapDeltaToAngle(delta: paper.Point, snapAngle: number) {
  let angle = Math.atan2(delta.y, delta.x);
  angle = Math.round(angle / snapAngle) * snapAngle;
  const dirx = Math.cos(angle);
  const diry = Math.sin(angle);
  const d = dirx * delta.x + diry * delta.y;
  return new paper.Point(dirx * d, diry * d);
}

export function dragRect(p1: paper.Point, p2: paper.Point) {
  // Create pixel perfect dotted rectable for drag selections.
  const half = new paper.Point(0.5 / paper.view.zoom, 0.5 / paper.view.zoom);
  const start = p1.add(half);
  const end = p2.add(half);
  const rect = new paper.CompoundPath(undefined);
  rect.moveTo(start);
  rect.lineTo(new paper.Point(start.x, end.y));
  rect.lineTo(end);
  rect.moveTo(start);
  rect.lineTo(new paper.Point(end.x, start.y));
  rect.lineTo(end);
  rect.strokeColor = 'black';
  rect.strokeWidth = 1.0 / paper.view.zoom;
  rect.dashOffset = 0.5 / paper.view.zoom;
  rect.dashArray = [1.0 / paper.view.zoom, 1.0 / paper.view.zoom];
  rect.removeOn({
    drag: true,
    up: true,
  });
  (rect as any).guide = true;
  return rect;
}

export function setCanvasRotateCursor(dir: paper.Point, da: number) {
  // Zero is up, counter clockwise.
  const angle = Math.atan2(dir.x, -dir.y) + da;
  const index = indexFromAngle(angle);
  const cursors = [
    'cursor-rotate-0',
    'cursor-rotate-45',
    'cursor-rotate-90',
    'cursor-rotate-135',
    'cursor-rotate-180',
    'cursor-rotate-225',
    'cursor-rotate-270',
    'cursor-rotate-315',
  ];
  setCanvasCursor(cursors[index % 8]);
}

export function setCanvasScaleCursor(dir: paper.Point) {
  // zero is up, counter clockwise
  const angle = Math.atan2(dir.x, -dir.y);
  const index = indexFromAngle(angle);
  const cursors = ['cursor-scale-0', 'cursor-scale-45', 'cursor-scale-90', 'cursor-scale-135'];
  setCanvasCursor(cursors[index % 4]);
}

export function setCanvasCursor(name: string) {
  // TODO: make this a constant somehow...
  $('.paper-canvas')
    .removeClass((index, css) => (css.match(/\bcursor-\S+/g) || []).join(' '))
    .addClass(name);
}

function indexFromAngle(angle: number) {
  const octant = Math.PI * 2 / 8;
  let index = Math.round(angle / octant);
  if (index < 0) {
    index += 8;
  }
  return index % 8;
}

// Returns all items intersecting the rect.
// Note: only the item outlines are tested.
export function getPathsIntersectingRect(rect: paper.Rectangle) {
  const paths = [];
  const boundingRect = new paper.Path.Rectangle(rect);

  function checkPathItem(item) {
    const children = item.children;
    if (item.equals(boundingRect)) {
      return;
    }
    if (!rect.intersects(item.bounds)) {
      return;
    }
    if (item instanceof paper.PathItem) {
      if (rect.contains(item.bounds)) {
        paths.push(item);
        return;
      }
      const isects = boundingRect.getIntersections(item);
      if (isects.length > 0) {
        paths.push(item);
      }
    } else {
      for (let j = children.length - 1; j >= 0; j--) {
        checkPathItem(children[j]);
      }
    }
  }

  for (const layer of paper.project.layers) {
    checkPathItem(layer);
  }

  boundingRect.remove();
  return paths;
}

export function findItemById(id: number): paper.Item {
  if (id === -1) {
    return undefined;
  }
  function findItem(item: paper.Item) {
    if (item.id === id) {
      return item;
    }
    if (item.children) {
      for (let j = item.children.length - 1; j >= 0; j--) {
        const it = findItem(item.children[j]);
        if (it) {
          return it;
        }
      }
    }
    return undefined;
  }

  for (let i = 0, l = paper.project.layers.length; i < l; i++) {
    const layer = paper.project.layers[i];
    const it = findItem(layer);
    if (it) {
      return it;
    }
  }
  return undefined;
}

/** Returns bounding box of all selected items. */
export function getSelectionBounds() {
  let bounds: paper.Rectangle = undefined;
  const selected = paper.project.getSelectedItems();
  for (const item of selected) {
    if (bounds === undefined) {
      bounds = item.bounds.clone();
    } else {
      bounds = bounds.unite(item.bounds);
    }
  }
  return bounds;
}

/** Restore the state of selected items. */
export function restoreSelectionState(originalContent: ReadonlyArray<SelectionState>) {
  for (const orig of originalContent) {
    const item = findItemById(orig.id);
    if (!item) {
      continue;
    }
    // HACK: paper does not retain item IDs after importJSON,
    // store the ID here, and restore after deserialization.
    const id = item.id;
    item.importJSON(orig.json);
    (item as any)._id = id;
  }
}

// Returns path points which are contained in the rect.
export function getSegmentsInRect(rect) {
  const segments = [];

  function checkPathItem(item) {
    if (item._locked || !item._visible || item._guide) {
      return;
    }
    const children = item.children;
    if (!rect.intersects(item.bounds)) {
      return;
    }
    if (item instanceof paper.Path) {
      for (const segment of item.segments) {
        if (rect.contains(segment.point)) {
          segments.push(segment);
        }
      }
    } else {
      for (let j = children.length - 1; j >= 0; j--) {
        checkPathItem(children[j]);
      }
    }
  }

  for (let i = paper.project.layers.length - 1; i >= 0; i--) {
    checkPathItem(paper.project.layers[i]);
  }

  return segments;
}

export function deselectAll() {
  paper.project.deselectAll();
}

export function deselectAllPoints() {
  const selected = paper.project.getSelectedItems();
  for (const item of selected) {
    if (item instanceof paper.Path) {
      for (const segment of item.segments) {
        if (segment.selected) {
          segment.selected = false;
        }
      }
    }
  }
}

/** Returns serialized contents of selected items. */
export function captureSelectionState() {
  const originalContent: SelectionState[] = [];
  const selected = paper.project.getSelectedItems();
  for (const item of selected) {
    if ((item as any).guide) {
      continue;
    }
    originalContent.push({
      id: item.id,
      json: item.exportJSON({ asString: false }),
      selectedSegments: [],
    });
  }
  return originalContent;
}

export interface SelectionState {
  id: number;
  json: string;
  selectedSegments: ReadonlyArray<paper.Segment>;
}
