import { MathUtil } from 'app/scripts/common';
import { PaperLayer } from 'app/scripts/paper/item';
import { PaperUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as _ from 'lodash';
import * as paper from 'paper';

const SNAP_TOLERANCE = 10;

/**
 * A helper class that processes mouse events before they are dispatched and
 * determines if currently selected items should be snapped to other items
 * in the project as a result.
 */
export class MouseSnapper {
  private readonly paperLayer = paper.project.activeLayer as PaperLayer;
  private snapInfo: SnapInfo;

  constructor(private readonly ps: PaperService) {}

  // TODO: return immediately in onMouseEvent() if the command key is pressed?
  // TODO: listen for and react to command key down/up events
  // TODO: figure out how to snap cloned items that were created mid-drag
  // TODO: also add the entire artwork's bounds as a guide as well?
  onMouseEvent(event: paper.ToolEvent) {
    if (event.type !== 'mousedrag') {
      return;
    }
    const dragItems = Array.from(this.ps.getSelectedLayers()).map(id =>
      this.paperLayer.findItemByLayerId(id),
    );
    if (!dragItems.length) {
      return;
    }
    const { parent } = dragItems[0];
    if (!dragItems.every(item => item.parent === parent)) {
      // TODO: determine if there is an alternative to exiting early?
      console.warn('all snapped items must share the same parent item');
      return;
    }
    const siblingItems = parent.children.filter(i => !dragItems.includes(i));
    if (!siblingItems.length) {
      return;
    }
    const dragSnapItem = new SnapItem(...dragItems);
    const siblingSnapResults = _.flatMap(siblingItems, sibling => {
      // Snap the drag item to each of its siblings.
      const { horizontal, vertical } = dragSnapItem.snap(new SnapItem(sibling));
      return {
        horizontal: { sibling, ...horizontal },
        vertical: { sibling, ...vertical },
      };
    });
    const horizontalSnapResult = filterByMinDelta(
      siblingSnapResults.map(({ horizontal }) => horizontal),
    );
    const verticalSnapResult = filterByMinDelta(siblingSnapResults.map(({ vertical }) => vertical));
    this.snapInfo = {
      horizontal: {
        delta: horizontalSnapResult.delta,
        values: horizontalSnapResult.values,
      },
      vertical: {
        delta: verticalSnapResult.delta,
        values: verticalSnapResult.values,
      },
    };
  }

  getSnapInfo() {
    return this.snapInfo;
  }
}

class SnapItem {
  readonly left: number;
  readonly midX: number;
  readonly right: number;
  readonly top: number;
  readonly midY: number;
  readonly bottom: number;

  constructor(...items: paper.Item[]) {
    const { left, top, right, bottom } = PaperUtil.computeBounds(...items);
    this.left = left;
    this.midX = left + (right - left) / 2;
    this.right = right;
    this.top = top;
    this.midY = top + (bottom - top) / 2;
    this.bottom = bottom;
  }

  /** Snaps this snap item to a fixed target snap item. */
  snap(targetItem: SnapItem) {
    return {
      horizontal: runHorizontalSnapTest(this, targetItem),
      vertical: runVerticalSnapTest(this, targetItem),
    };
  }
}

interface SnapPair<T> {
  readonly drag: T;
  readonly target: T;
}

interface Delta {
  readonly delta: number;
}

interface Sibling {
  readonly sibling: paper.Item;
}

interface SnapTestResult<T> {
  readonly values: ReadonlyArray<SnapPair<T>>;
}

type SnapTestResults<T> = ReadonlyArray<Sibling & SnapTestResult<T>>;

interface SnapInfo {
  readonly horizontal: {
    readonly values: SnapTestResults<'left' | 'midX' | 'right'>;
  } & Delta;
  readonly vertical: {
    readonly values: SnapTestResults<'top' | 'midY' | 'bottom'>;
  } & Delta;
}

function runHorizontalSnapTest(
  dragItem: SnapItem,
  targetItem: SnapItem,
): SnapTestResult<'left' | 'midX' | 'right'> & Delta {
  const guides: ['left', 'midX', 'right'] = ['left', 'midX', 'right'];
  return filterByMinDelta(
    _.flatMap(guides, drag =>
      guides.map(target => {
        const delta = MathUtil.round(dragItem[drag] - targetItem[target]);
        return { drag, target, delta };
      }),
    ),
  );
}

function runVerticalSnapTest(
  dragItem: SnapItem,
  targetItem: SnapItem,
): SnapTestResult<'top' | 'midY' | 'bottom'> & Delta {
  const guides: ['top', 'midY', 'bottom'] = ['top', 'midY', 'bottom'];
  return filterByMinDelta(
    _.flatMap(guides, drag =>
      guides.map(target => {
        const delta = MathUtil.round(dragItem[drag] - targetItem[target]);
        return { drag, target, delta };
      }),
    ),
  );
}

/**
 * Filters the array of items, keeping the absolute mininum delta values and
 * discarding the rest.
 */
function filterByMinDelta<T>(
  values: (T & Delta)[],
): {
  delta: number;
  values: T[];
} {
  if (!values.length) {
    return undefined;
  }
  const toInfoFn = (t: T & { readonly delta: number }) => {
    return {
      min: Math.abs(t.delta),
      pos: t.delta >= 0 ? [t] : [] as T[],
      neg: t.delta >= 0 ? [] : [t] as T[],
    };
  };
  const { min, pos, neg } = values.reduce((prev, curr) => {
    const info = toInfoFn(curr);
    if (prev.min === info.min) {
      return {
        min: prev.min,
        pos: [...prev.pos, ...info.pos],
        neg: [...prev.neg, ...info.neg],
      };
    }
    return prev.min < info.min ? prev : info;
  }, toInfoFn(values[0]));
  return {
    delta: min,
    values: pos.length >= neg.length ? pos : neg,
  };
}
