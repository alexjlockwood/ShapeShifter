import * as paper from 'paper';

import * as GuideUtil from './GuideUtil';
import * as PaperUtil from './PaperUtil';

let hoveredItem: paper.Path;

export function handleHoveredItem(hitOptions: paper.HitOptions, event: paper.ToolEvent) {
  const hitResult = paper.project.hitTest(event.point, hitOptions);
  if (!hitResult) {
    clearHoveredItem();
    return;
  }
  if (hitResult.item.data && hitResult.item.data.noHover) {
    return;
  }
  clearHoveredItem();
  const { item } = hitResult;
  if (!item.selected) {
    if (item instanceof paper.Shape) {
      hoveredItem = GuideUtil.hoverBounds(item);
    } else if (PaperUtil.isGroup(PaperUtil.findParentLayer(item))) {
      hoveredItem = GuideUtil.hoverBounds(PaperUtil.findParentLayer(item));
    } else {
      hoveredItem = GuideUtil.hoverItem(hitResult);
    }
  }
}

export function clearHoveredItem() {
  if (hoveredItem) {
    hoveredItem.remove();
    hoveredItem = undefined;
  }
  paper.view.update();
}
