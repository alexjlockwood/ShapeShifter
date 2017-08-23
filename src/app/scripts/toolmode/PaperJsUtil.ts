import * as paper from 'paper';

import * as ItemUtil from './ItemUtil';

let isPaperJsSetup = false;

export function setup(canvas: HTMLCanvasElement) {
  if (isPaperJsSetup) {
    return;
  }
  paper.setup(canvas);
  paper.settings.handleSize = 8;
  const mainLayer = ItemUtil.createMainLayer();
  paper.project.addLayer(mainLayer);
  const guideLayer = ItemUtil.createGuideLayer();
  paper.project.addLayer(guideLayer);
  mainLayer.activate();
  isPaperJsSetup = true;
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
