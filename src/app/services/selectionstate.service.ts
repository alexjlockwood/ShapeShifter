import * as _ from 'lodash';
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { VectorLayer } from '../scripts/layers';
import { Observable } from 'rxjs/Observable';
import { Id as CommandId } from '../scripts/commands';
import { EditorType } from '../EditorType';

/**
 * A simple service that broadcasts selection events to all parts of the application.
 */
@Injectable()
export class SelectionStateService {
  private readonly source = new BehaviorSubject<Selection[]>([]);
  readonly stream = this.source.asObservable();
  private readonly selections: Selection[] = [];

  getSelections() {
    return this.selections;
  }

  /**
   * Toggles the specified selection. If the selection exists, it will be
   * removed from the list. Otherwise, it will be added to the list of selections.
   * By default, all other selections from the list will be cleared.
   */
  toggle(selection: Selection, appendToList = false) {
    _.remove(this.selections, sel => sel.source !== selection.source);
    if (!_.remove(this.selections, selection).length) {
      this.selections.push(selection);
    }
    if (!appendToList) {
      _.remove(this.selections, sel => !_.isEqual(selection, sel));
    }
    this.source.next(this.selections);
  }
}

/**
 * A selection represents an action that is the result of a mouse click.
 */
export interface Selection {
  readonly commandId?: CommandId;
  readonly source?: EditorType;
}
