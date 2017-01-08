import { Component, OnChanges, SimpleChanges, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { Layer, VectorLayer, PathLayer } from './../../scripts/models';
import { SvgPathData } from './../../scripts/svgpathdata';
import {
  DrawCommand, MoveCommand, LineCommand, QuadraticCurveCommand,
  BezierCurveCommand, EllipticalArcCommand, ClosePathCommand, SubPathCommand
} from './../../scripts/svgcommands';
import { StateService, VectorLayerType } from './../../state.service';
import { Subscription } from 'rxjs/Subscription';


@Component({
  selector: 'app-path',
  templateUrl: './path.component.html',
  styleUrls: ['./path.component.scss']
})
export class PathComponent implements OnInit, OnChanges {
  @Input() vectorLayerType: VectorLayerType;
  @Input() pathCommand: SvgPathData;
  subPathCommands: SubPathCommand[] = [];

  ngOnInit() {
    this.subPathCommands = this.pathCommand.subPathCommands;
  }

  ngOnChanges(changes: SimpleChanges) { }
}
