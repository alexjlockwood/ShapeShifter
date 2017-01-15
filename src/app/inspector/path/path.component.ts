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
  <app-subpath *ngFor="let command of subPathCommands; let commandIndex = index; trackBy: trackByFn"
      fxLayout="column"
      [pathCommandIndex]="pathCommandIndex"
      [subPathCommandIndex]="commandIndex"
      [subPathCommand]="command">
  </app-subpath>`,
  styleUrls: ['./path.component.scss']
})
export class PathComponent implements OnInit, OnChanges {
  @Input('pathCommandIndex') pathCommandIndex: number;

  // Sub path commands to use to populate the ngFor loop of sub path components.
  subPathCommands: ReadonlyArray<ISubPathCommand> = [];
  private pathCommand_: IPathCommand;

  ngOnInit() {
    // console.log('ngOnInit');
  }

  ngOnChanges(changes: SimpleChanges) {
    // console.log('path');
  }

  @Input()
  set pathCommand(pathCommand: IPathCommand) {
    // console.log('setting new path command');
    this.pathCommand_ = pathCommand;
    this.subPathCommands = pathCommand.commands;
  }

  get pathCommand() {
    return this.pathCommand_;
  }

  trackByFn(index: number, item: ISubPathCommand) {
    return index;
  }
}

