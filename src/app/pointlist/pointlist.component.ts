import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { Layer, VectorLayer, PathLayer } from './../scripts/models';
import { SvgPathData } from './../scripts/svgpathdata';
import {
  Command, MoveCommand, LineCommand, QuadraticCurveCommand,
  BezierCurveCommand, EllipticalArcCommand, ClosePathCommand
} from './../scripts/svgcommands';
import { StateService, VectorLayerType } from './../state.service';
import { Subscription } from 'rxjs/Subscription';


@Component({
  selector: 'app-pointlist',
  templateUrl: './pointlist.component.html',
  styleUrls: ['./pointlist.component.scss']
})
export class PointListComponent implements OnInit, OnDestroy {
  @Input() vectorLayerType: VectorLayerType;

  private vectorLayer_: VectorLayer;
  private pathLayers_: PathLayer[] = [];
  private pathLayerCommands_: Command[][] = [];
  private pathLayerCommandStrings_: string[][] = [];

  private subscription: Subscription;

  constructor(private stateService: StateService) { }

  // TODO(alockwood): figure out how to handle multiple paths in the vector layer
  ngOnInit() {
    this.subscription = this.stateService.subscribeToVectorLayer(this.vectorLayerType, layer => {
      if (!layer) {
        return;
      }
      this.vectorLayer_ = layer;
      this.buildPathCommandStrings();
    });
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  buildPathCommandStrings() {
    const pathLayers: PathLayer[] = [];
    const pathLayerCommands: Command[][] = [];
    const pathLayerCommandStrings: string[][] = [];
    this.vectorLayer_.walk(layer => {
      if (layer instanceof PathLayer) {
        pathLayers.push(layer);
        pathLayerCommands.push(layer.pathData.commands);
        pathLayerCommandStrings.push(layer.pathData.commands.map(c => {
          if (c instanceof ClosePathCommand) {
            return `${c.svgChar}`;
          } else {
            const p = c.points[c.points.length - 1];
            return `${c.svgChar} ${p.x}, ${p.y}`;
          }
        }));
      }
    });
    this.pathLayers_ = pathLayers;
    this.pathLayerCommands_ = pathLayerCommands;
    this.pathLayerCommandStrings_ = pathLayerCommandStrings;
  }

  get pathLayerCommandStrings() {
    return this.pathLayerCommandStrings_;
  }

  onAddPointClick() { }

  onReversePointsClick() {
    this.vectorLayer_.walk(layer => {
      if (layer instanceof PathLayer) {
        layer.pathData.reverse();
      }
    });
    this.buildPathCommandStrings();
    this.stateService.setVectorLayer(this.vectorLayerType, this.vectorLayer_);
  }

  onShiftBackwardPointsClick() { }

  onShiftForwardPointsClick() { }
}
