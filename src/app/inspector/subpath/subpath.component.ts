import { Component, OnChanges, SimpleChanges, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { Layer, VectorLayer, PathLayer } from './../../scripts/models';
import { SvgPathData } from './../../scripts/svgpathdata';
import { StateService, VectorLayerType } from './../../state.service';
import {
  DrawCommand, MoveCommand, LineCommand, QuadraticCurveCommand,
  BezierCurveCommand, EllipticalArcCommand, ClosePathCommand, SubPathCommand
} from './../../scripts/svgcommands';
import { Subscription } from 'rxjs/Subscription';


@Component({
  selector: 'app-subpath',
  templateUrl: './subpath.component.html',
  styleUrls: ['./subpath.component.scss']
})
export class SubPathComponent implements OnInit, OnChanges {
  @Input() vectorLayerType: VectorLayerType;
  @Input() subPathCommand: SubPathCommand;
  drawCommandWrappers: DrawCommandWrapper[] = [];
  private subscription: Subscription;

  constructor(private stateService: StateService) { }

  ngOnInit() {
    this.updateDrawCommandWrappers();
  }

  ngOnChanges(changes: SimpleChanges) {
    this.updateDrawCommandWrappers();
  }

  private updateDrawCommandWrappers() {
    this.drawCommandWrappers = this.subPathCommand.commands.map((c, i) => { return { index: i, command: c } });
  }

  onReverseClick() {
    this.subPathCommand.reverse();
    this.stateService.notifyChange(this.vectorLayerType);
  }

  onShiftBackClick() {
    this.subPathCommand.shiftBack();
    this.stateService.notifyChange(this.vectorLayerType);
  }

  onShiftForwardClick() {
    this.subPathCommand.shiftForward();
    this.stateService.notifyChange(this.vectorLayerType);
  }

  trackDrawCommandWrapper(index: number, drawCommandWrapper: DrawCommandWrapper) {
    return drawCommandWrapper;
  }
}

interface DrawCommandWrapper {
  index: number;
  command: DrawCommand;
}
