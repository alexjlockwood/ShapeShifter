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
  private commands_: string[] = [];
  private pathLayer_: PathLayer;
  private subscription: Subscription;
  private vectorLayer_: VectorLayer;

  constructor(private stateService: StateService) { }

  ngOnInit() {
    this.subscription = this.stateService.subscribeToVectorLayer(this.vectorLayerType, layer => {
      if (!layer) {
        return;
      }
      this.vectorLayer = layer;
    });
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  private get vectorLayer() {
    return this.vectorLayer_;
  }

  private set vectorLayer(vectorLayer: VectorLayer) {
    this.vectorLayer_ = vectorLayer;
    this.pathLayer = this.findFirstPathLayer(this.vectorLayer_);
  }

  private get pathLayer() {
    return this.pathLayer_;
  }

  // TODO(alockwood): figure out how to handle multiple paths in the vector layer
  private set pathLayer(pathLayer: PathLayer) {
    this.pathLayer_ = pathLayer;

    const commands: string[] = [];
    commands.push(...pathLayer.pathData.commands.map(c => {
      const cmdPts = c.points;
      if (c instanceof ClosePathCommand) {
        return `${c.svgChar}`;
      } else {
        const p = cmdPts[cmdPts.length - 1];
        return `${c.svgChar} ${p.x},${p.y}`;
      }
    }));
    this.commands_ = commands;
  }

  get commands() {
    return this.commands_;
  }

  onAddPointClick() { }

  onReversePointsClick() {
    // TODO(alockwood): relax these preconditions...
    const commands = this.pathLayer.pathData.commands;
    if (commands.length < 2) {
      return;
    }
    if (!(commands[0] instanceof MoveCommand)) {
      return;
    }
    if (!(commands[commands.length - 1] instanceof ClosePathCommand)) {
      return;
    }
    const newCommands = [];
    newCommands.push(commands[0]);
    let lastEndpoint = commands[0].points[1];
    for (let i = commands.length - 2; i >= 1; i--) {
      const endPoint = commands[i].points[1];
      newCommands.push(new LineCommand(lastEndpoint, endPoint));
      lastEndpoint = endPoint;
    }
    newCommands.push(new ClosePathCommand(lastEndpoint, commands[0].points[1]));

    this.pathLayer.pathData = new SvgPathData(newCommands);
    this.stateService.setVectorLayer(this.vectorLayerType, this.vectorLayer);
  }

  onShiftBackwardPointsClick() { }

  onShiftForwardPointsClick() { }

  private findFirstPathLayer(layer: Layer): PathLayer | null {
    if (layer.children) {
      for (let i = 0; i < layer.children.length; i++) {
        const pathLayer = this.findFirstPathLayer(layer.children[i]);
        if (pathLayer) {
          return pathLayer;
        }
      }
    }
    if (layer instanceof PathLayer) {
      return layer;
    }
    return null;
  }
}
