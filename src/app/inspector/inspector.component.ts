import {
  Component, Input, OnInit, ChangeDetectorRef,
  OnDestroy, NgZone, OnChanges
} from '@angular/core';
import { VectorLayer, PathLayer } from '../scripts/layers';
import { PathCommand, SubPathCommand } from '../scripts/commands';
import { CanvasType } from '../CanvasType';
import { LayerStateService } from '../services/layerstate.service';
import { Subscription } from 'rxjs/Subscription';
import { InspectorService, EventType, InspectorEvent } from './inspector.service';
import { AutoAwesome } from '../scripts/common';

@Component({
  selector: 'app-inspector',
  templateUrl: './inspector.component.html',
  styleUrls: ['./inspector.component.scss'],
  providers: [InspectorService]
})
export class InspectorComponent implements OnInit, OnDestroy {
  @Input() canvasType: CanvasType;
  private readonly subscriptions: Subscription[] = [];

  constructor(
    private layerStateService: LayerStateService,
    private inspectorService: InspectorService) { }

  ngOnInit() {
    this.subscriptions.push(
      this.inspectorService.addListener((event: InspectorEvent) => {
        const {eventType, subIdx, cmdIdx} = event;
        const fromPathLayer = this.layerStateService.getActivePathLayer(this.canvasType);
        const toCanvasType =
          this.canvasType === CanvasType.End
            ? CanvasType.Start
            : CanvasType.End;
        switch (eventType) {
          case EventType.AutoFix: {
            const toPathLayer = this.layerStateService.getActivePathLayer(toCanvasType);
            const autoFixResult = AutoAwesome.fixAll(subIdx, fromPathLayer.pathData, toPathLayer.pathData);
            fromPathLayer.pathData = autoFixResult.from;
            toPathLayer.pathData = autoFixResult.to;
            this.layerStateService.notifyChange(CanvasType.Start);
            this.layerStateService.notifyChange(CanvasType.End);
            // TODO: update selections
          }
            break;
          case EventType.Convert: {
            const toPathLayer = this.layerStateService.getActivePathLayer(toCanvasType);
            const targetSvgChar =
              toPathLayer.pathData.subPathCommands[subIdx].commands[cmdIdx].svgChar;
            fromPathLayer.pathData =
              fromPathLayer.pathData.convert(subIdx, cmdIdx, targetSvgChar);
            // TODO: update selections
          }
            break;
          case EventType.Reverse:
            fromPathLayer.pathData = fromPathLayer.pathData.reverse(subIdx);
            const numCommands = fromPathLayer.pathData.subPathCommands[subIdx].commands.length;
            // TODO: update selections
            break;
          case EventType.ShiftBack:
            fromPathLayer.pathData = fromPathLayer.pathData.shiftBack(subIdx);
            // TODO: update selections
            break;
          case EventType.ShiftForward:
            fromPathLayer.pathData = fromPathLayer.pathData.shiftForward(subIdx);
            // TODO: update selections
            break;
          case EventType.Split:
            fromPathLayer.pathData = fromPathLayer.pathData.splitInHalf(subIdx, cmdIdx);
            // TODO: update selections
            break;
          case EventType.Unsplit:
            fromPathLayer.pathData = fromPathLayer.pathData.unsplit(subIdx, cmdIdx);
            // TODO: update selections
            break;
        }
        this.layerStateService.notifyChange(this.canvasType);
      }));
  }

  get subPathCommands() {
    const pathLayer = this.layerStateService.getActivePathLayer(this.canvasType);
    return pathLayer ? pathLayer.pathData.subPathCommands : [];
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  trackSubPathCommand(index: number, item: SubPathCommand) {
    // TODO: will need to change this if/when we support reordering subpaths
    return index;
  }
}
