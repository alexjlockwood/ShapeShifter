import { MathUtil } from 'app/scripts/common';
import { PaperLayer } from 'app/scripts/paper/item';
import { PaperUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as _ from 'lodash';
import * as paper from 'paper';

/**
 * A helper class that processes mouse events before they are dispatched and
 * determines if currently selected items should be snapped to other items
 * in the project as a result.
 */
export class MouseSnapper {
  private readonly paperLayer = paper.project.activeLayer as PaperLayer;

  constructor(private readonly ps: PaperService) {}

  // TODO: return immediately in onMouseEvent() if the command key is pressed?
  // TODO: listen for and react to command key down/up events
  // TODO: figure out how to snap cloned items that were created mid-drag
  // TODO: also add the entire artwork's bounds as a guide as well?
  getSnapInfo(event: paper.ToolEvent): SnapInfo {
    if (event.type !== 'mousedrag') {
      return undefined;
    }
    const dragItems = Array.from(this.ps.getSelectedLayers()).map(id =>
      this.paperLayer.findItemByLayerId(id),
    );
    if (!dragItems.length) {
      return undefined;
    }
    const { parent } = dragItems[0];
    if (!dragItems.every(item => item.parent === parent)) {
      // TODO: determine if there is an alternative to exiting early?
      console.warn('all snapped items must share the same parent item');
      return undefined;
    }
    const siblingItems = parent.children.filter(i => !dragItems.includes(i));
    if (!siblingItems.length) {
      return undefined;
    }
    const dragSnapBounds = new SnapBounds(PaperUtil.computeBounds(...dragItems));
    const siblingSnapResults = siblingItems.map(sibling => {
      // Snap the dragged item to each of its siblings.
      const siblingSnapBounds = new SnapBounds(PaperUtil.computeBounds(sibling));
      const { horizontal, vertical } = {
        horizontal: runHorizontalSnapTest(dragSnapBounds, siblingSnapBounds),
        vertical: runVerticalSnapTest(dragSnapBounds, siblingSnapBounds),
      };
      return {
        horizontal: { dragSnapBounds, siblingSnapBounds, ...horizontal },
        vertical: { dragSnapBounds, siblingSnapBounds, ...vertical },
      };
    });
    return {
      horizontal: filterByMinDelta(siblingSnapResults.map(({ horizontal }) => horizontal)),
      vertical: filterByMinDelta(siblingSnapResults.map(({ vertical }) => vertical)),
    };
  }
}

class SnapBounds {
  readonly left: number;
  readonly midX: number;
  readonly right: number;
  readonly top: number;
  readonly midY: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;

  constructor({ left, top, right, bottom }: paper.Rectangle) {
    this.left = left;
    this.right = right;
    this.top = top;
    this.bottom = bottom;
    this.width = right - left;
    this.height = bottom - top;
    this.midX = left + this.width * 0.5;
    this.midY = top + this.height * 0.5;
  }
}

interface SnapPair<G> {
  readonly drag: G;
  readonly sibling: G;
}

interface Delta {
  readonly delta: number;
}

interface SnapTestResult<G> {
  readonly values: ReadonlyArray<SnapPair<G>>;
}

type SnapTestResults<G> = ReadonlyArray<
  SnapTestResult<G> & {
    readonly dragSnapBounds: SnapBounds;
    readonly siblingSnapBounds: SnapBounds;
  }
>;

interface SnapInfo {
  readonly horizontal: {
    readonly values: SnapTestResults<'left' | 'midX' | 'right'>;
  } & Delta;
  readonly vertical: {
    readonly values: SnapTestResults<'top' | 'midY' | 'bottom'>;
  } & Delta;
}

function runHorizontalSnapTest(
  dragSnapBounds: SnapBounds,
  siblingSnapBounds: SnapBounds,
): SnapTestResult<'left' | 'midX' | 'right'> & Delta {
  const guides: ['left', 'midX', 'right'] = ['left', 'midX', 'right'];
  return filterByMinDelta(
    _.flatMap(guides, drag =>
      guides.map(sibling => {
        const delta = MathUtil.round(dragSnapBounds[drag] - siblingSnapBounds[sibling]);
        return { drag, sibling, delta };
      }),
    ),
  );
}

function runVerticalSnapTest(
  dragSnapBounds: SnapBounds,
  siblingSnapBounds: SnapBounds,
): SnapTestResult<'top' | 'midY' | 'bottom'> & Delta {
  const guides: ['top', 'midY', 'bottom'] = ['top', 'midY', 'bottom'];
  const flat = _.flatMap(guides, drag =>
    guides.map(sibling => {
      const delta = MathUtil.round(dragSnapBounds[drag] - siblingSnapBounds[sibling]);
      return { drag, sibling, delta };
    }),
  );
  const filtered = filterByMinDelta(flat);
  return filtered;
}

/**
 * Filters the array of items, keeping the absolute mininum delta values and
 * discarding the rest.
 */
function filterByMinDelta<T>(
  values: (T & Delta)[],
): {
  readonly values: ReadonlyArray<T>;
} & Delta {
  if (!values.length) {
    return undefined;
  }
  const { min, pos, neg } = values.reduce(
    (prev, curr) => {
      const info = {
        min: Math.abs(curr.delta),
        pos: curr.delta >= 0 ? [curr] : [] as T[],
        neg: curr.delta >= 0 ? [] : [curr] as T[],
      };
      if (prev.min === info.min) {
        return {
          min: prev.min,
          pos: [...prev.pos, ...info.pos],
          neg: [...prev.neg, ...info.neg],
        };
      }
      return prev.min < info.min ? prev : info;
    },
    { min: Infinity, pos: [], neg: [] },
  );
  return {
    delta: min,
    values: pos.length >= neg.length ? pos : neg,
  };
}
