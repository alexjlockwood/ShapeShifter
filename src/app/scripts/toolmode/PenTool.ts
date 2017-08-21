import * as paper from 'paper';

import { AbstractTool, HitTestArgs, ToolState } from './AbstractTool';
import { ToolMode } from './ToolMode';
import * as ToolsUtil from './ToolsUtil';
import { SelectionState } from './ToolsUtil';

enum Mode {
  None,
  Create,
  Insert,
  Adjust,
  Continue,
  Convert,
  Remove,
  Join,
  Close,
}

/**
 * Pen tool that allows for creating new shapes and lines.
 */
export class PenTool extends AbstractTool {
  private pathId = -1;
  private mode = Mode.None;
  private hitResult: paper.HitResult;
  private currentSegment: paper.Segment;

  constructor(toolState: ToolState) {
    super();

    let initialMousePoint: paper.Point;
    let originalHandleIn: paper.Point;
    let originalHandleOut: paper.Point;

    this.on({
      activate: () => ToolsUtil.setCanvasCursor('cursor-pen-add'),
      deactivate: () => {
        if (toolState.getToolMode() !== ToolMode.Pen) {
          this.closePath();
          toolState.updateSelectionBounds();
        }
        this.currentSegment = undefined;
      },
      mousedown: (event: paper.MouseEvent) => {
        ToolsUtil.deselectAllSegments();

        switch (this.mode) {
          case Mode.Create: {
            // TODO: missing types
            let path = ToolsUtil.findItemById(this.pathId) as paper.Path;
            if (!path) {
              ToolsUtil.deselectAll();
              path = new paper.Path();
              path.strokeColor = 'black';
              this.pathId = path.id;
            }
            this.currentSegment = path.add(event.point);
            initialMousePoint = event.point.clone();
            originalHandleIn = this.currentSegment.handleIn.clone();
            originalHandleOut = this.currentSegment.handleOut.clone();
            break;
          }
          case Mode.Insert: {
            if (this.hitResult) {
              const location = this.hitResult.location;
              const values = (location.curve as any).getValues();
              const isLinear = location.curve.isLinear();
              const parts = (paper.Curve as any).subdivide(values, location.parameter);
              const left = parts[0];
              const right = parts[1];
              const x = left[6];
              const y = left[7];
              const segment = new paper.Segment(
                new paper.Point(x, y),
                !isLinear && new paper.Point(left[4] - x, left[5] - y),
                !isLinear && new paper.Point(right[2] - x, right[3] - y),
              );
              // TODO: this can sometimes cause exceptions... investigate
              if (!this.hitResult.item || !(this.hitResult.item as paper.Path).insert) {
                console.warn(this.hitResult);
              }
              // TODO: missing types
              const seg = (this.hitResult.item as paper.Path).insert(location.index + 1, segment);
              if (!isLinear) {
                seg.previous.handleOut.x = left[2] - left[0];
                seg.previous.handleOut.y = left[3] - left[1];
                seg.next.handleIn.x = right[4] - right[6];
                seg.next.handleIn.y = right[5] - right[7];
              }
              ToolsUtil.deselectAllSegments();
              seg.selected = true;
              this.hitResult = undefined;
            }
            break;
          }
          case Mode.Close: {
            if (this.pathId !== -1) {
              // TODO: missing types
              (ToolsUtil.findItemById(this.pathId) as paper.Path).closed = true;
            }
            this.currentSegment = this.hitResult.segment;
            this.currentSegment.handleIn.set(0, 0);
            initialMousePoint = event.point.clone();
            originalHandleIn = this.currentSegment.handleIn.clone();
            originalHandleOut = this.currentSegment.handleOut.clone();
            break;
          }
          case Mode.Adjust: {
            this.currentSegment = this.hitResult.segment;
            this.currentSegment.handleOut.set(0, 0);
            initialMousePoint = event.point.clone();
            originalHandleIn = this.currentSegment.handleIn.clone();
            originalHandleOut = this.currentSegment.handleOut.clone();
            break;
          }
          case Mode.Continue: {
            if (this.hitResult.segment.index === 0) {
              this.hitResult.item.reverseChildren();
            }
            this.pathId = this.hitResult.item.id;
            this.currentSegment = this.hitResult.segment;
            this.currentSegment.handleOut.set(0, 0);
            initialMousePoint = event.point.clone();
            originalHandleIn = this.currentSegment.handleIn.clone();
            originalHandleOut = this.currentSegment.handleOut.clone();
            break;
          }
          case Mode.Convert: {
            this.pathId = this.hitResult.item.id;
            this.currentSegment = this.hitResult.segment;
            this.currentSegment.handleIn.set(0, 0);
            this.currentSegment.handleOut.set(0, 0);
            initialMousePoint = event.point.clone();
            originalHandleIn = this.currentSegment.handleIn.clone();
            originalHandleOut = this.currentSegment.handleOut.clone();
            break;
          }
          case Mode.Join: {
            const path = ToolsUtil.findItemById(this.pathId) as paper.Path;
            if (path) {
              const oldPoint = this.hitResult.segment.point.clone();
              if (this.hitResult.segment.index !== 0) {
                // TODO: missing types
                (this.hitResult.item as paper.Path).reverse();
              }
              // TODO: missing types
              path.join(this.hitResult.item as paper.Path);
              // Find nearest point to the hit point.
              let imin = -1;
              let dmin = 0;
              for (let i = 0; i < path.segments.length; i++) {
                const d = oldPoint.getDistance(path.segments[i].point);
                if (imin === -1 || d < dmin) {
                  dmin = d;
                  imin = i;
                }
              }
              this.currentSegment = path.segments[imin];
              this.currentSegment.handleIn.set(0, 0);
              initialMousePoint = event.point.clone();
              originalHandleIn = this.currentSegment.handleIn.clone();
              originalHandleOut = this.currentSegment.handleOut.clone();
            } else {
              this.currentSegment = undefined;
            }
            break;
          }
          case Mode.Remove: {
            if (this.hitResult) {
              // TODO: missing types
              (this.hitResult.item as paper.Path).removeSegment(this.hitResult.segment.index);
              this.hitResult = undefined;
            }
            break;
          }
        }
        if (this.currentSegment) {
          this.currentSegment.selected = true;
        }
      },
      mousedrag: (event: paper.MouseEvent) => {
        if (!this.currentSegment) {
          return;
        }
        const path = ToolsUtil.findItemById(this.pathId);
        if (!path) {
          return;
        }
        let dragIn = false;
        let dragOut = false;
        let invert = false;
        switch (this.mode) {
          case Mode.Create:
            dragOut = true;
            if (this.currentSegment.index > 0) {
              dragIn = true;
            }
            break;
          case Mode.Close:
            dragIn = invert = true;
            break;
          case Mode.Continue:
            dragOut = true;
            break;
          case Mode.Adjust:
            dragOut = true;
            break;
          case Mode.Join:
            dragIn = invert = true;
            break;
          case Mode.Convert:
            dragIn = dragOut = true;
            break;
        }
        if (dragIn || dragOut) {
          let delta = event.point.subtract(initialMousePoint);
          if (invert) {
            delta = new paper.Point(-delta.x, -delta.y);
          }
          if (dragIn && dragOut) {
            let handlePos = originalHandleOut.add(delta);
            if (event.modifiers.shift) {
              handlePos = ToolsUtil.snapDeltaToAngle(handlePos, Math.PI * 2 / 8);
            }
            this.currentSegment.handleOut = handlePos;
            this.currentSegment.handleIn = new paper.Point(-handlePos.x, -handlePos.y);
          } else if (dragOut) {
            let handlePos = originalHandleOut.add(delta);
            if (event.modifiers.shift) {
              handlePos = ToolsUtil.snapDeltaToAngle(handlePos, Math.PI * 2 / 8);
            }
            this.currentSegment.handleOut = handlePos;
            this.currentSegment.handleIn = handlePos.normalize(-originalHandleIn.length);
          } else {
            let handlePos = originalHandleIn.add(delta);
            if (event.modifiers.shift) {
              handlePos = ToolsUtil.snapDeltaToAngle(handlePos, Math.PI * 2 / 8);
            }
            this.currentSegment.handleIn = handlePos;
            this.currentSegment.handleOut = handlePos.normalize(-originalHandleOut.length);
          }
        }
      },
      mousemove: (event: paper.MouseEvent) => this.hitTest(event),
      mouseup: (event: paper.MouseEvent) => {
        if (this.mode === Mode.Close || this.mode === Mode.Join || this.mode === Mode.Convert) {
          this.closePath();
        }
        this.mode = undefined;
        this.currentSegment = undefined;
      },
    });
  }

  // @Override
  dispatchHitTest(
    type: string,
    { point, modifiers = {}, key = '' }: HitTestArgs,
    toolMode: ToolMode,
  ) {
    if (toolMode !== ToolMode.Pen) {
      return false;
    }
    if (modifiers.command) {
      return false;
    }
    if (type === 'keyup' && (key === 'enter' || key === 'escape')) {
      this.closePath();
    }
    return this.hitTest({ point, modifiers });
  }

  // @Override
  protected hitTest({ point, modifiers = {} }: HitTestArgs) {
    const hitSize = 4;
    let result = undefined;
    this.currentSegment = undefined;
    this.hitResult = undefined;
    if (point) {
      result = paper.project.hitTest(point, {
        segments: true,
        stroke: true,
        tolerance: hitSize,
      });
    }
    if (result) {
      if (result.type === 'stroke') {
        if (result.item.selected) {
          this.mode = Mode.Insert;
          ToolsUtil.setCanvasCursor('cursor-pen-add');
        } else {
          result = undefined;
        }
      } else if (result.type === 'segment') {
        const last = result.item.segments.length - 1;
        if (!result.item.closed && (result.segment.index === 0 || result.segment.index === last)) {
          if (result.item.id === this.pathId) {
            if (result.segment.index === 0) {
              this.mode = Mode.Close;
              ToolsUtil.setCanvasCursor('cursor-pen-close');
              this.updateTail(result.segment.point);
            } else {
              this.mode = Mode.Adjust;
              ToolsUtil.setCanvasCursor('cursor-pen-adjust');
            }
          } else {
            if (this.pathId !== -1) {
              this.mode = Mode.Join;
              ToolsUtil.setCanvasCursor('cursor-pen-join');
              this.updateTail(result.segment.point);
            } else {
              this.mode = Mode.Continue;
              ToolsUtil.setCanvasCursor('cursor-pen-edit');
            }
          }
        } else if (result.item.selected) {
          if (modifiers.option) {
            this.mode = Mode.Convert;
            ToolsUtil.setCanvasCursor('cursor-pen-adjust');
          } else {
            this.mode = Mode.Remove;
            ToolsUtil.setCanvasCursor('cursor-pen-remove');
          }
        } else {
          result = undefined;
        }
      }
    }
    if (!result) {
      this.mode = Mode.Create;
      ToolsUtil.setCanvasCursor('cursor-pen-create');
      if (point) {
        this.updateTail(point);
      }
    }
    this.hitResult = result;
    return true;
  }

  private closePath() {
    if (this.pathId !== -1) {
      ToolsUtil.deselectAllSegments();
      this.pathId = -1;
    }
  }

  private updateTail(point: paper.Point) {
    const path = ToolsUtil.findItemById(this.pathId) as paper.Path;
    if (!path) {
      return;
    }
    const numSegs = path.segments.length;
    if (numSegs === 0) {
      return;
    }
    const color = (paper.project.activeLayer as any).getSelectedColor();
    const tail = new paper.Path();
    tail.strokeColor = color ? color : '#009dec';
    tail.strokeWidth = 1 / paper.view.zoom;
    // TODO: missing types
    (tail as any).guide = true;
    const prevPoint = path.segments[numSegs - 1].point;
    const prevHandleOut = path.segments[numSegs - 1].point.add(
      path.segments[numSegs - 1].handleOut,
    );
    tail.moveTo(prevPoint);
    tail.cubicCurveTo(prevHandleOut, point, point);
    tail.removeOn({
      drag: true,
      up: true,
      down: true,
      move: true,
    });
  }
}
