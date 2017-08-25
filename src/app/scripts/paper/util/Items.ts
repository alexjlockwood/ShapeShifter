import * as _ from 'lodash';
import * as paper from 'paper';

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

/** Returns all items, optionally including guides. */
export function getAllItems(includeGuides = false) {
  const items: paper.Item[] = [];
  for (const layer of paper.project.layers) {
    for (const child of layer.children) {
      if (!child.guide || includeGuides) {
        items.push(child);
      }
    }
  }
  return items;
}

/** Finds the first Item in the project with the specified name. */
export function findItemByName(name: string) {
  for (const layer of paper.project.layers) {
    const match = (function fn(item: paper.Item): paper.Item {
      if (item.name === name) {
        return item;
      }
      for (const child of item.children || []) {
        const m = fn(child);
        if (m) {
          return m;
        }
      }
      return undefined;
    })(layer);
    if (match) {
      return match;
    }
  }
  return undefined;
}

/** Computes the bounding box for the specified items. */
export function computeBoundingBox(items: ReadonlyArray<paper.Item>) {
  return items.reduce((p, c) => p.unite(c.bounds), items[0].bounds);
}

// export function removeHelperItems() {
//   getAllItems(true).forEach((item, index) => {
//     if (item.data && item.data.isHelperItem) {
//       item.remove();
//     }
//   });
// }

/**
 * Returns all selected non-grouped items and groups (as opposed
 * to paper.project.selectedItems, which includes the parent group
 * as well as its children).
 */
// export function getSelectedNonGroupedItems() {
//   const itemsAndGroups: paper.Item[] = [];
//   for (const item of paper.project.selectedItems) {
//     if (!isGroup(item.parent) && item.data && !item.data.isSelectionBound) {
//       itemsAndGroups.push(item);
//     }
//   }
//   // Sort items by index (0 at bottom).
//   itemsAndGroups.sort((a, b) => a.index - b.index);
//   return itemsAndGroups as ReadonlyArray<paper.Item>;
// }

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
