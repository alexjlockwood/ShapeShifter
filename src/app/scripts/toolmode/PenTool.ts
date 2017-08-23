import * as paper from 'paper';

import { AbstractTool, HitTestArgs, ToolState } from './AbstractTool';
import { ToolMode } from './ToolMode';
import { ToolWrapper } from './ToolWrapper';
import * as ToolUtil from './util/ToolUtil';

enum Mode {
  None,
  Add,
  Continue,
  Remove,
  Close,
}

/**
 * Pen tool that allows for creating new shapes and lines.
 */
export class PenTool extends ToolWrapper {
  private pathId = -1;
  private mode = Mode.None;
  private hitResult: paper.HitResult;
  private currSegment: paper.Segment;

  constructor() {
    super();

    let path: paper.Path;
    let currentSegment: paper.Segment;
    let mode = Mode.None;
    let type: string;
    let hoverHitResult: paper.HitResult;

    const hitOptions = {
      segments: true,
      stroke: true,
      curves: true,
      // TODO: figure out which one to use ('guide' or 'guides')
      guide: false,
      guides: false,
      tolerance: 5 / paper.view.zoom,
    } as any; // TODO: missing types

    this.tool.on({
      mousedown: (event: paper.ToolEvent) => {
        if (currentSegment) {
          currentSegment.selected = false;
        }
        mode = type = currentSegment = undefined;

        if (!path) {
          if (!hoverHitResult) {
            ToolUtil.clearSelection();
            path = new paper.Path();
            path.fillColor = 'blue';
            path.strokeColor = 'black';
            path.strokeWidth = 10;
            // path = pg.stylebar.applyActiveToolbarStyle(path);
          } else {
            const item = hoverHitResult.item as paper.Path;
            if (item.closed) {
              path = item;
            } else {
              mode = Mode.Continue;
              path = item;
              currentSegment = hoverHitResult.segment;
              if (item.lastSegment !== hoverHitResult.segment) {
                path.reverse();
              }
            }
          }
        }

        if (path) {
          const result = findHandle(path, event.point);
          if (result && mode !== Mode.Continue) {
            currentSegment = result.segment;
            type = result.type;
            if (result.type === 'segment') {
              if (result.segment.index === 0 && path.segments.length > 1 && !path.closed) {
                mode = Mode.Close;
                path.closed = true;
                path.firstSegment.selected = true;
              } else {
                mode = Mode.Remove;
                result.segment.remove();
              }
            }
          }

          if (currentSegment) {
            return;
          }

          if (!hoverHitResult) {
            mode = Mode.Add;
            // Add a new segment to the path.
            currentSegment = path.add(event.point);
            currentSegment.selected = true;
            return;
          }

          const item = hoverHitResult.item as paper.Path;
          if (hoverHitResult.type === 'segment' && !item.closed) {
            // Joining two paths.
            const hoverPath = item;
            // Check if the connection point is the first segment
            // reverse path if it is not because join()
            // always connects to first segment).
            if (hoverPath.firstSegment !== hoverHitResult.segment) {
              hoverPath.reverse();
            }
            path.join(hoverPath);
            path = undefined;
          } else if (hoverHitResult.type === 'curve' || hoverHitResult.type === 'stroke') {
            mode = Mode.Add;
            // Inserting segment on curve/stroke.
            const location = hoverHitResult.location;
            currentSegment = path.insert(location.index + 1, event.point);
            currentSegment.selected = true;
          }
        }
      },
      mousedrag: (event: paper.ToolEvent) => {
        let delta = event.delta;
        if (type === 'handle-out' || mode === Mode.Add) {
          delta = delta.multiply(-1);
        }
        currentSegment.handleIn = currentSegment.handleIn.add(delta);
        currentSegment.handleOut = currentSegment.handleOut.subtract(delta);
      },
      mousemove: (event: paper.ToolEvent) => {
        const hitResult = paper.project.hitTest(event.point, hitOptions);
        if (hitResult && hitResult.item && hitResult.item.selected) {
          hoverHitResult = hitResult;
        } else {
          hoverHitResult = undefined;
        }
      },
      mouseup: (event: paper.ToolEvent) => {
        if (path && path.closed) {
          // pg.undo.snapshot('bezier');
          path = undefined;
        }
      },
    });
  }
}

function findHandle(path: paper.Path, point: paper.Point) {
  const types = ['segment', 'handle-in', 'handle-out'];
  for (let i = 0, l = path.segments.length; i < l; i++) {
    for (let j = 0; j < 3; j++) {
      const type = types[j];
      const segment = path.segments[i];
      const segmentPoint = type === 'segment' ? segment.point : segment.point + segment[type];
      const distance = point.subtract(segmentPoint).length;
      if (distance < 6) {
        return { type, segment };
      }
    }
  }
  return undefined;
}
