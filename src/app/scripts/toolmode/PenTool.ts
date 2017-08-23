import * as paper from 'paper';

import { ToolWrapper } from './ToolWrapper';
import * as PaperUtil from './util/PaperUtil';

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
  constructor() {
    super();

    let currPath: paper.Path;
    let currSegment: paper.Segment;
    let mode = Mode.None;
    let type: string;
    let hoverHitResult: paper.HitResult;

    const hitOptions: paper.HitOptions = {
      segments: true,
      stroke: true,
      curves: true,
      tolerance: 5 / paper.view.zoom,
    };

    this.tool.on({
      mousedown: (event: paper.ToolEvent) => {
        if (currSegment) {
          currSegment.selected = false;
        }
        mode = type = currSegment = undefined;

        if (!currPath) {
          if (!hoverHitResult) {
            PaperUtil.clearSelection();
            currPath = new paper.Path();
            currPath.fillColor = 'blue';
            currPath.strokeColor = 'black';
            currPath.strokeWidth = 10;
            // path = pg.stylebar.applyActiveToolbarStyle(path);
          } else {
            const item = hoverHitResult.item as paper.Path;
            if (item.closed) {
              currPath = item;
            } else {
              mode = Mode.Continue;
              currPath = item;
              currSegment = hoverHitResult.segment;
              if (item.lastSegment !== hoverHitResult.segment) {
                currPath.reverse();
              }
            }
          }
        }

        if (currPath) {
          const result = findHandle(currPath, event.point);
          if (result && mode !== Mode.Continue) {
            currSegment = result.segment;
            type = result.type;
            if (result.type === 'segment') {
              if (result.segment.index === 0 && currPath.segments.length > 1 && !currPath.closed) {
                mode = Mode.Close;
                currPath.closed = true;
                currPath.firstSegment.selected = true;
              } else {
                mode = Mode.Remove;
                result.segment.remove();
              }
            }
          }

          if (currSegment) {
            return;
          }

          if (!hoverHitResult) {
            mode = Mode.Add;
            // Add a new segment to the path.
            currSegment = currPath.add(event.point);
            currSegment.selected = true;
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
            currPath.join(hoverPath);
            currPath = undefined;
          } else if (hoverHitResult.type === 'curve' || hoverHitResult.type === 'stroke') {
            mode = Mode.Add;
            // Inserting segment on curve/stroke.
            const { location } = hoverHitResult;
            currSegment = currPath.insert(location.index + 1, event.point);
            currSegment.selected = true;
          }
        }
      },
      mousedrag: (event: paper.ToolEvent) => {
        let delta = event.delta;
        if (type === 'handle-out' || mode === Mode.Add) {
          delta = delta.multiply(-1);
        }
        currSegment.handleIn = currSegment.handleIn.add(delta);
        currSegment.handleOut = currSegment.handleOut.subtract(delta);
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
        if (currPath && currPath.closed) {
          currPath = undefined;
        }
      },
    });
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
        return { type, segment };
      }
    }
  }
  return undefined;
}
