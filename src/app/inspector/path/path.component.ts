import {
  Component, OnChanges, SimpleChanges,
  Input, Output, OnInit, EventEmitter
} from '@angular/core';
import { PathCommand, SubPathCommand, EditorType } from './../../scripts/model';
import { Subscription } from 'rxjs/Subscription';
import { Observable } from 'rxjs/Observable';

@Component({
  selector: 'app-path',
  templateUrl: './path.component.html',
  styleUrls: ['./path.component.scss']
})
export class PathComponent {
  @Input() editorType: EditorType;
  @Input() pathId: string;
  @Input() pathCommand: PathCommand;

  get subPathCommands() {
    return this.pathCommand.commands;
  }

  trackSubPathCommand(index: number, item: SubPathCommand) {
    // TODO: will need to change this once we support reordering sub paths
    return index;
  }
}

