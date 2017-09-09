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

import * as Transforms from './Transforms';

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
export function newHover(item: paper.Item) {
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
    hoverPath.matrix = Transforms.localToViewportCoordinates(item);
  }
  return hoverPath;
}

/** Creates a new selection bounds item for the specified selected items. */
export function newSelectionBounds(items: ReadonlyArray<paper.Item>) {
  const group = new paper.Group();

  const flattenedItems: paper.Item[] = [];
  items.forEach(function recurseFn(i: paper.Item) {
    if (i.hasChildren()) {
      i.children.forEach(c => recurseFn(c));
    } else {
      flattenedItems.push(i);
    }
  });

  const transformRectFn = Transforms.transformRectangle;
  const localToViewportFn = Transforms.localToViewportCoordinates;
  const bounds = flattenedItems.reduce((p, c) => {
    return p.unite(transformRectFn(c.bounds, localToViewportFn(c)));
  }, transformRectFn(flattenedItems[0].bounds, localToViewportFn(flattenedItems[0])));

  // Draw an outline for the bounded box.
  const outlinePath = new paper.Path.Rectangle(bounds);
  outlinePath.strokeScaling = false;
  outlinePath.strokeWidth = 2 / paper.view.zoom;
  outlinePath.strokeColor = '#e8e8e8';
  outlinePath.guide = true;
  group.addChild(outlinePath);

  // Create segments for the bounded box.
  const segmentSize = 6 / paper.view.zoom / Transforms.getCssScaling();
  const createSegmentFn = (center: paper.Point) => {
    // TODO: avoid creating rasters in a loop like this
    const handle = new paper.Raster('/assets/handle.png', center);
    const scaleFactor = 1 / Transforms.getAttrScaling();
    handle.scale(scaleFactor, scaleFactor);
    return handle;
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

/** Creates the overlay decorations for the given selected path. */
export function newSelectedPath(path: paper.Path) {
  const group = new paper.Group();
  const scaleFactor = 1 / Transforms.getAttrScaling();
  const matrix = Transforms.localToViewportCoordinates(path);
  const addRasterFn = (url: string, center: paper.Point) => {
    const raster = new paper.Raster(url, center);
    raster.scale(scaleFactor, scaleFactor);
    raster.transform(matrix);
    group.addChild(raster);
  };
  const addLineFn = (from: paper.Point, to: paper.Point) => {
    const line = new paper.Path.Line(from, to);
    line.strokeColor = '#aaaaaa';
    line.strokeWidth = 1 / paper.view.zoom;
    line.strokeScaling = false;
    line.transform(matrix);
    group.addChild(line);
  };
  // TODO: avoid creating rasters in a loop like this
  path.segments.forEach(s => {
    const center = s.point;
    if (s.handleIn) {
      const handleIn = center.add(s.handleIn);
      addLineFn(center, handleIn);
      addRasterFn('/assets/vector_handle.png', handleIn);
    }
    if (s.handleOut) {
      const handleOut = center.add(s.handleOut);
      addLineFn(center, handleOut);
      addRasterFn('/assets/vector_handle.png', handleOut);
    }
    addRasterFn('/assets/vector_anchor.png', center);
  });
  return group;
}

export function newShapePreview(pathData: string) {
  const path = new paper.Path(pathData);
  path.strokeScaling = false;
  path.strokeWidth = 1 / paper.view.zoom;
  path.guide = true;
  path.strokeColor = 'black';
  return path;
}

export function newSelectionBox(from: paper.Point, to: paper.Point) {
  const path = new paper.Path.Rectangle(new paper.Rectangle(from, to));
  path.strokeScaling = false;
  path.strokeWidth = 1 / paper.view.zoom;
  path.guide = true;
  path.strokeColor = '#aaaaaa';
  path.dashArray = [3 / paper.view.zoom];
  return path;
}
