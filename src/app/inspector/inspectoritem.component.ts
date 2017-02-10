import * as _ from 'lodash';
import {
  Component, AfterViewInit, OnChanges, Output, OnInit, HostListener,
  SimpleChanges, Input, ViewChild, ElementRef, OnDestroy
} from '@angular/core';
import { PathCommand, Command } from '../scripts/commands';
import { PathLayer } from '../scripts/layers';
import * as $ from 'jquery';
import { LayerStateService } from '../services/layerstate.service';
import { SelectionStateService, Selection } from '../services/selectionstate.service';
import { HoverStateService, Type as HoverType } from '../services/hoverstate.service';
import { Subscription } from 'rxjs/Subscription';
import { ColorUtil } from '../scripts/common';
import { CanvasType } from '../CanvasType';

@Component({
  selector: 'app-inspectoritem',
  templateUrl: './inspectoritem.component.html',
  styleUrls: ['./inspectoritem.component.scss']
})
export class InspectorItemComponent implements OnInit, OnDestroy {
  @Input() canvasType: CanvasType;
  @Input() subIdx: number;
  @Input() cmdIdx: number;
  @Input() command: Command;

  private isSelected = false;
  private isHovering = false;
  private isHoveringOverCommand = false;
  private isHoveringOverSplit = false;
  private isHoveringOverUnsplit = false;
  private readonly subscriptions: Subscription[] = [];

  constructor(
    private layerStateService: LayerStateService,
    private hoverStateService: HoverStateService,
    private selectionStateService: SelectionStateService) { }

  ngOnInit() {
    this.subscriptions.push(
      this.selectionStateService.stream.subscribe(
        (selections: Selection[]) => {
          this.isSelected = _.some(selections, {
            source: this.canvasType,
            commandId: {
              pathId: this.layerStateService.getActivePathId(this.canvasType),
              subIdx: this.subIdx,
              cmdIdx: this.cmdIdx,
            }
          });
        }));
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  // TODO: make these ordered list items instead?
  getCommandText() {
    const c = this.command;
    if (c.svgChar === 'Z') {
      return `${this.cmdIdx + 1}. ${c.svgChar}`;
    } else {
      const p = _.last(c.points);
      const x = _.round(p.x, 2);
      const y = _.round(p.y, 2);
      return `${this.cmdIdx + 1}. ${c.svgChar} ${x}, ${y}`;
    }
  }

  onCommandClick(event: MouseEvent) {
    const selections = this.selectionStateService.getSelections();
    const appendToList = event.shiftKey || event.metaKey;
    if (selections.length && selections[0].source !== this.canvasType && appendToList) {
      // If the user is attempting to select something in a different pane in the
      // middle of a multi-select, do nothing.
      return;
    }

    // Selecting the last 'Z' command doesn't seem to work...
    this.selectionStateService.toggle({
      source: this.canvasType,
      commandId: {
        pathId: this.layerStateService.getActivePathId(this.canvasType),
        subIdx: this.subIdx,
        cmdIdx: this.cmdIdx,
      }
    }, appendToList);
  }

  private getPathCommand() {
    const vectorLayer = this.layerStateService.getVectorLayer(this.canvasType);
    const pathId = this.layerStateService.getActivePathId(this.canvasType);
    return (vectorLayer.findLayerById(pathId) as PathLayer).pathData;
  }

  // TODO: update selections
  onReverseClick(event: MouseEvent) {
    const fromPathLayer = this.layerStateService.getActivePathLayer(this.canvasType);
    this.updatePathLayer(fromPathLayer, fromPathLayer.pathData.reverse(this.subIdx), event);
  }

  // TODO: update selections
  onShiftBackClick(event: MouseEvent) {
    const fromPathLayer = this.layerStateService.getActivePathLayer(this.canvasType);
    this.updatePathLayer(fromPathLayer, fromPathLayer.pathData.shiftBack(this.subIdx), event);
  }

  // TODO: update selections
  onShiftForwardClick(event: MouseEvent) {
    const fromPathLayer = this.layerStateService.getActivePathLayer(this.canvasType);
    this.updatePathLayer(fromPathLayer, fromPathLayer.pathData.shiftForward(this.subIdx), event);
  }

  // TODO: update selections
  onSplitButtonClick(event: MouseEvent) {
    const fromPathLayer = this.layerStateService.getActivePathLayer(this.canvasType);
    this.updatePathLayer(
      fromPathLayer, fromPathLayer.pathData.split(this.subIdx, this.cmdIdx), event);
  }

  // TODO: update selections
  onUnsplitButtonClick(event: MouseEvent) {
    const fromPathLayer = this.layerStateService.getActivePathLayer(this.canvasType);
    this.updatePathLayer(
      fromPathLayer, fromPathLayer.pathData.unsplit(this.subIdx, this.cmdIdx), event);
  }

  private updatePathLayer(pathLayer: PathLayer, pathData: PathCommand, event: MouseEvent) {
    pathLayer.pathData = pathData;
    this.layerStateService.notifyChange(this.canvasType);

    // This ensures that the parent div won't also receive the same click event.
    event.cancelBubble = true;
  }

  isReversible() {
    return this.cmdIdx === 0
      && this.getPathCommand().subPathCommands[this.subIdx].commands.length > 1;
  }

  isShiftable() {
    return this.getPathCommand().subPathCommands[this.subIdx].isClosed;
  }

  // isConvertable() {
  //   // TODO: this API usage is a little bit weird/hacky?
  //   const canvasType =
  //     this.canvasType === CanvasType.Start
  //       ? CanvasType.End
  //       : CanvasType.Start;
  //   const vl = this.layerStateService.getVectorLayer(canvasType);
  //   const pathId = this.layerStateService.getActivePathId(this.canvasType);
  //   const pathData = (vl.findLayerById(pathId) as PathLayer).pathData;
  //   if (pathData.subPathCommands.length <= this.subIdx) {
  //     return false;
  //   }
  //   if (pathData.subPathCommands[this.subIdx].commands.length <= this.cmdIdx) {
  //     return false;
  //   }
  //   const drawCmd = pathData.subPathCommands[this.subIdx].commands[this.cmdIdx];
  //   return this.command.svgChar !== drawCmd.svgChar
  //     && this.command.canConvertTo(drawCmd.svgChar);
  // }

  isSplittable() {
    return this.command.svgChar !== 'M';
  }

  isUnsplittable() {
    return this.command.isSplit;
  }

  // TODO: also add similar logic for reverse/shift/unshift?
  onCommandHoverEvent(isHoveringOverCommand: boolean) {
    this.isHoveringOverCommand = isHoveringOverCommand;
    this.broadcastHoverEvent(isHoveringOverCommand, HoverType.Command);
  }

  // TODO: also add similar logic for reverse/shift/unshift?
  onUnsplitHoverEvent(isHoveringOverUnsplit: boolean) {
    this.isHoveringOverUnsplit = isHoveringOverUnsplit;
    this.broadcastHoverEvent(isHoveringOverUnsplit, HoverType.Unsplit);
  }

  // TODO: also add similar logic for reverse/shift/unshift?
  onSplitHoverEvent(isHoveringOverSplit: boolean) {
    this.isHoveringOverSplit = isHoveringOverSplit;
    this.broadcastHoverEvent(isHoveringOverSplit, HoverType.Split);
  }

  private broadcastHoverEvent(isHovering: boolean, hoverType: HoverType) {
    const pathId = this.layerStateService.getActivePathId(this.canvasType);
    const subIdx = this.subIdx;
    const cmdIdx = this.cmdIdx;
    const commandId = { pathId, subIdx, cmdIdx };
    if (isHovering) {
      this.hoverStateService.setHover({
        type: hoverType,
        commandId: { pathId, subIdx, cmdIdx },
        source: this.canvasType,
      });
    } else if (hoverType !== HoverType.Command && this.isHoveringOverCommand) {
      this.hoverStateService.setHover({
        type: HoverType.Command,
        commandId: { pathId, subIdx, cmdIdx },
        source: this.canvasType,
      });
    } else {
      this.hoverStateService.clearHover();
    }
    this.isHovering =
      this.isHoveringOverCommand
      && !this.isHoveringOverSplit
      && !this.isHoveringOverUnsplit;
  }
}
