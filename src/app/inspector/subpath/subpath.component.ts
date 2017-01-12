import { Component, OnChanges, SimpleChanges, Input, OnInit } from '@angular/core';
import { StateService, VectorLayerType } from './../../state.service';
import { IDrawCommand, ISubPathCommand } from './../../scripts/commands';

@Component({
  selector: 'app-subpath',
  templateUrl: './subpath.component.html',
  styleUrls: ['./subpath.component.scss']
})
export class SubPathComponent implements OnInit, OnChanges {
  @Input() vectorLayerType: VectorLayerType;
  @Input() subPathCommand: ISubPathCommand;
  drawCommands: IDrawCommand[] = [];

  constructor(private stateService: StateService) { }

  ngOnInit() {
    this.updateSubPathCommand();
  }

  ngOnChanges(changes: SimpleChanges) {
    // console.log('subpath');
  }

  private updateSubPathCommand() {
    this.drawCommands = this.subPathCommand.commands;
  }

  isSubPathClosed() {
    return this.subPathCommand.isClosed();
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
}
