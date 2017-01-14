import {
  Component, OnChanges, SimpleChanges,
  Input, Output, OnInit, EventEmitter
} from '@angular/core';
import { IPathCommand, ISubPathCommand } from './../../scripts/model';
import { StateService, VectorLayerType } from './../../state.service';
import { Subscription } from 'rxjs/Subscription';
import { Observable } from 'rxjs/Observable';

@Component({
  selector: 'app-path',
  template: `
  <app-subpath *ngFor="let subPathCommand of subPathCommands"
      fxLayout="column"
      [vectorLayerType]="vectorLayerType"
      [subPathCommand]="subPathCommand">
  </app-subpath>`,
  styleUrls: ['./path.component.scss']
})
export class PathComponent implements OnInit, OnChanges {
  @Input() vectorLayerType: VectorLayerType;
  @Output() changeEventEmitter = new EventEmitter<any>();
  pathCommand_: IPathCommand;
  subPathCommands: ReadonlyArray<ISubPathCommand> = [];

  ngOnInit() {
    // console.log('ngOnInit');
  }

  ngOnChanges(changes: SimpleChanges) {
    // console.log('path');
  }

  get pathCommand() {
    return this.pathCommand_;
  }

  @Input()
  set pathCommand(pathCommand: IPathCommand) {
    // console.log('setting new path command');
    this.pathCommand_ = pathCommand;
    this.subPathCommands = pathCommand.commands;
  }
}
