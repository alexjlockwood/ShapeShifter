import { Component, OnInit, ViewContainerRef } from '@angular/core';
import {
  LayerStateService, MorphabilityStatus, Event as LayerStateEvent
} from '../services/layerstate.service';
import { CanvasType } from '../CanvasType';
import { AvdSerializer } from '../scripts/parsers';
import * as $ from 'jquery';
import { AvdTarget } from '../scripts/animation';
import { DialogsService } from '../dialogs';
import { AutoAwesome } from '../scripts/common';
import { AnimatorService } from '../services/animator.service';

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent implements OnInit {
  morphabilityStatus = MorphabilityStatus.None

  constructor(
    private viewContainerRef: ViewContainerRef,
    private animatorService: AnimatorService,
    private layerStateService: LayerStateService,
    private dialogsService: DialogsService) { }

  ngOnInit() {
    this.layerStateService.addListener(CanvasType.Start, (event: LayerStateEvent) => {
      this.morphabilityStatus = event.morphabilityStatus;
    });
    this.layerStateService.addListener(CanvasType.End, (event: LayerStateEvent) => {
      this.morphabilityStatus = event.morphabilityStatus;
    });
  }

  onNewClick() {
    this.dialogsService
      .confirm('Start from scratch?', 'You\'ll lose any unsaved changes.', this.viewContainerRef)
      .subscribe(res => console.log('TODO: implement this'));
  }

  onAutoFixClick() {
    let resultStartCmd = this.layerStateService.getActivePathLayer(CanvasType.Start).pathData;
    let resultEndCmd = this.layerStateService.getActivePathLayer(CanvasType.End).pathData;
    const numSubPaths = resultStartCmd.subPathCommands.length;
    for (let subIdx = 0; subIdx < numSubPaths; subIdx++) {
      // Pass the command with the larger subpath as the 'from' command.
      const numStartCmds = resultStartCmd.subPathCommands[subIdx].commands.length;
      const numEndCmds = resultEndCmd.subPathCommands[subIdx].commands.length;
      const fromCmd = numStartCmds >= numEndCmds ? resultStartCmd : resultEndCmd;
      const toCmd = numStartCmds >= numEndCmds ? resultEndCmd : resultStartCmd;
      const {from, to} = AutoAwesome.autoFix(subIdx, fromCmd, toCmd);
      resultStartCmd = numStartCmds >= numEndCmds ? from : to;
      resultEndCmd = numStartCmds >= numEndCmds ? to : from;
      // TODO: avoid calling these once-per-subIdx...
      this.layerStateService.replaceActivePathCommand(CanvasType.Start, resultStartCmd, subIdx);
      this.layerStateService.replaceActivePathCommand(CanvasType.End, resultEndCmd, subIdx);
    }
  }

  onExportClick() {
    const startVectorLayer = this.layerStateService.getVectorLayer(CanvasType.Start);
    const startLayer = this.layerStateService.getActivePathLayer(CanvasType.Start);
    const fromValue = startLayer.pathData.pathString;
    const endLayer = this.layerStateService.getActivePathLayer(CanvasType.End);
    const toValue = endLayer.pathData.pathString;
    const duration = this.animatorService.getDuration();
    const interpolator = this.animatorService.getInterpolator();
    const xmlStr = AvdSerializer.vectorLayerAnimationToAvdXmlString(startVectorLayer,
      new AvdTarget(
        startLayer.id,
        fromValue,
        toValue,
        duration,
        interpolator.androidRef,
        'pathData',
        'pathType'));
    this.downloadFile(xmlStr, `ShapeShifterAvd.xml`);
  }

  private downloadFile(content: string, filename: string) {
    const blob = new Blob([content], { type: 'octet/stream' });
    const url = window.URL.createObjectURL(blob);
    const anchor = $('<a>').hide().appendTo(document.body);
    anchor.attr({ href: url, download: filename });
    anchor.get(0).click();
    window.URL.revokeObjectURL(url);
  }
}
