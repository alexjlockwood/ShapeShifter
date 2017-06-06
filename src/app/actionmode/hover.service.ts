import { SetHover, State, Store } from '../store';
import { ActionSource, Hover, HoverType } from '../store/actionmode';
import { getActionHover } from '../store/actionmode/selectors';
import { Injectable } from '@angular/core';
import * as _ from 'lodash';

/**
 * A simple service that broadcasts hover events to all parts of the application.
 */
@Injectable()
export class HoverService {
  private hover: Hover;

  constructor(private readonly store: Store<State>) {
    this.store.select(getActionHover).subscribe(h => this.hover = h);
  }

  setHover(hover: Hover) {
    if (!_.isEqual(this.hover, hover)) {
      this.store.dispatch(new SetHover(hover));
    }
  }

  setPoint(source: ActionSource, subIdx: number, cmdIdx: number) {
    this.setHover({ type: HoverType.Point, source, subIdx, cmdIdx });
  }

  setSegment(source: ActionSource, subIdx: number, cmdIdx: number) {
    this.setHover({ type: HoverType.Segment, source, subIdx, cmdIdx });
  }

  setSubPath(source: ActionSource, subIdx: number) {
    this.setHover({ type: HoverType.SubPath, source, subIdx });
  }
}
