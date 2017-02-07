import {
  Component, OnChanges, SimpleChanges,
  Input, Output, OnInit, EventEmitter
} from '@angular/core';
import { PathCommand, SubPathCommand } from './../../scripts/commands';
import { Subscription } from 'rxjs/Subscription';
import { Observable } from 'rxjs/Observable';
import { CanvasType } from '../../CanvasType';

@Component({
  selector: 'app-path',
  templateUrl: './path.component.html',
  styleUrls: ['./path.component.scss']
})
export class PathComponent {
  @Input() canvasType: CanvasType;
  @Input() pathId: string;
  @Input() pathCommand: PathCommand;

  get subPathCommands() {
    return this.pathCommand.subPathCommands;
  }

  trackSubPathCommand(index: number, item: SubPathCommand) {
    // TODO: will need to change this once we support reordering sub paths
    return index;
  }
}

