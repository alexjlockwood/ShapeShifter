import { ToolMode } from 'app/model/paper';
import * as paper from 'paper';

import { BaseTool } from './BaseTool';
import { Selections } from './util';

enum Mode {
  None,
  Add,
  Close,
  // TODO: remove this
  Remove,
}

type Type = 'segment' | 'handle-in' | 'handle-out';

/**
 * Pen tool that allows for creating new shapes and lines.
 */
export class PenTool extends BaseTool {
  private currPath: paper.Path;
  private currSegment: paper.Segment;
  private mode = Mode.None;
  private type: Type;

  // @Override
  protected onInterceptEvent(toolMode: ToolMode, event?: paper.ToolEvent | paper.KeyEvent) {
    return toolMode === ToolMode.Pen;
  }

  // @Override
  protected onMouseEvent(event: paper.ToolEvent) {
    if (event.type === 'mousedown') {
      this.onMouseDown(event);
    } else if (event.type === 'mousedrag') {
      this.onMouseDrag(event);
    } else if (event.type === 'mousemove') {
      this.onMouseMove(event);
    } else if (event.type === 'mouseup') {
      this.onMouseUp(event);
    }
  }

  private onMouseDown(event: paper.ToolEvent) {
    const hitResult = paper.project.hitTest(event.point, {
      segments: true,
      stroke: true,
      curves: true,
      tolerance: 5 / paper.view.zoom,
    });
    const lastHitResult =
      hitResult && hitResult.item && hitResult.item.selected ? hitResult : undefined;

    if (this.currSegment) {
      this.currSegment.selected = false;
    }
    this.mode = Mode.None;
    this.type = undefined;
    this.currSegment = undefined;

    if (!this.currPath) {
      Selections.deselectAll();
      this.currPath = new paper.Path();
      this.currPath.fillColor = 'blue';
      this.currPath.strokeColor = 'black';
      this.currPath.strokeWidth = 10;
    }

    const result = findHandle(this.currPath, event.point);
    if (result) {
      this.currSegment = result.segment;
      this.type = result.type;
      if (result.type === 'segment') {
        if (
          result.segment.index === 0 &&
          this.currPath.segments.length > 1 &&
          !this.currPath.closed
        ) {
          this.mode = Mode.Close;
          this.currPath.closed = true;
          this.currPath.firstSegment.selected = true;
        } else {
          this.mode = Mode.Remove;
          result.segment.remove();
        }
      }
    }

    if (this.currSegment) {
      return;
    }

    if (!lastHitResult) {
      this.mode = Mode.Add;
      // Add a new segment to the path.
      this.currSegment = this.currPath.add(event.point);
      this.currSegment.selected = true;
      return;
    }

    const item = lastHitResult.item as paper.Path;
    if (lastHitResult.type === 'segment' && !item.closed) {
      // Joining two paths.
      const hoverPath = item;
      // Check if the connection point is the first segment
      // reverse path if it is not because join()
      // always connects to first segment).
      if (hoverPath.firstSegment !== lastHitResult.segment) {
        hoverPath.reverse();
      }
      this.currPath.join(hoverPath);
      this.currPath = undefined;
    } else if (lastHitResult.type === 'curve' || lastHitResult.type === 'stroke') {
      this.mode = Mode.Add;
      // Inserting segment on curve/stroke.
      const { location } = lastHitResult;
      this.currSegment = this.currPath.insert(location.index + 1, event.point);
      this.currSegment.selected = true;
    }
  }

  private onMouseDrag(event: paper.ToolEvent) {
    let delta = event.delta;
    if (this.type === 'handle-out' || this.mode === Mode.Add) {
      delta = delta.multiply(-1);
    }
    this.currSegment.handleIn = this.currSegment.handleIn.add(delta);
    this.currSegment.handleOut = this.currSegment.handleOut.subtract(delta);
  }

  private onMouseMove(event: paper.ToolEvent) {
    // TODO: draw a line indicating how the path will be extended
  }

  private onMouseUp(event: paper.ToolEvent) {
    if (this.currPath && this.currPath.closed) {
      // TODO: exit 'pen tool' mode and return to 'edit path mode' for the new path

      // If there is a current path and it is closed, then we are done.
      this.currPath = undefined;
    }
  }
}

function findHandle(path: paper.Path, point: paper.Point) {
  for (const segment of path.segments) {
    for (const type of ['segment', 'handle-in', 'handle-out']) {
      let segmentPoint = segment.point;
      if (type === 'handle-in') {
        segmentPoint = segmentPoint.add(segment.handleIn);
      } else if (type === 'handle-out') {
        segmentPoint = segmentPoint.add(segment.handleOut);
      }
      // TODO: the '6' seems arbitrary here... investigate?
      if (point.subtract(segmentPoint).length < 6) {
        return { type: type as Type, segment };
      }
    }
  }
  return undefined;
}
