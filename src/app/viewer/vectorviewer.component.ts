import {
  Component, ChangeDetectionStrategy, OnInit, OnDestroy
} from '@angular/core';
import { CanvasType } from '../CanvasType';
import { StateService, } from '../services';
import { Observable } from 'rxjs/Observable';
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


}
