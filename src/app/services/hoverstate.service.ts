import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { VectorLayer } from '../scripts/model';
import { Observable } from 'rxjs/Observable';
import { EditorType, Id as CommandId } from '../scripts/model';

@Injectable()
export class HoverStateService {
  readonly source = new Subject<Hover>();
  readonly stream = this.source.asObservable();
  private currentHover: Hover = { type: HoverType.None, visibleTo: [] };

  constructor() { }

  getHover() {
    return this.currentHover;
  }

  setHover(hover: Hover) {
    this.currentHover = hover;
    this.notifyChange();
  }

  clearHover() {
    if (this.currentHover) {
      this.setHover({
        type: HoverType.None,
        source: this.currentHover.source,
        visibleTo: this.currentHover.visibleTo,
      });
    }
  }

  notifyChange() {
    this.source.next(this.currentHover);
  }

  addListener(type: EditorType, callback: (hover: Hover) => void) {
    return this.stream.subscribe(callback);
  }
}

/**
 * A hover represents a transient action that results as a result of a mouse hover.
 */
export interface Hover {
  readonly type: HoverType;
  readonly commandId?: CommandId;
  readonly source?: EditorType;
  readonly visibleTo: Array<EditorType>;
}

/**
 * Describes the different types of hover events.
 */
export enum HoverType {
  // There is no current hover event.
  None,
  // The user hovered over a draw command in the inspector/canvas.
  Command,
  // The user hovered over the split button in the command inspector.
  Split,
  // The user hovered over the unsplit button in the command inspector.
  Unsplit,
}
