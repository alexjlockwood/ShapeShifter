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

export function createDragRect(p1: paper.Point, p2: paper.Point) {
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
  rect.strokeWidth = 1 / paper.view.zoom;
  rect.dashOffset = 0.5 / paper.view.zoom;
  rect.dashArray = [1 / paper.view.zoom, 1 / paper.view.zoom];
  rect.removeOn({ drag: true, up: true });
  // TODO: missing types
  (rect as any).guide = true;
  return rect;
}

export function setCanvasRotateCursor(dir: paper.Point, da: number) {
  // Zero is up, counter clockwise.
  const angle = Math.atan2(dir.x, -dir.y) + da;
  const index = indexFromAngle(angle);
  const cursors: ReadonlyArray<Cursor> = [
    Cursor.Rotate0,
    Cursor.Rotate45,
    Cursor.Rotate90,
    Cursor.Rotate135,
    Cursor.Rotate180,
    Cursor.Rotate225,
    Cursor.Rotate270,
    Cursor.Rotate315,
  ];
  setCanvasCursor(cursors[index % 8]);
}

export function setCanvasScaleCursor(dir: paper.Point) {
  // Zero is up, counter clockwise.
  const angle = Math.atan2(dir.x, -dir.y);
  const index = indexFromAngle(angle);
  const cursors: ReadonlyArray<Cursor> = [
    Cursor.Scale0,
    Cursor.Scale45,
    Cursor.Scale90,
    Cursor.Scale135,
  ];
  setCanvasCursor(cursors[index % 4]);
}

export function setCanvasCursor(name: Cursor) {
  // TODO: make this a constant somehow...
  // TODO: make this a constant somehow...
  // TODO: make this a constant somehow...
  // TODO: make this a constant somehow...
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

/**
 * Returns all items intersecting the rect.
 * Note: only the item outlines are tested.
 */
export function getPathsIntersectingRect(rect: paper.Rectangle) {
  const paths: paper.PathItem[] = [];
  const boundingRect = new paper.Path.Rectangle(rect);

  // TODO: missing types
  const checkPathItemFn = item => {
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
      return;
    }
    for (let i = item.children.length - 1; i >= 0; i--) {
      checkPathItemFn(item.children[i]);
    }
  };

  for (const layer of paper.project.layers) {
    checkPathItemFn(layer);
  }
  boundingRect.remove();
  return paths;
}

export function findItemById(id: number): paper.Item {
  if (id === -1) {
    return undefined;
  }
  const findItemFn = (item: paper.Item) => {
    if (item.id === id) {
      return item;
    }
    if (item.children) {
      for (let i = item.children.length - 1; i >= 0; i--) {
        const it = findItemFn(item.children[i]);
        if (it) {
          return it;
        }
      }
    }
    return undefined;
  };
  for (const layer of paper.project.layers) {
    const it = findItemFn(layer);
    if (it) {
      return it;
    }
  }
  return undefined;
}

/**
 * Returns the bounding box of all selected items.
 */
export function getSelectionBounds() {
  let bounds: paper.Rectangle;
  paper.project.getSelectedItems().forEach(item => {
    if (bounds) {
      bounds = bounds.unite(item.bounds);
    } else {
      bounds = item.bounds.clone();
    }
  });
  return bounds;
}

// Returns path points which are contained in the rect.
export function getSegmentsInRect(rect) {
  const segments: paper.Segment[] = [];

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
      for (let i = children.length - 1; i >= 0; i--) {
        checkPathItem(children[i]);
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

export function deselectAllSegments() {
  paper.project.getSelectedItems().forEach(item => {
    if (item instanceof paper.Path) {
      item.segments.forEach(s => (s.selected = false));
    }
  });
}

/**
 * Returns serialized contents of all selected items.
 */
export function captureSelectionState() {
  const originalContent: SelectionState[] = [];
  const selected = paper.project.getSelectedItems();
  for (const item of selected) {
    // TODO: missing types
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

/**
 * Restores the state of all selected items.
 */
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

export interface SelectionState {
  id: number;
  json: string;
  selectedSegments: ReadonlyArray<paper.Segment>;
}

export enum Cursor {
  Hand = 'cursor-hand',
  HandGrab = 'cursor-hand-grab',
  ZoomIn = 'cursor-zoom-in',
  ZoomOut = 'cursor-zoom-out',
  ArrowBlack = 'cursor-arrow-black',
  ArrowBlackShape = 'cursor-arrow-black-shape',
  ArrowWhite = 'cursor-arrow-white',
  ArrowSmall = 'cursor-arrow-small',
  ArrowDuplicate = 'cursor-arrow-duplicate',
  ArrowWhiteShape = 'cursor-arrow-white-shape',
  ArrowSmallPoint = 'cursor-arrow-small-point',
  ArrowWhitePoint = 'cursor-arrow-white-point',
  PenAdd = 'cursor-pen-add',
  PenClose = 'cursor-pen-close',
  PenAdjust = 'cursor-pen-adjust',
  PenJoin = 'cursor-pen-join',
  PenEdit = 'cursor-pen-edit',
  PenRemove = 'cursor-pen-remove',
  PenCreate = 'cursor-pen-create',
  Rotate0 = 'cursor-rotate-0',
  Rotate45 = 'cursor-rotate-45',
  Rotate90 = 'cursor-rotate-90',
  Rotate135 = 'cursor-rotate-135',
  Rotate180 = 'cursor-rotate-180',
  Rotate225 = 'cursor-rotate-225',
  Rotate270 = 'cursor-rotate-270',
  Rotate315 = 'cursor-rotate-315',
  Scale0 = 'cursor-scale-0',
  Scale45 = 'cursor-scale-45',
  Scale90 = 'cursor-scale-90',
  Scale135 = 'cursor-scale-135',
}
