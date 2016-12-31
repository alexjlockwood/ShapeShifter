import { Component, Input } from '@angular/core';
import { StateService } from './../state.service';
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

  // TODO(alockwood): this only works with SVGs that have a single PathLayer child right now
  @Input()
  set vectorLayer(vectorLayer: VectorLayer) {
    this.vectorLayer_ = vectorLayer;

    const commands: string[] = [];
    const getCommandCharacter = (command: Command) => {
      if (command instanceof MoveCommand) {
        return 'M';
      } else if (command instanceof LineCommand) {
        return 'L';
      } else if (command instanceof BezierCurveCommand) {
        return 'C';
      } else if (command instanceof QuadraticCurveCommand) {
        return 'Q';
      } else if (command instanceof ClosePathCommand) {
        return 'Z';
      } else if (command instanceof EllipticalArcCommand) {
        return 'A';
      }
      return '[unknown]';
    };
    const findPoints = (layer: Layer) => {
      if (layer.children) {
        layer.children.forEach(c => findPoints(c));
        return;
      }
      if (layer instanceof PathLayer) {
        commands.push(...layer.pathData.commands.map(c => {
          const points = c.points.map(p => {
            const x = Number(p.x.toFixed(2));
            const y = Number(p.y.toFixed(2));
            return `(${x},${y})`;
          });
          return getCommandCharacter(c) + ' ' + points.toString();
        }));
      };
    }
    findPoints(vectorLayer);
    this.commands = commands;
  }

  get commands() {
    return this.commands_;
  }

  set commands(commands: string[]) {
    this.commands_ = commands;
  }
}
