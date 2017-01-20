import {
  Component, Input, OnInit, ChangeDetectorRef,
  OnDestroy, NgZone, OnChanges
} from '@angular/core';
import { PathLayer, PathCommand, EditorType } from '../scripts/model';
import { LayerStateService } from '../services/layerstate.service';
import { SelectionService } from '../services/selection.service';
import { Subscription } from 'rxjs/Subscription';
import { InspectorService, EventType, InspectorEvent } from './inspector.service';

@Component({
  selector: 'app-inspector',
  templateUrl: './inspector.component.html',
  styleUrls: ['./inspector.component.scss'],
  providers: [InspectorService]
})
export class InspectorComponent implements OnInit, OnDestroy {
  @Input() editorType: EditorType;

  // Path commands to use to populate the ngFor loop of path components.
  pathIds: ReadonlyArray<string> = [];
  pathCommands: ReadonlyArray<PathCommand> = [];

  private subscriptions: Subscription[] = [];

  constructor(
    private layerStateService: LayerStateService,
    private selectionService: SelectionService,
    private inspectorService: InspectorService) { }

  ngOnInit() {
    this.subscriptions.push(
      this.layerStateService.addListener(
        this.editorType, vl => {
          if (!vl) {
            return;
          }
          const pathIds: string[] = [];
          const pathCommands: PathCommand[] = [];
          vl.walk(layer => {
            if (layer instanceof PathLayer) {
              pathIds.push(layer.id);
              pathCommands.push(layer.pathData);
            }
          });
          this.pathIds = pathIds;
          this.pathCommands = pathCommands;
        }));
    this.subscriptions.push(
      this.inspectorService.addListener((event: InspectorEvent) => {
        const {eventType, pathId, subPathIdx, drawIdx} = event;
        const vl = this.layerStateService.getData(this.editorType);
        const pathLayer = vl.findLayerById(pathId) as PathLayer;
        if (eventType === EventType.Reverse) {
          pathLayer.pathData = pathLayer.pathData.reverse(subPathIdx);
          const numCommands = pathLayer.pathData.commands[subPathIdx].commands.length;
          this.selectionService.reverse(this.editorType, subPathIdx, numCommands);
        } else if (eventType === EventType.ShiftBack) {
          pathLayer.pathData = pathLayer.pathData.shiftBack(subPathIdx);
        } else if (eventType === EventType.ShiftForward) {
          pathLayer.pathData = pathLayer.pathData.shiftForward(subPathIdx);
        } else if (eventType === EventType.Delete) {
          pathLayer.pathData = pathLayer.pathData.unsplit(subPathIdx, drawIdx);
        }
        this.layerStateService.notifyChange(this.editorType);
      }));
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  trackPathCommand(index: number, item: PathCommand) {
    // TODO: will need to change this once we support reordering paths
    return index;
  }
}
