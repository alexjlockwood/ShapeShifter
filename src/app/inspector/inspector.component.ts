import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { PathLayer, IPathCommand } from './../scripts/model';
import { StateService, VectorLayerType } from './../state.service';
import { Subscription } from 'rxjs/Subscription';


@Component({
  selector: 'app-inspector',
  templateUrl: './inspector.component.html',
  styleUrls: ['./inspector.component.scss']
})
export class InspectorComponent implements OnInit, OnDestroy {
  @Input() vectorLayerType: VectorLayerType;
  pathCommands: IPathCommand[] = [];
  private subscription: Subscription;

  constructor(private stateService: StateService) { }

  ngOnInit() {
    this.subscription =
      this.stateService.subscribe(this.vectorLayerType, vectorLayer => {
        if (!vectorLayer) {
          return;
        }
        const pathCommands: IPathCommand[] = [];
        vectorLayer.walk(layer => {
          if (layer instanceof PathLayer) {
            pathCommands.push(layer.pathData);
          }
        });
        this.pathCommands = pathCommands;
      });
  }

  trackSvgPathData(index: number, item: IPathCommand) {
    // TODO(alockwood): this needs to somehow incorporate the path position
    // (in case multiple paths have identical path strings)
    return item.id;
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
