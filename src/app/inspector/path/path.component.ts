import {
  Component, OnChanges, SimpleChanges,
  Input, Output, OnInit, EventEmitter
} from '@angular/core';
import { PathCommand, SubPathCommand } from './../../scripts/model';
import { GlobalStateService, VectorType } from './../../state.service';
import { Subscription } from 'rxjs/Subscription';
import { Observable } from 'rxjs/Observable';

@Component({
  selector: 'app-path',
  template: `
  <app-subpath *ngFor="let command of subPathCommands; let commandIndex = index; trackBy: trackSubPathCommand"
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
  subPathCommands: ReadonlyArray<SubPathCommand> = [];
  private pathCommand_: PathCommand;

  ngOnInit() {
    // console.log('ngOnInit');
  }

  ngOnChanges(changes: SimpleChanges) {
    // console.log('path');
  }

  @Input()
  set pathCommand(pathCommand: PathCommand) {
    // console.log('setting new path command');
    this.pathCommand_ = pathCommand;
    this.subPathCommands = pathCommand.commands;
  }

  get pathCommand() {
    return this.pathCommand_;
  }

  trackSubPathCommand(index: number, item: SubPathCommand) {
    // TODO: will need to change this once we support reordering sub paths
    return index;
  }
}

