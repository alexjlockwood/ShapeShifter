import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { Layer, VectorLayer, PathLayer } from './../scripts/models';
import { SvgPathData } from './../scripts/svgpathdata';
import {
  Command, MoveCommand, LineCommand, QuadraticCurveCommand,
  BezierCurveCommand, EllipticalArcCommand, ClosePathCommand
} from './../scripts/svgcommands';
import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';


@Component({
  selector: 'app-pointlist',
  templateUrl: './pointlist.component.html',
  styleUrls: ['./pointlist.component.scss']
})
export class PointListComponent implements OnInit, OnDestroy {
  private commands_: string[] = [];
  private pathLayer_: PathLayer;
  private subscription: Subscription;

  @Input() pathLayerStream: Observable<PathLayer>;
  @Output() pointListReversedEmitter = new EventEmitter<PathLayer>();

  ngOnInit() {
    console.log('ngOnInit()');
    this.subscription = this.pathLayerStream.subscribe(pathLayer => {
      if (!pathLayer) {
        return;
      }
      console.log('path layer updated');
      this.pathLayer = pathLayer;
    });
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  // TODO(alockwood): figure out how to handle multiple paths in the vector layer
  private set pathLayer(pathLayer: PathLayer) {
    console.log('asdf');
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
