import { CanvasType } from '../CanvasType';
import { SetShapeShifterHover, State, Store } from '../store';
import { Hover, HoverType } from '../store/shapeshifter';
import { getShapeShifterHover } from '../store/shapeshifter/selectors';
import { Injectable } from '@angular/core';
import * as _ from 'lodash';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

/**
 * A simple service that broadcasts hover events to all parts of the application.
 */
@Injectable()
export class HoverService {
  private hover: Hover;

  constructor(private readonly store: Store<State>) {
    this.store.select(getShapeShifterHover).subscribe(h => this.hover = h);
  }

  /** @deprecated */
  getHover() {
    return this.hover;
  }

  setHover(hover: Hover) {
    if (!_.isEqual(this.hover, hover)) {
      this.store.dispatch(new SetShapeShifterHover(hover));
    }
  }

  setPoint(source: CanvasType, subIdx: number, cmdIdx: number) {
    this.setHover({ type: HoverType.Point, source, subIdx, cmdIdx });
  }

  setSegment(source: CanvasType, subIdx: number, cmdIdx: number) {
    this.setHover({ type: HoverType.Segment, source, subIdx, cmdIdx });
  }

  setSubPath(source: CanvasType, subIdx: number) {
    this.setHover({ type: HoverType.SubPath, source, subIdx });
  }

  /** @deprecated */
  resetAndNotify() {
    this.setHover(undefined);
  }
}
