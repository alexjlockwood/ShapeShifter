import { Component, OnChanges, SimpleChanges, Input, OnInit } from '@angular/core';
import { StateService, VectorLayerType } from './../../state.service';
import { IDrawCommand, ISubPathCommand } from './../../scripts/model';

@Component({
  selector: 'app-subpath',
  templateUrl: './subpath.component.html',
  styleUrls: ['./subpath.component.scss']
})
export class SubPathComponent implements OnInit, OnChanges {
  @Input() vectorLayerType: VectorLayerType;
  private subPathCommand_: ISubPathCommand;
  drawCommands: ReadonlyArray<IDrawCommand> = [];

  constructor(private stateService: StateService) { }

  ngOnInit() {
    // console.log('ngOnInit()');
  }

  ngOnChanges(changes: SimpleChanges) {
    // console.log('subpath');
  }

  get subPathCommand() {
    return this.subPathCommand_;
  }

  @Input()
  set subPathCommand(subPathCommand: ISubPathCommand) {
    console.log('setting new sub path command');
    this.subPathCommand_ = subPathCommand;
    this.drawCommands = subPathCommand.commands;
  }

  isSubPathClosed() {
    return this.subPathCommand_.isClosed();
  }

  onReverseClick() {
    this.subPathCommand_.reverse();
    this.stateService.notifyVectorLayerChange(this.vectorLayerType);
  }

  onShiftBackClick() {
    this.subPathCommand_.shiftBack();
    this.stateService.notifyVectorLayerChange(this.vectorLayerType);
  }

  onShiftForwardClick() {
    this.subPathCommand_.shiftForward();
    this.stateService.notifyVectorLayerChange(this.vectorLayerType);
  }
}
