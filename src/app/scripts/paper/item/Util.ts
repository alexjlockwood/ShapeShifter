import {
  ClipPathLayer,
  GroupLayer,
  Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/model/layers';
import { ColorUtil } from 'app/scripts/common';
import * as paper from 'paper';

export function newVectorLayerItem(vl: VectorLayer): paper.Item {
  const item = new paper.Group();
  if (!vl) {
    return item;
  }
  item.data.id = vl.id;
  item.opacity = vl.alpha;
  item.addChildren(
    vl.children.map(function recurseFn(layer: Layer) {
      if (layer instanceof PathLayer) {
        // TODO: return a compound path instead
        return fromPathLayer(layer);
      }
      if (layer instanceof ClipPathLayer) {
        // TODO: return a compound path instead
        return fromClipPathLayer(layer);
      }
      if (layer instanceof GroupLayer) {
        const groupItem = fromGroupLayer(layer);
        groupItem.addChildren(layer.children.map(l => recurseFn(l)));
        return groupItem;
      }
      throw new TypeError('Unknown layer type: ' + layer);
    }),
  );
  return item;

  function fromPathLayer(layer: PathLayer) {
    const { fillColor, fillAlpha, strokeColor, strokeAlpha } = layer;
    const { trimPathStart, trimPathEnd, trimPathOffset } = layer;
    // TODO: make sure this works with compound paths as well (Android behavior is different)
    const pathLength = layer.pathData ? layer.pathData.getPathLength() : 0;
    const dashArray = pathLength
      ? LayerUtil.toStrokeDashArray(trimPathStart, trimPathEnd, trimPathOffset, pathLength)
      : undefined;
    const dashOffset = pathLength
      ? LayerUtil.toStrokeDashOffset(trimPathStart, trimPathEnd, trimPathOffset, pathLength)
      : undefined;
    const f = ColorUtil.parseAndroidColor(fillColor);
    const s = ColorUtil.parseAndroidColor(strokeColor);
    // TODO: import a compound path instead
    return new paper.Path({
      data: { id: layer.id },
      pathData: layer.pathData ? layer.pathData.getPathString() : '',
      fillColor: f ? new paper.Color(f.r, f.g, f.b, f.a * fillAlpha) : undefined,
      strokeColor: s ? new paper.Color(s.r, s.g, s.b, s.a * strokeAlpha) : undefined,
      strokeWidth: layer.strokeWidth,
      miterLimit: layer.strokeMiterLimit,
      strokeJoin: layer.strokeLinejoin,
      strokeCap: layer.strokeLinecap,
      fillRule: layer.fillType === 'evenOdd' ? 'evenodd' : 'nonzero',
      dashArray,
      dashOffset,
    });
  }

  function fromClipPathLayer(layer: ClipPathLayer) {
    return new paper.Path({
      data: { id: layer.id },
      pathData: layer.pathData ? layer.pathData.getPathString() : '',
      clipMask: true,
    });
  }

  function fromGroupLayer(layer: GroupLayer) {
    const { pivotX, pivotY, scaleX, scaleY, rotation, translateX, translateY } = layer;
    const pivot = new paper.Matrix(1, 0, 0, 1, pivotX, pivotY);
    const scale = new paper.Matrix(scaleX, 0, 0, scaleY, 0, 0);
    const cosr = Math.cos(rotation * Math.PI / 180);
    const sinr = Math.sin(rotation * Math.PI / 180);
    const rotate = new paper.Matrix(cosr, sinr, -sinr, cosr, 0, 0);
    const translate = new paper.Matrix(1, 0, 0, 1, translateX, translateY);
    const matrix = new paper.Matrix()
      .prepend(pivot.inverted())
      .prepend(scale)
      .prepend(rotate)
      .prepend(translate)
      .prepend(pivot);
    return new paper.Group({ data: { id: layer.id }, matrix });
  }
}

/** Creates a new hover path for the specified item. */
export function newHoverPath(item: paper.Item) {
  let hoverPath: paper.Path;
  if (item instanceof paper.Group) {
    hoverPath = new paper.Path.Rectangle(item.bounds);
  } else if (item instanceof paper.Path) {
    hoverPath = new paper.Path(item.segments);
    hoverPath.closed = item.closed;
  }
  if (hoverPath) {
    hoverPath.strokeColor = '#009dec';
    hoverPath.guide = true;
    hoverPath.strokeScaling = false;
    hoverPath.strokeWidth = 2 / paper.view.zoom;
    hoverPath.matrix = localToViewportCoordinates(item);
  }
  return hoverPath;
}

/** Creates a new selection bounds item for the specified selected items. */
export function newSelectionBoundsItem(items: ReadonlyArray<paper.Item>) {
  const group = new paper.Group();

  const flattenedItems: paper.Item[] = [];
  console.log(items);
  items.forEach(function recurseFn(i: paper.Item) {
    if (i.hasChildren()) {
      i.children.forEach(c => recurseFn(c));
    } else {
      flattenedItems.push(i);
    }
  });

  const bounds = flattenedItems.reduce((p, c) => {
    return p.unite(transformRectangle(c.bounds, localToViewportCoordinates(c)));
  }, transformRectangle(flattenedItems[0].bounds, localToViewportCoordinates(flattenedItems[0])));

  // Draw an outline for the bounded box.
  const outlinePath = new paper.Path.Rectangle(bounds);
  outlinePath.strokeScaling = false;
  outlinePath.strokeWidth = 2 / paper.view.zoom;
  outlinePath.strokeColor = '#aaaaaa';
  outlinePath.guide = true;
  group.addChild(outlinePath);

  // Create segments for the bounded box.
  const segmentSize = 6 / paper.view.zoom / getProjectScaling();
  const createSegmentFn = (center: paper.Point) => {
    const topLeftPoint = center.subtract(new paper.Point(segmentSize / 2, segmentSize / 2));
    const segmentPath = new paper.Path.Rectangle(
      topLeftPoint,
      new paper.Size(segmentSize, segmentSize),
    );
    segmentPath.strokeColor = '#aaaaaa';
    segmentPath.fillColor = 'white';
    segmentPath.strokeWidth = 1 / paper.view.zoom;
    segmentPath.strokeScaling = false;
    return segmentPath;
  };

  [
    bounds.topLeft,
    bounds.topCenter,
    bounds.topRight,
    bounds.rightCenter,
    bounds.bottomRight,
    bounds.bottomCenter,
    bounds.bottomLeft,
    bounds.leftCenter,
  ].forEach(p => group.addChild(createSegmentFn(p)));

  return group;
}

export function newSelectionBoxPath(from: paper.Point, to: paper.Point) {
  const path = new paper.Path.Rectangle(new paper.Rectangle(from, to));
  path.strokeScaling = false;
  path.strokeWidth = 1 / paper.view.zoom;
  path.guide = true;
  path.strokeColor = '#aaaaaa';
  path.dashArray = [3 / paper.view.zoom];
  return path;
}

/**
 * Converts a point to an item's local coordinate space. If no item is provided,
 * the point is converted to the root vector layer's viewport coordinate space.
 */
export function mousePointToLocalCoordinates(
  mousePoint: { x: number; y: number },
  item: paper.Item = paper.project.activeLayer,
) {
  const matrix = new paper.Matrix();
  while (item) {
    matrix.prepend(item.matrix);
    item = item.parent;
  }
  return new paper.Point(mousePoint).transform(matrix.inverted());
}

/**
 * Computes the transform matrix that will transform the specified item to its
 * viewport coordinates.
 */
export function localToViewportCoordinates(item: paper.Item) {
  const matrix = new paper.Matrix();
  while (item !== paper.project.activeLayer) {
    matrix.prepend(item.matrix);
    item = item.parent;
  }
  return matrix;
}

function transformRectangle(rect: paper.Rectangle, matrix: paper.Matrix) {
  return new paper.Rectangle(rect.topLeft.transform(matrix), rect.bottomRight.transform(matrix));
}

/**
 * Returns the project's global scale factor, representing the number of CSS pixels
 * per viewport pixel.
 */
export function getProjectScaling() {
  // Given unit vectors u0 = (0, 1) and v0 = (1, 0).
  //
  // After matrix mapping, we get u1 and v1. Let Θ be the angle between u1 and v1.
  // Then the final scale we want is:
  //
  // Math.min(|u1|sin(Θ),|v1|sin(Θ)) = |u1||v1|sin(Θ) / Math.max(|u1|,|v1|)
  //
  // If Math.max(|u1|,|v1|) = 0, that means either x or y has a scale of 0.
  //
  // For the non-skew case, which is most of the cases, matrix scale is
  // computing exactly the scale on x and y axis, and take the minimal of these two.
  //
  // For the skew case, an unit square will mapped to a parallelogram,
  // and this function will return the minimal height of the 2 bases.
  const { matrix } = paper.project.activeLayer;
  const m = new paper.Matrix(matrix.a, matrix.b, matrix.c, matrix.d, 0, 0);
  const u0 = new paper.Point(0, 1);
  const v0 = new paper.Point(1, 0);
  const u1 = u0.transform(m);
  const v1 = v0.transform(m);
  const sx = Math.hypot(u1.x, u1.y);
  const sy = Math.hypot(v1.x, v1.y);
  const dotProduct = u1.y * v1.x - u1.x * v1.y;
  const maxScale = Math.max(sx, sy);
  return maxScale > 0 ? Math.abs(dotProduct) / maxScale : 0;
}
