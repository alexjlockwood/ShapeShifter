import { Component, OnInit } from '@angular/core';
import { StateService } from './../state.service';
import { VectorLayer, PathLayer } from './../scripts/models';
import { DragulaService } from 'ng2-dragula';
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
  private commands: string[] = [];
  private vectorLayer_: VectorLayer;

  constructor(private dragulaService: DragulaService) {
    dragulaService.drag.subscribe((value) => {
      console.log(`drag: ${value[0]}`);
      this.onDrag(value.slice(1));
    });
    dragulaService.drop.subscribe((value) => {
      console.log(`drop: ${value[0]}`);
      this.onDrop(value.slice(1));
    });
    dragulaService.over.subscribe((value) => {
      console.log(`over: ${value[0]}`);
      this.onOver(value.slice(1));
    });
    dragulaService.out.subscribe((value) => {
      console.log(`out: ${value[0]}`);
      this.onOut(value.slice(1));
    });
  }

  private onDrag(args) {
    let [e, el] = args;
    // do something
    //console.log(e, el);
  }

  private onDrop(args) {
    let [e, el] = args;
    // do something
    //console.log(e, el);
  }

  private onOver(args) {
    let [e, el, container] = args;
    // do something
    //console.log(e, el);
  }

  private onOut(args) {
    let [e, el, container] = args;
    // do something
    //console.log(e, el);
  }

  get vectorLayer() {
    return this.vectorLayer_;
  }

  set vectorLayer(vectorLayer: VectorLayer) {
    this.vectorLayer_ = vectorLayer;
    this.drawPointList();
  }

  // TODO(alockwood): this only works with SVGs that have a single PathLayer child right now
  private drawPointList() {
    this.commands = [];
    let findPoints = layer => {
      if (layer.children) {
        layer.children.forEach(c => findPoints(c));
        return;
      }
      if (layer instanceof PathLayer) {
        this.commands.push(...layer.pathData.commands.map(c => {
          const points = c.points.map(p => {
            const x = Number(p.x.toFixed(2));
            const y = Number(p.y.toFixed(2));
            return `(${x},${y})`;
          });
          return this.getCommandCharacter(c) + ' ' + points.toString();
        }));
      };
    }
    findPoints(this.vectorLayer);
  }

  private getCommandCharacter(command: Command) {
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
  }
}
