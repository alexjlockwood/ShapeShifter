import {
  Component, Input, OnInit, ChangeDetectorRef,
  OnDestroy, NgZone, OnChanges
} from '@angular/core';
import { PathLayer, IPathCommand } from './../scripts/model';
import { StateService, VectorLayerType } from './../state.service';
import { Subscription } from 'rxjs/Subscription';

@Component({
  selector: 'app-inspector',
  template: `
  <app-path *ngFor="let pathCommand of pathCommands"
      fxLayout="column"
      [vectorLayerType]="vectorLayerType"
      [pathCommand]="pathCommand">
  </app-path>`,
  styleUrls: ['./inspector.component.scss']
})
export class InspectorComponent implements OnInit, OnChanges, OnDestroy {
  @Input() vectorLayerType: VectorLayerType;
  pathCommands: IPathCommand[] = [];
  private subscription: Subscription;

  // TODO: idea for saturday... pass path data and index to each component
  // so that inspector components only interact with path data directly.

  // Another idea: pass functions/observers up to the children components so that they
  // have no knowledge of how to manipulate the paths. then the root inspector can
  // receive the callbacks and recreate the path data each time and set it to the
  // appropriate path layer. the root inspector can also pass up ids for the children
  // to use to do efficient ngFor track by stuff.
  constructor(private stateService: StateService) { }

  ngOnInit() {
    this.subscription =
      this.stateService.addOnVectorLayerChangeListener(
        this.vectorLayerType, vl => {
          if (!vl) {
            return;
          }
          const pathCommands: IPathCommand[] = [];
          vl.walk(layer => {
            if (layer instanceof PathLayer) {
              // TODO(alockwood): fix these hacks!!!!!!!!!!!!
              layer.pathData = Object.create(layer.pathData);
              pathCommands.push(layer.pathData);
            }
          });
          this.pathCommands = pathCommands;
        });
  }

  ngOnChanges() {
    // console.log('onChanges');
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
