import { ToolMode } from 'app/model/paper';
import * as paper from 'paper';

import { BaseTool } from './BaseTool';
import { Selections } from './util';

enum Mode {
  None,
  Add,
  Continue,
  Remove,
  Close,
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
  private mouseMoveHitResult: paper.HitResult;

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
    if (this.currSegment) {
      this.currSegment.selected = false;
    }
    this.mode = this.type = this.currSegment = undefined;

    if (!this.currPath) {
      if (!this.mouseMoveHitResult) {
        Selections.deselectAll();
        this.currPath = new paper.Path();
        this.currPath.fillColor = 'blue';
        this.currPath.strokeColor = 'black';
        this.currPath.strokeWidth = 10;
        // path = pg.stylebar.applyActiveToolbarStyle(path);
      } else {
        const item = this.mouseMoveHitResult.item as paper.Path;
        if (item.closed) {
          this.currPath = item;
        } else {
          this.mode = Mode.Continue;
          this.currPath = item;
          this.currSegment = this.mouseMoveHitResult.segment;
          if (item.lastSegment !== this.mouseMoveHitResult.segment) {
            this.currPath.reverse();
          }
        }
      }
    }

    if (this.currPath) {
      const result = findHandle(this.currPath, event.point);
      if (result && this.mode !== Mode.Continue) {
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

      if (!this.mouseMoveHitResult) {
        this.mode = Mode.Add;
        // Add a new segment to the path.
        this.currSegment = this.currPath.add(event.point);
        this.currSegment.selected = true;
        return;
      }

      const item = this.mouseMoveHitResult.item as paper.Path;
      if (this.mouseMoveHitResult.type === 'segment' && !item.closed) {
        // Joining two paths.
        const hoverPath = item;
        // Check if the connection point is the first segment
        // reverse path if it is not because join()
        // always connects to first segment).
        if (hoverPath.firstSegment !== this.mouseMoveHitResult.segment) {
          hoverPath.reverse();
        }
        this.currPath.join(hoverPath);
        this.currPath = undefined;
      } else if (
        this.mouseMoveHitResult.type === 'curve' ||
        this.mouseMoveHitResult.type === 'stroke'
      ) {
        this.mode = Mode.Add;
        // Inserting segment on curve/stroke.
        const { location } = this.mouseMoveHitResult;
        this.currSegment = this.currPath.insert(location.index + 1, event.point);
        this.currSegment.selected = true;
      }
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
    const hitResult = paper.project.hitTest(event.point, createHitOptions());
    if (hitResult && hitResult.item && hitResult.item.selected) {
      this.mouseMoveHitResult = hitResult;
    } else {
      this.mouseMoveHitResult = undefined;
    }
  }

  private onMouseUp(event: paper.ToolEvent) {
    if (this.currPath && this.currPath.closed) {
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

function createHitOptions(): paper.HitOptions {
  return {
    segments: true,
    stroke: true,
    curves: true,
    tolerance: 5 / paper.view.zoom,
  };
}
