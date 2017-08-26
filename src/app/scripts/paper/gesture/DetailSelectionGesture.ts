import { MathUtil } from 'app/scripts/common';
import { Guides, Items, Selections } from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Gesture } from '.';

/**
 * A gesture that performs selection operations on path segments and handles.
 */
export class DetailSelectionGesture extends Gesture {
  private readonly initialSegmentPoints = new Map<paper.Segment, paper.Point>();
  private hitType: paper.HitType;
  private hitItem: paper.Item;

  constructor(private readonly detailSelectionItem: paper.Path) {
    super();
    detailSelectionItem.segments.forEach(s => this.initialSegmentPoints.set(s, s.point));
  }

  // @Override
  onMouseDown(event: paper.ToolEvent, hitResult: paper.HitResult) {
    this.hitType = hitResult.type;

    switch (this.hitType) {
      case 'segment':
        if (hitResult.segment.selected) {
          // Selected points with no handles get handles if selected again.
          hitResult.segment.selected = true;
          if (event.modifiers.shift) {
            hitResult.segment.selected = false;
          }
        } else {
          if (event.modifiers.shift) {
            hitResult.segment.selected = true;
          } else {
            Selections.deselectAll();
            hitResult.segment.selected = true;
          }
        }
        break;
      case 'stroke':
      case 'curve':
        const { curve } = hitResult.location;
        if (event.modifiers.shift) {
          curve.selected = !curve.selected;
        } else if (!curve.selected) {
          Selections.deselectAll();
          curve.selected = true;
        }
        break;
      case 'handle-in':
      case 'handle-out':
        if (!event.modifiers.shift) {
          Selections.deselectAll();
        }
        hitResult.segment.handleIn.selected = true;
        hitResult.segment.handleOut.selected = true;
        break;
    }
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const { point, downPoint, delta, modifiers } = event;
    const dragVector = point.subtract(downPoint);
    for (const seg of this.detailSelectionItem.segments) {
      switch (this.hitType) {
        case 'segment':
        case 'stroke':
        case 'curve':
          if (!seg.selected) {
            break;
          }
          if (modifiers.shift) {
            const initialPoint = this.initialSegmentPoints.get(seg);
            seg.point = initialPoint.add(
              new paper.Point(MathUtil.snapDeltaToAngle(dragVector, 15)),
            );
          } else {
            seg.point = seg.point.add(event.delta);
          }
          break;
        case 'handle-in':
          if (!seg.handleIn.selected) {
            break;
          }
          // TODO: make it possible to hold shift to make colinear again?
          if (modifiers.option || !seg.handleOut.isColinear(seg.handleIn)) {
            // If option is pressed or handles have been split,
            // they're no longer parallel and move independently.
            seg.handleIn = seg.handleIn.add(delta);
          } else {
            seg.handleIn = seg.handleIn.add(delta);
            seg.handleOut = seg.handleOut.subtract(delta);
          }
          break;
        case 'handle-out':
          if (!seg.handleOut.selected) {
            break;
          }
          // TODO: make it possible to hold shift to make colinear again?
          if (modifiers.option || !seg.handleOut.isColinear(seg.handleIn)) {
            // If option is pressed or handles have been split,
            // they're no longer parallel and move independently.
            seg.handleOut = seg.handleOut.add(delta);
          } else {
            seg.handleIn = seg.handleIn.subtract(delta);
            seg.handleOut = seg.handleOut.add(delta);
          }
          break;
      }
    }
  }
}
