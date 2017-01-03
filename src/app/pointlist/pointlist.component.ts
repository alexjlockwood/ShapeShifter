import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Layer, VectorLayer, PathLayer } from './../scripts/models';
import { SvgPathData } from './../scripts/svgpathdata';
import {
  Command, MoveCommand, LineCommand, QuadraticCurveCommand,
  BezierCurveCommand, EllipticalArcCommand, ClosePathCommand
} from './../scripts/svgcommands';


@Component({
  selector: 'app-pointlist',
  templateUrl: './pointlist.component.html',
  styleUrls: ['./pointlist.component.scss']
})
export class PointListComponent {
  private commands_: string[] = [];
  private pathLayer_: PathLayer;
  @Output() pointListReversedEmitter = new EventEmitter<PathLayer>();

  constructor() { }

  // TODO(alockwood): figure out how to handle multiple paths in the vector layer
  @Input()
  set pathLayer(pathLayer: PathLayer) {
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
    this.pointListReversedEmitter.emit(this.pathLayer_);
  }

  onShiftBackwardPointsClick() { }

  onShiftForwardPointsClick() { }
}
