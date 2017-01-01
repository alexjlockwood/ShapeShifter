import { Component, Input } from '@angular/core';
import { Layer, VectorLayer, PathLayer } from './../scripts/models';
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
  private vectorLayer_: VectorLayer;

  constructor() { }

  // TODO(alockwood): figure out how to handle multiple paths in the vector layer
  @Input()
  set vectorLayer(vectorLayer: VectorLayer) {
    this.vectorLayer_ = vectorLayer;

    const commands: string[] = [];
    const findPoints = layer => {
      if (layer.children) {
        layer.children.forEach(c => findPoints(c));
        return;
      }
      if (layer instanceof PathLayer) {
        commands.push(...layer.pathData.commands.map(c => {
          const cmdPts = c.points;
          if (cmdPts.length) {
            const p = cmdPts[cmdPts.length - 1];
            return `${c.toSvgChar()} ${p.x},${p.y}`;
          } else {
            return `${c.toSvgChar()}`;
          }
        }));
      };
    }
    findPoints(vectorLayer);
    this.commands_ = commands;
  }

  get commands() {
    return this.commands_;
  }
}
