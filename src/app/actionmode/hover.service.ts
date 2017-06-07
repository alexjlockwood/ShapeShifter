import {
  SetActionModeHover,
  State,
  Store,
} from '../store';
import {
  ActionSource,
  Hover,
  HoverType,
} from '../store/actionmode';
import { getActionModeHover } from '../store/actionmode/selectors';
import { Injectable } from '@angular/core';
import * as _ from 'lodash';

/**
 * A simple service that broadcasts hover events to all parts of the application.
 */
@Injectable()
export class HoverService {

  constructor(private readonly store: Store<State>) { }

  setPoint(source: ActionSource, subIdx: number, cmdIdx: number) {
    this.setHover({ type: HoverType.Point, source, subIdx, cmdIdx });
  }

  setSegment(source: ActionSource, subIdx: number, cmdIdx: number) {
    this.setHover({ type: HoverType.Segment, source, subIdx, cmdIdx });
  }

  setSubPath(source: ActionSource, subIdx: number) {
    this.setHover({ type: HoverType.SubPath, source, subIdx });
  }

  setHover(newHover: Hover) {
    this.store.select(getActionModeHover).first().subscribe(currHover => {
      if (!_.isEqual(newHover, currHover)) {
        this.store.dispatch(new SetActionModeHover(newHover));
      }
    });
  }
}
