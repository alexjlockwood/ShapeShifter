import * as paper from 'paper';

import { AbstractTool } from './AbstractTool';
import { Selections } from './util';

enum Mode {
  None,
  Add,
  Continue,
  Remove,
  Close,
}

/**
 * Pen tool that allows for creating new shapes and lines.
 * TODO: figure out how to deal with right mouse clicks and double clicks
 */
export class PenTool extends AbstractTool {
  private currPath: paper.Path;
  private currSegment: paper.Segment;
  private mode = Mode.None;
  private type: string;
  private hoverHitResult: paper.HitResult;

  // @Override
  protected onMouseDown(event: paper.ToolEvent) {
    if (this.currSegment) {
      this.currSegment.selected = false;
    }
    this.mode = this.type = this.currSegment = undefined;

    if (!this.currPath) {
      if (!this.hoverHitResult) {
        Selections.deselectAll();
        this.currPath = new paper.Path();
        this.currPath.fillColor = 'blue';
        this.currPath.strokeColor = 'black';
        this.currPath.strokeWidth = 10;
        // path = pg.stylebar.applyActiveToolbarStyle(path);
      } else {
        const item = this.hoverHitResult.item as paper.Path;
        if (item.closed) {
          this.currPath = item;
        } else {
          this.mode = Mode.Continue;
          this.currPath = item;
          this.currSegment = this.hoverHitResult.segment;
          if (item.lastSegment !== this.hoverHitResult.segment) {
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

      if (!this.hoverHitResult) {
        this.mode = Mode.Add;
        // Add a new segment to the path.
        this.currSegment = this.currPath.add(event.point);
        this.currSegment.selected = true;
        return;
      }

      const item = this.hoverHitResult.item as paper.Path;
      if (this.hoverHitResult.type === 'segment' && !item.closed) {
        // Joining two paths.
        const hoverPath = item;
        // Check if the connection point is the first segment
        // reverse path if it is not because join()
        // always connects to first segment).
        if (hoverPath.firstSegment !== this.hoverHitResult.segment) {
          hoverPath.reverse();
        }
        this.currPath.join(hoverPath);
        this.currPath = undefined;
      } else if (this.hoverHitResult.type === 'curve' || this.hoverHitResult.type === 'stroke') {
        this.mode = Mode.Add;
        // Inserting segment on curve/stroke.
        const { location } = this.hoverHitResult;
        this.currSegment = this.currPath.insert(location.index + 1, event.point);
        this.currSegment.selected = true;
      }
    }
  }

  // @Override
  protected onMouseDrag(event: paper.ToolEvent) {
    let delta = event.delta;
    if (this.type === 'handle-out' || this.mode === Mode.Add) {
      delta = delta.multiply(-1);
    }
    this.currSegment.handleIn = this.currSegment.handleIn.add(delta);
    this.currSegment.handleOut = this.currSegment.handleOut.subtract(delta);
  }

  // @Override
  protected onMouseMove(event: paper.ToolEvent) {
    const hitResult = paper.project.hitTest(event.point, createHitOptions());
    if (hitResult && hitResult.item && hitResult.item.selected) {
      this.hoverHitResult = hitResult;
    } else {
      this.hoverHitResult = undefined;
    }
  }

  // @Override
  protected onMouseUp(event: paper.ToolEvent) {
    if (this.currPath && this.currPath.closed) {
      this.currPath = undefined;
    }
  }

  // @Override
  protected onKeyDown(event: paper.KeyEvent) {}

  // @Override
  protected onKeyUp(event: paper.KeyEvent) {}
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
        return { type, segment };
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
