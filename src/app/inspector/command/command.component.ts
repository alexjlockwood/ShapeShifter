import * as _ from 'lodash';
import {
  Component, AfterViewInit, OnChanges, Output, OnInit, HostListener,
  SimpleChanges, Input, ViewChild, ElementRef, OnDestroy
} from '@angular/core';
import { Command } from '../../scripts/commands';
import { PathLayer } from '../../scripts/layers';
import * as $ from 'jquery';
import { InspectorService, EventType } from '../../services/inspector.service';
import { LayerStateService } from '../../services/layerstate.service';
import { SelectionStateService, Selection } from '../../services/selectionstate.service';
import { HoverStateService, Type as HoverType } from '../../services/hoverstate.service';
import { Subscription } from 'rxjs/Subscription';
import { ColorUtil } from '../../scripts/common';
import { CanvasType } from '../../CanvasType';

@Component({
  selector: 'app-command',
  templateUrl: './command.component.html',
  styleUrls: ['./command.component.scss']
})
export class CommandComponent implements OnInit, OnDestroy {
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
    private selectionStateService: SelectionStateService,
    private inspectorService: InspectorService) { }

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

  onReverseClick() {
    const subIdx = this.subIdx;
    this.inspectorService.notifyChange({
      source: this.canvasType,
      eventType: EventType.Reverse,
      subIdx,
    });
  }

  onShiftBackClick() {
    const subIdx = this.subIdx;
    this.inspectorService.notifyChange({
      source: this.canvasType,
      eventType: EventType.ShiftBack,
      subIdx,
    });
  }

  onShiftForwardClick() {
    const subIdx = this.subIdx;
    this.inspectorService.notifyChange({
      source: this.canvasType,
      eventType: EventType.ShiftForward,
      subIdx,
    });
  }

  isReversible() {
    return this.cmdIdx === 0
      && this.getPathCommand().subPathCommands[this.subIdx].commands.length > 1;
  }

  isShiftable() {
    return this.getPathCommand().subPathCommands[this.subIdx].isClosed;
  }

  isConvertable() {
    // TODO: this API usage is a little bit weird/hacky?
    const canvasType =
      this.canvasType === CanvasType.Start
        ? CanvasType.End
        : CanvasType.Start;
    const vl = this.layerStateService.getVectorLayer(canvasType);
    const pathId = this.layerStateService.getActivePathId(this.canvasType);
    const pathData = (vl.findLayerById(pathId) as PathLayer).pathData;
    if (pathData.subPathCommands.length <= this.subIdx) {
      return false;
    }
    if (pathData.subPathCommands[this.subIdx].commands.length <= this.cmdIdx) {
      return false;
    }
    const drawCmd = pathData.subPathCommands[this.subIdx].commands[this.cmdIdx];
    return this.command.svgChar !== drawCmd.svgChar
      && this.command.canConvertTo(drawCmd.svgChar);
  }

  isSplittable() {
    return this.command.svgChar !== 'M';
  }

  isUnsplittable() {
    return this.command.isSplit;
  }

  // TODO: also add a onConvertHoverEvent?
  onCommandHoverEvent(isHoveringOverCommand: boolean) {
    this.isHoveringOverCommand = isHoveringOverCommand;
    this.broadcastHoverEvent(isHoveringOverCommand, HoverType.Command);
  }

  // TODO: also add a onConvertHoverEvent?
  onUnsplitHoverEvent(isHoveringOverUnsplit: boolean) {
    this.isHoveringOverUnsplit = isHoveringOverUnsplit;
    this.broadcastHoverEvent(isHoveringOverUnsplit, HoverType.Unsplit);
  }

  // TODO: also add a onConvertHoverEvent?
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

  onConvertButtonClick(event) {
    this.onCommandButtonClick(EventType.Convert);
  }

  onSplitButtonClick(event) {
    this.onCommandButtonClick(EventType.Split);
  }

  onUnsplitButtonClick(event) {
    this.onCommandButtonClick(EventType.Unsplit);
  }

  private onCommandButtonClick(eventType: EventType) {
    this.inspectorService.notifyChange({
      source: this.canvasType,
      eventType,
      subIdx: this.subIdx,
      cmdIdx: this.cmdIdx,
    });

    // This ensures that the parent div won't also receive the same click event.
    event.cancelBubble = true;
  }
}
