import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { Layer, VectorLayer, PathLayer } from './../scripts/models';
import { SvgPathData } from './../scripts/svgpathdata';
import {
  DrawCommand, MoveCommand, LineCommand, QuadraticCurveCommand,
  BezierCurveCommand, EllipticalArcCommand, ClosePathCommand
} from './../scripts/svgcommands';
import { StateService, VectorLayerType } from './../state.service';
import { Subscription } from 'rxjs/Subscription';


@Component({
  selector: 'app-inspector',
  templateUrl: './inspector.component.html',
  styleUrls: ['./inspector.component.scss']
})
export class InspectorComponent implements OnInit, OnDestroy {
  @Input() vectorLayerType: VectorLayerType;
  pathCommands: SvgPathData[] = [];
  private subscription: Subscription;

  constructor(private stateService: StateService) { }

  ngOnInit() {
    this.subscription =
      this.stateService.subscribe(this.vectorLayerType, layer => {
        if (!layer) {
          return;
        }
        const pathCommands: SvgPathData[] = [];
        layer.walk(l => {
          if (l instanceof PathLayer) {
            pathCommands.push(l.pathData);
          }
        });
        this.pathCommands = pathCommands;
      });
  }

  trackSvgPathData(index: number, item: SvgPathData) {
    // TODO(alockwood): this needs to somehow incorporate the path position
    // (in case multiple paths have identical path strings)
    return item.pathString;
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
