import * as _ from 'lodash';
import {
  Component, AfterViewInit, OnChanges, Output, OnInit, HostListener,
  SimpleChanges, Input, ViewChild, ElementRef, OnDestroy
} from '@angular/core';
import { DrawCommand, EditorType } from '../../scripts/model';
import * as $ from 'jquery';
import { InspectorService, EventType } from '../inspector.service';
import { SelectionService, Selection } from '../../services/selection.service';
import { Subscription } from 'rxjs/Subscription';

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

  private isCommandSelected_ = false;
  private subscription_: Subscription;
  private selectionArgs_: Selection;

  constructor(
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
        this.isCommandSelected = _.some(selections, this.selectionArgs_);
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
    const color = this.drawIdx === 0 ? 'blue' : this.drawCommand.isSplit ? 'purple' : 'green';
    ctx.beginPath();
    ctx.arc(radius, radius, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = 'white';
    ctx.font = radius + 'px serif';
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

  get isCommandSelected() {
    return this.isCommandSelected_;
  }

  set isCommandSelected(isCommandSelected: boolean) {
    this.isCommandSelected_ = isCommandSelected;
  }

  @HostListener('click') onCommandClick() {
    this.selectionService.toggleSelection(this.editorType, this.selectionArgs_);
  }

  isEditable() {
    // TODO(alockwood): implement this
    return false;
  }

  isDeletable() {
    return this.drawCommand.isSplit;
  }

  onEditButtonClick(event) {
    // TODO(alockwood): implement this
  }

  onDeleteButtonClick(event) {
    this.inspectorService.notifyChange(EventType.Delete, {
      pathId: this.pathId,
      subPathIdx: this.subPathIdx,
      drawIdx: this.drawIdx,
    });

    // This ensures that the parent div won't also receive the same click event.
    event.cancelBubble = true;
  }
}
