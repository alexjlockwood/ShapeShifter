import {
  Component, Input, OnInit, ChangeDetectorRef,
  OnDestroy, NgZone, OnChanges
} from '@angular/core';
import { PathLayer, IPathCommand } from './../scripts/model';
import { StateService, VectorLayerType } from './../state.service';
import { Subscription } from 'rxjs/Subscription';
import { InspectorService, EventType, InspectorEvent } from './inspector.service';

@Component({
  selector: 'app-inspector',
  template: `
  <app-path *ngFor="let command of pathCommands; let commandIndex = index; trackBy: trackByFn"
      fxLayout="column"
      [pathCommandIndex]="commandIndex"
      [pathCommand]="command">
  </app-path>`,
  styleUrls: ['./inspector.component.scss'],
  providers: [InspectorService]
})
export class InspectorComponent implements OnInit, OnChanges, OnDestroy {
  @Input('vectorLayerType') vectorLayerType: VectorLayerType;

  // Path commands to use to populate the ngFor loop of path components.
  pathCommands: ReadonlyArray<IPathCommand> = [];
  pathLayerIds: ReadonlyArray<string> = [];

  private subscriptions: Subscription[] = [];

  constructor(
    private stateService: StateService,
    private inspectorService: InspectorService) { }

  ngOnInit() {
    this.subscriptions.push(
      this.stateService.addOnVectorLayerChangeListener(
        this.vectorLayerType, vl => {
          if (!vl) {
            return;
          }
          const pathLayerIds: string[] = [];
          const pathCommands: IPathCommand[] = [];
          vl.walk(layer => {
            if (layer instanceof PathLayer) {
              pathLayerIds.push(layer.id);
              pathCommands.push(layer.pathData);
            }
          });
          this.pathLayerIds = pathLayerIds;
          this.pathCommands = pathCommands;
        }));
    this.subscriptions.push(
      this.inspectorService.addListener((event: InspectorEvent) => {
        const {eventType, pathCommandIndex, subPathCommandIndex, drawCommandIndex} = event;
        if (eventType === EventType.Reverse) {

        } else if (eventType === EventType.ShiftBack) {

        } else if (eventType === EventType.ShiftForward) {

        } else if (eventType === EventType.Edit) {

        } else if (eventType === EventType.Delete) {
          const vl = this.stateService.getVectorLayer(this.vectorLayerType);
          const pathLayer = vl.findLayerById(this.pathLayerIds[pathCommandIndex]) as PathLayer;
          pathLayer.pathData = pathLayer.pathData.unsplit(subPathCommandIndex, drawCommandIndex);
          this.stateService.notifyVectorLayerChange(this.vectorLayerType);
        }
        console.log(eventType, pathCommandIndex, subPathCommandIndex, drawCommandIndex);
      }));
  }

  ngOnChanges() {
    // console.log('onChanges');
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  trackByFn(index: number, item: IPathCommand) {
    return index;
  }
}
