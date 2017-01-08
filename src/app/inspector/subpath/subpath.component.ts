import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
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
export class SubPathComponent implements OnInit {
  @Input() vectorLayerType: VectorLayerType;
  @Input() subPathCommand: SubPathCommand;
  drawCommands: DrawCommand[] = [];
  private subscription: Subscription;

  constructor(private stateService: StateService) { }

  ngOnInit() {
    this.drawCommands = this.subPathCommand.commands;
  }

  onReversePointsClick() {
    this.subPathCommand.reverse();
    this.stateService.notifyVectorLayerChanged(this.vectorLayerType);
  }

  onShiftBackClick() {
    this.subPathCommand.shiftBack();
    this.stateService.notifyVectorLayerChanged(this.vectorLayerType);
  }

  onShiftForwardClick() {
    this.subPathCommand.shiftForward();
    this.stateService.notifyVectorLayerChanged(this.vectorLayerType);
  }
}
