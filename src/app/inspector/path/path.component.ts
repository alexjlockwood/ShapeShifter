import { Component, OnChanges, SimpleChanges, Input, OnInit } from '@angular/core';
import { IPathCommand, ISubPathCommand } from './../../scripts/model';
import { StateService, VectorLayerType } from './../../state.service';
import { Subscription } from 'rxjs/Subscription';

@Component({
  selector: 'app-path',
  templateUrl: './path.component.html',
  styleUrls: ['./path.component.scss']
})
export class PathComponent implements OnInit, OnChanges {
  @Input() vectorLayerType: VectorLayerType;
  @Input() pathCommand: IPathCommand;
  subPathCommands: ISubPathCommand[] = [];

  ngOnInit() {
    this.subPathCommands = this.pathCommand.commands;
  }

  ngOnChanges(changes: SimpleChanges) {
    // console.log('path');
  }
}
