import * as _ from 'lodash';
import {
  Component, AfterViewInit, OnChanges, Output, OnInit, HostListener,
  SimpleChanges, Input, ViewChild, ElementRef, OnDestroy
} from '@angular/core';
import { Command } from '../../scripts/commands';
import { PathLayer } from '../../scripts/layers';
import * as $ from 'jquery';
import { InspectorService, EventType } from '../inspector.service';
import { LayerStateService } from '../../services/layerstate.service';
import { SelectionStateService, Selection } from '../../services/selectionstate.service';
import { HoverStateService, Type as HoverType } from '../../services/hoverstate.service';
import { Subscription } from 'rxjs/Subscription';
import { ColorUtil } from '../../scripts/common';
import { EditorType } from '../../EditorType';

@Component({
  selector: 'app-command',
  templateUrl: './command.component.html',
  styleUrls: ['./command.component.scss']
})
export class CommandComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() editorType: EditorType;
  @Input() pathId: string;
  @Input() subIdx: number;
  private cmdIdx_: number;
  private drawCommand_: Command;
  @ViewChild('drawCommandIndexCanvas') private drawCommandIndexCanvas: ElementRef;

  private isSelected_ = false;
  private isHovering_ = false;
  private isHoveringOverCommand = false;
  private isHoveringOverSplit = false;
  private isHoveringOverUnsplit = false;
  private subscriptions: Subscription[] = [];
  private isViewInit = false;
  private canvas;
  private commandIndexCanvasSize: number;
  private dpi: number;

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
            source: this.editorType,
            commandId: {
              pathId: this.pathId,
              subIdx: this.subIdx,
              cmdIdx: this.cmdIdx,
            }
          });
        }));
  }

  ngAfterViewInit() {
    this.isViewInit = true;

    this.canvas = $(this.drawCommandIndexCanvas.nativeElement);
    this.commandIndexCanvasSize = this.canvas.get(0).getBoundingClientRect().width;
    const width = this.commandIndexCanvasSize;
    const height = this.commandIndexCanvasSize;
    this.dpi = window.devicePixelRatio || 1;
    this.canvas
      .attr({ width: width * this.dpi, height: height * this.dpi })
      .css({ width, height });

    this.draw();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  @Input()
  set cmdIdx(cmdIdx: number) {
    if (this.cmdIdx_ !== cmdIdx) {
      this.cmdIdx_ = cmdIdx;
      this.draw();
    }
  }

  get cmdIdx() {
    return this.cmdIdx_;
  }

  @Input()
  set drawCommand(drawCommand: Command) {
    this.drawCommand_ = drawCommand;
    this.draw();
  }

  get drawCommand() {
    return this.drawCommand_;
  }

  private draw() {
    if (!this.isViewInit) {
      return;
    }

    const ctx: CanvasRenderingContext2D =
      (this.canvas.get(0) as HTMLCanvasElement).getContext('2d');
    const radius = this.commandIndexCanvasSize * this.dpi / 2;

    ctx.save();
    const color = this.cmdIdx === 0
      ? ColorUtil.MOVE_POINT_COLOR : this.drawCommand.isSplit
        ? ColorUtil.SPLIT_POINT_COLOR : ColorUtil.NORMAL_POINT_COLOR;
    ctx.beginPath();
    ctx.arc(radius, radius, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = 'white';
    ctx.font = radius + 'px Roboto';
    const text = (this.cmdIdx + 1).toString();
    const textWidth = ctx.measureText(text).width;
    // TODO: is there a better way to get the height?
    const textHeight = ctx.measureText('o').width;
    ctx.fillText(text, radius - textWidth / 2, radius + textHeight / 2);
    ctx.fill();
    ctx.restore();
  }

  get drawCommandEndPointText() {
    const c = this.drawCommand;
    if (c.svgChar === 'Z') {
      return `${c.svgChar}`;
    } else {
      const p = _.last(c.points);
      const x = _.round(p.x, 2);
      const y = _.round(p.y, 2);
      return `${c.svgChar} ${x}, ${y}`;
    }
  }

  get isHovering() {
    return this.isHovering_;
  }

  set isHovering(isHovering: boolean) {
    this.isHovering_ = isHovering;
  }

  get isSelected() {
    return this.isSelected_;
  }

  set isSelected(isSelected: boolean) {
    this.isSelected_ = isSelected;
  }

  onCommandClick(event: MouseEvent) {
    const selections = this.selectionStateService.getSelections();
    const appendToList = event.shiftKey || event.metaKey;
    if (selections.length && selections[0].source !== this.editorType && appendToList) {
      // If the user is attempting to select something in a different pane in the
      // middle of a multi-select, do nothing.
      return;
    }

    // Selecting the last 'Z' command doesn't seem to work...
    this.selectionStateService.toggle({
      source: this.editorType,
      commandId: {
        pathId: this.pathId,
        subIdx: this.subIdx,
        cmdIdx: this.cmdIdx,
      }
    }, appendToList);
  }

  isConvertable() {
    // TODO: this API usage is a little bit weird/hacky?
    const editorType =
      this.editorType === EditorType.Start
        ? EditorType.End
        : EditorType.Start;
    const vl = this.layerStateService.getLayer(editorType);
    const pathData = (vl.findLayerById(this.pathId) as PathLayer).pathData;
    if (pathData.subPathCommands.length <= this.subIdx) {
      return false;
    }
    if (pathData.subPathCommands[this.subIdx].commands.length <= this.cmdIdx) {
      return false;
    }
    const drawCmd = pathData.subPathCommands[this.subIdx].commands[this.cmdIdx];
    return this.drawCommand.svgChar !== drawCmd.svgChar
      && this.drawCommand.canConvertTo(drawCmd.svgChar);
  }

  isSplittable() {
    return this.drawCommand.svgChar !== 'M';
  }

  isUnsplittable() {
    return this.drawCommand.isSplit;
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
    const pathId = this.pathId;
    const subIdx = this.subIdx;
    const cmdIdx = this.cmdIdx;
    const commandId = { pathId, subIdx, cmdIdx };
    if (isHovering) {
      this.hoverStateService.setHover({
        type: hoverType,
        commandId: { pathId, subIdx, cmdIdx },
        source: this.editorType,
      });
    } else if (hoverType !== HoverType.Command && this.isHoveringOverCommand) {
      this.hoverStateService.setHover({
        type: HoverType.Command,
        commandId: { pathId, subIdx, cmdIdx },
        source: this.editorType,
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
    this.inspectorService.notifyChange(eventType, {
      pathId: this.pathId,
      subIdx: this.subIdx,
      cmdIdx: this.cmdIdx,
    });

    // This ensures that the parent div won't also receive the same click event.
    event.cancelBubble = true;
  }
}
