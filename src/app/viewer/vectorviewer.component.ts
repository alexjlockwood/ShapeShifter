import {
  Component, ChangeDetectionStrategy, OnInit, ViewChildren, QueryList, OnDestroy
} from '@angular/core';
import { CanvasType } from '../CanvasType';
import { StateService, } from '../services';
import { Observable } from 'rxjs/Observable';
import { MdMenuTrigger } from '@angular/material';
import { Subscription } from 'rxjs/Subscription';
import { VectorLayer } from '../scripts/layers';

declare const ga: Function;

@Component({
  selector: 'app-vectorviewer',
  templateUrl: './vectorviewer.component.html',
  styleUrls: ['./vectorviewer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VectorViewerComponent implements OnInit, OnDestroy {
  @ViewChildren(MdMenuTrigger) menuTriggers: QueryList<MdMenuTrigger>;

  // These are public because they are accessed via the HTML template.
  existingPathIdsObservable: Observable<ReadonlyArray<string>>;
  startActivePathIdObservable: Observable<string>;
  endActivePathIdObservable: Observable<string>;
  vectorLayersObservable: Observable<ReadonlyArray<VectorLayer>>;

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
    this.vectorLayersObservable = this.stateService.getVectorLayersObservable();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  // TODO: remember state of previously modified paths
  onSetStartPathIdClick(pathId: string) {
    this.stateService.setActivePathId(CanvasType.Start, pathId);
  }

  // TODO: remember state of previously modified paths
  onSetEndPathIdClick(pathId: string) {
    this.stateService.setActivePathId(CanvasType.End, pathId);
  }

  onDeletePathClick(pathId: string) {
    // TODO: show a dialog to confirm?
    this.stateService.deletePathId(pathId);
  }

  onListItemClick(event: MouseEvent, position: number) {
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
