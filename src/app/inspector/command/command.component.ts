import * as _ from 'lodash';
import {
  Component, AfterViewInit, OnChanges, Output, OnInit, HostListener,
  SimpleChanges, Input, ViewChild, ElementRef, OnDestroy
} from '@angular/core';
import { DrawCommand, EditorType, PathLayer } from '../../scripts/model';
import * as $ from 'jquery';
import { InspectorService, EventType } from '../inspector.service';
import { LayerStateService } from '../../services/layerstate.service';
import { SelectionService, Selection } from '../../services/selection.service';
import { HoverStateService, HoverType } from '../../services/hoverstate.service';
import { Subscription } from 'rxjs/Subscription';
import { ColorUtil } from '../../scripts/common';

@Component({
  selector: 'app-command',
  templateUrl: './command.component.html',
  styleUrls: ['./command.component.scss']
})
export class CommandComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() editorType: EditorType;
  @Input() pathId: string;
  @Input() subPathIdx: number;
  @Input() drawIdx: number;
  @Input() drawCommand: DrawCommand;
  @ViewChild('drawCommandIndexCanvas') private drawCommandIndexCanvas: ElementRef;

  private isSelected_ = false;
  private isHovering_ = false;
  private isHoveringOverCommand = false;
  private isHoveringOverSplit = false;
  private isHoveringOverUnsplit = false;
  private subscription_: Subscription;
  private selectionArgs_: Selection;

  constructor(
    private layerStateService: LayerStateService,
    private hoverStateService: HoverStateService,
    private selectionService: SelectionService,
    private inspectorService: InspectorService) { }

  ngOnInit() {
    this.selectionArgs_ = {
      pathId: this.pathId,
      subPathIdx: this.subPathIdx,
      drawIdx: this.drawIdx,
    };
    this.subscription_ = this.selectionService.addListener(this.editorType,
      (selections: Selection[]) => {
        this.isSelected = _.some(selections, this.selectionArgs_);
      });
  }

  ngAfterViewInit() {
    this.draw();
  }

  ngOnDestroy() {
    this.subscription_.unsubscribe();
  }

  private draw() {
    const canvas = $(this.drawCommandIndexCanvas.nativeElement);
    const commandIndexCanvasSize = canvas.get(0).getBoundingClientRect().width;
    const width = commandIndexCanvasSize;
    const height = commandIndexCanvasSize;
    const dpi = window.devicePixelRatio || 1;
    canvas
      .attr({ width: width * dpi, height: height * dpi })
      .css({ width, height });

    const ctx: CanvasRenderingContext2D =
      (canvas.get(0) as HTMLCanvasElement).getContext('2d');
    const radius = commandIndexCanvasSize * dpi / 2;

    ctx.save();
    const color = this.drawIdx === 0
      ? ColorUtil.MOVE_POINT_COLOR : this.drawCommand.isSplit
        ? ColorUtil.SPLIT_POINT_COLOR : ColorUtil.NORMAL_POINT_COLOR;
    ctx.beginPath();
    ctx.arc(radius, radius, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = 'white';
    ctx.font = radius + 'px Roboto';
    const text = (this.drawIdx + 1).toString();
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
      const x = _.round(p.x, 3);
      const y = _.round(p.y, 3);
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

  @HostListener('click')
  onCommandClick() {
    // Selecting the last 'Z' command doesn't seem to work...
    this.selectionService.toggleSelection(this.editorType, this.selectionArgs_);
  }

  isConvertable() {
    // TODO: this API usage is a little bit weird/hacky?
    const editorType =
      this.editorType === EditorType.Start
        ? EditorType.End
        : EditorType.Start;
    const vl = this.layerStateService.getData(editorType);
    const pathData = (vl.findLayerById(this.pathId) as PathLayer).pathData;
    if (pathData.subPathCommands.length <= this.subPathIdx) {
      return false;
    }
    if (pathData.subPathCommands[this.subPathIdx].commands.length <= this.drawIdx) {
      return false;
    }
    const drawCmd = pathData.subPathCommands[this.subPathIdx].commands[this.drawIdx];
    return this.drawCommand.canConvertTo(drawCmd.svgChar);
  }

  isSplittable() {
    return this.drawCommand.svgChar !== 'M';
  }

  isUnsplittable() {
    return this.drawCommand.isSplit;
  }

  onCommandHoverEvent(isHoveringOverCommand: boolean) {
    this.isHoveringOverCommand = isHoveringOverCommand;
    this.broadcastHoverEvent(isHoveringOverCommand, HoverType.Command);
  }

  onUnsplitHoverEvent(isHoveringOverUnsplit: boolean) {
    this.isHoveringOverUnsplit = isHoveringOverUnsplit;
    this.broadcastHoverEvent(isHoveringOverUnsplit, HoverType.Unsplit);
  }

  onSplitHoverEvent(isHoveringOverSplit: boolean) {
    this.isHoveringOverSplit = isHoveringOverSplit;
    this.broadcastHoverEvent(isHoveringOverSplit, HoverType.Split);
  }

  private broadcastHoverEvent(isHovering: boolean, hoverType: HoverType) {
    const pathId = this.pathId;
    const subPathIdx = this.subPathIdx;
    const drawIdx = this.drawIdx;
    const commandId = { pathId, subPathIdx, drawIdx };
    const visibleTo =
      hoverType === HoverType.Command
        ? [EditorType.Start, EditorType.End]
        : [this.editorType];
    if (isHovering) {
      this.hoverStateService.setHover({
        type: hoverType,
        commandId: { pathId, subPathIdx, drawIdx },
        source: this.editorType,
        visibleTo,
      });
    } else if (hoverType !== HoverType.Command && this.isHoveringOverCommand) {
      this.hoverStateService.setHover({
        type: HoverType.Command,
        commandId: { pathId, subPathIdx, drawIdx },
        source: this.editorType,
        visibleTo: [EditorType.Start, EditorType.End],
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
      subPathIdx: this.subPathIdx,
      drawIdx: this.drawIdx,
    });

    // This ensures that the parent div won't also receive the same click event.
    event.cancelBubble = true;
  }
}
