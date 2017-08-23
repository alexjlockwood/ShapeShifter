import * as $ from 'jquery';
import * as paper from 'paper';

export function getAllPaperItems(includeGuides = false) {
  const allItems: paper.Item[] = [];
  for (const layer of paper.project.layers) {
    for (const child of layer.children) {
      if (includeGuides || !child.guide) {
        allItems.push(child);
      }
    }
  }
  return allItems;
}

export function removePaperItemsByDataTags(tags) {
  const allItems = getAllPaperItems(true);
  $.each(allItems, function(index, item) {
    $.each(tags, function(ti, tag) {
      if (item.data && item.data[tag]) {
        item.remove();
      }
    });
  });
}
