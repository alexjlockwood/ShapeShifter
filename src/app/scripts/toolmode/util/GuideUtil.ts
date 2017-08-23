import * as paper from 'paper';

import * as PaperUtil from './PaperUtil';

const guideBlue = '#009dec';
const guideGrey = '#aaaaaa';

export function hoverItem(hitResult: paper.HitResult) {
  const { item } = hitResult;
  const segments = item instanceof paper.Path ? item.segments : [];
  const clone = new paper.Path(segments);
  setDefaultGuideStyle(clone);
  if (item instanceof paper.Path && item.closed) {
    clone.closed = true;
  }
  clone.parent = PaperUtil.findGuideLayer();
  clone.strokeColor = guideBlue;
  clone.fillColor = undefined;
  clone.data.isHelperItem = true;
  clone.bringToFront();
  return clone;
}

export function hoverBounds(item: paper.Item) {
  // TODO: missing types (hacky)
  const internalBounds = (item as any).internalBounds;
  const rect = new paper.Path.Rectangle(internalBounds);
  rect.matrix = item.matrix;
  setDefaultGuideStyle(rect);
  rect.parent = PaperUtil.findGuideLayer();
  rect.strokeColor = guideBlue;
  rect.fillColor = undefined;
  rect.data.isHelperItem = true;
  rect.bringToFront();
  return rect;
}

export function rectSelect(event: paper.ToolEvent, color = guideGrey) {
  const half = new paper.Point(0.5 / paper.view.zoom, 0.5 / paper.view.zoom);
  const start = event.downPoint.add(half);
  const end = event.point.add(half);
  const rect = new paper.Path.Rectangle(start, end);
  const zoom = 1.0 / paper.view.zoom;
  setDefaultGuideStyle(rect);
  rect.parent = PaperUtil.findGuideLayer();
  rect.strokeColor = color;
  // TODO: missing types
  rect.data.isRectSelect = true;
  rect.data.isHelperItem = true;
  rect.dashArray = [3 * zoom, 3 * zoom];
  return rect;
}

function rotPivot(center: paper.Point, color = guideBlue) {
  const zoom = 1 / paper.view.zoom;
  const path = new paper.Path.Circle(center, 3 * zoom);
  setDefaultGuideStyle(path);
  path.parent = PaperUtil.findGuideLayer();
  path.fillColor = color;
  // TODO: missing types
  path.data.isHelperItem = true;
  return path;
}

function setDefaultGuideStyle(item: paper.Item) {
  item.strokeWidth = 1 / paper.view.zoom;
  item.opacity = 1;
  item.blendMode = 'normal';
  item.guide = true;
}

export function getGuideColor(colorName: 'blue' | 'grey') {
  if (colorName === 'blue') {
    return guideBlue;
  } else if (colorName === 'grey') {
    return guideGrey;
  }
  return undefined;
}

export function removeHelperItems() {
  const allItems = PaperUtil.getAllPaperItems(true);
  $.each(allItems, (index, item) => {
    $.each(['isHelperItem'], (ti, tag) => {
      if (item.data && item.data[tag]) {
        item.remove();
      }
    });
  });
}
