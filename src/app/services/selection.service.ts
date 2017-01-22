import * as _ from 'lodash';
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { VectorLayer } from '../scripts/model';
import { Observable } from 'rxjs/Observable';
import { EditorType } from '../scripts/model';
import { BaseService } from './base.service';

@Injectable()
export class SelectionService extends BaseService<Array<Selection>> {

  constructor() {
    super([]);
  }

  toggleSelection(type: EditorType, selection: Selection) {
    const selections = this.getData(type);
    const isSelected = _.some(selections, selection);
    this.setData(type, isSelected ? [] : [selection]);
    this.notifyChange(type);
  }

  reverse(type: EditorType, subPathIdx: number, numCommands: number) {
    this.setData(type, this.getData(type).map(sel => {
      if (sel.subPathIdx !== subPathIdx) {
        return sel;
      }
      // TODO: this doesn't quite work yet... but close enough for now.
      // ideally the selected path should stay the same. try it on a plus SVG to reproduce.
      return _.assign({}, sel, { drawIdx: numCommands - sel.drawIdx - 1 });
    }));
    this.notifyChange(type);
  }
}

// TODO: figure out how to keep these in sync with reversals/shifts/splits/unsplits.
export interface Selection {
  pathId: string;
  subPathIdx: number;
  drawIdx: number;
}
