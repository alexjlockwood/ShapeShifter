import {
  Component, Input, OnInit, ChangeDetectorRef,
  OnDestroy, NgZone, OnChanges
   } from '@angular/core';
import { PathLayer, IPathCommand } from './../scripts/model';
import { StateService, VectorLayerType } from './../state.service';
import { Subscription } from 'rxjs/Subscription';

@Component({
  selector: 'app-inspector',
  templateUrl: './inspector.component.html',
  styleUrls: ['./inspector.component.scss']
})
export class InspectorComponent implements OnInit, OnChanges, OnDestroy {
  @Input() vectorLayerType: VectorLayerType;
  pathCommands: IPathCommand[] = [];
  private subscription: Subscription;

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
