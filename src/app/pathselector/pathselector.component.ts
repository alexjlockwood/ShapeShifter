import {
  Component, ChangeDetectionStrategy, OnInit, ViewChildren, QueryList, OnDestroy
} from '@angular/core';
import { CanvasType } from '../CanvasType';
import { StateService, } from '../services';
import { Observable } from 'rxjs/Observable';
import { MdMenuTrigger } from '@angular/material';
import { Subscription } from 'rxjs/Subscription';

declare const ga: Function;

@Component({
  selector: 'app-pathselector',
  templateUrl: './pathselector.component.html',
  styleUrls: ['./pathselector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PathSelectorComponent implements OnInit, OnDestroy {
  @ViewChildren(MdMenuTrigger) menuTriggers: QueryList<MdMenuTrigger>;

  // These are public because they are accessed via the HTML template.
  existingPathIdsObservable: Observable<ReadonlyArray<string>>;
  startActivePathIdObservable: Observable<string>;
  endActivePathIdObservable: Observable<string>;

  private isHoveringOverListItem = new Map<string, boolean>();
  private isHoveringOverOverflow = new Map<string, boolean>();

  private readonly subscriptions: Subscription[] = [];

  constructor(private readonly stateService: StateService) { }

  ngOnInit() {
    this.startActivePathIdObservable = this.stateService.getActivePathIdObservable(CanvasType.Start);
    this.endActivePathIdObservable = this.stateService.getActivePathIdObservable(CanvasType.End);
    this.existingPathIdsObservable = this.stateService.getExistingPathIdsObservable();
    this.existingPathIdsObservable.subscribe(() => {
      this.isHoveringOverListItem.clear();
      this.isHoveringOverOverflow.clear();
    });
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  onSetStartPathIdClick(pathId: string) {
    this.stateService.setActivePathId(CanvasType.Start, pathId);
  }

  onSetEndPathIdClick(pathId: string) {
    this.stateService.setActivePathId(CanvasType.End, pathId);
  }

  onDeletePathClick(pathId: string) {
    // TODO: implement this
  }

  onListItemClick(position: number) {
    this.menuTriggers.toArray()[position].openMenu();
    event.cancelBubble = true;
  }

  onOverflowButtonClick(event: MouseEvent) {
    // This ensures that the parent div won't also receive the same click event.
    event.cancelBubble = true;
  }

  onListItemHoverEvent(pathId: string, isHovering: boolean) {
    this.isHoveringOverListItem.set(pathId, isHovering);
  }

  onOverflowHoverEvent(pathId: string, isHovering: boolean) {
    this.isHoveringOverOverflow.set(pathId, isHovering);
  }

  isHovering(pathId: string) {
    return this.isHoveringOverListItem.get(pathId) && !this.isHoveringOverOverflow.get(pathId);
  }
}
