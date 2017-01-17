import {
  Component, Input, OnInit, ChangeDetectorRef,
  OnDestroy, NgZone, OnChanges
} from '@angular/core';
import { PathLayer, PathCommand, EditorType } from '../scripts/model';
import { LayerStateService } from '../services/layerstate.service';
import { Subscription } from 'rxjs/Subscription';
import { InspectorService, EventType, InspectorEvent } from './inspector.service';

@Component({
  selector: 'app-inspector',
  templateUrl: './inspector.component.html',
  styleUrls: ['./inspector.component.scss'],
  providers: [InspectorService]
})
export class InspectorComponent implements OnInit, OnChanges, OnDestroy {
  @Input('vectorLayerType') vectorType: EditorType;

  // Path commands to use to populate the ngFor loop of path components.
  pathCommands: ReadonlyArray<PathCommand> = [];
  pathLayerIds: ReadonlyArray<string> = [];

  private subscriptions: Subscription[] = [];

  constructor(
    private layerStateService: LayerStateService,
    private inspectorService: InspectorService) { }

  ngOnInit() {
    this.subscriptions.push(
      this.layerStateService.addListener(
        this.vectorType, vl => {
          if (!vl) {
            return;
          }
          const pathLayerIds: string[] = [];
          const pathCommands: PathCommand[] = [];
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
        const vl = this.layerStateService.getVectorLayer(this.vectorType);
        const pathLayer = vl.findLayerById(this.pathLayerIds[pathCommandIndex]) as PathLayer;
        if (eventType === EventType.Reverse) {
          pathLayer.pathData = pathLayer.pathData.reverse(subPathCommandIndex);
        } else if (eventType === EventType.ShiftBack) {
          pathLayer.pathData = pathLayer.pathData.shiftBack(subPathCommandIndex);
        } else if (eventType === EventType.ShiftForward) {
          pathLayer.pathData = pathLayer.pathData.shiftForward(subPathCommandIndex);
        } else if (eventType === EventType.Delete) {
          pathLayer.pathData = pathLayer.pathData.unsplit(subPathCommandIndex, drawCommandIndex);
        } else if (eventType === EventType.Select) {

        }
        this.layerStateService.notifyChange(this.vectorType);
      }));
  }

  ngOnChanges() {
    // console.log('onChanges');
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  trackPathCommand(index: number, item: PathCommand) {
    // TODO: will need to change this once we support reordering paths
    return index;
  }
}
