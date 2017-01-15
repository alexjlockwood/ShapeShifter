import * as _ from 'lodash';
import {
  Component, AfterViewInit, OnChanges, Output, OnInit,
  SimpleChanges, Input, ViewChild, ElementRef, EventEmitter
} from '@angular/core';
import { IDrawCommand } from './../../scripts/model';
import * as $ from 'jquery';
import { InspectorService, EventType } from '../inspector.service';

@Component({
  selector: 'app-command',
  template: `
  <canvas #drawCommandIndexCanvas
      class="command-index"></canvas>

  <span fxFlex>{{ drawCommandEndPointText }}</span>

  <button md-icon-button
      mdTooltip="Edit point"
      mdTooltipPosition="above"
      md-theme="dark"
      [fxShow]="isEditable()"
      fxLayoutAlign="center center"
      (click)="onEditButtonClick()">
    <md-icon class="md-24">mode_edit</md-icon>
  </button>

  <button md-icon-button
      mdTooltip="Delete point"
      mdTooltipPosition="above"
      md-theme="dark"
      fxLayoutAlign="center center"
      [fxShow]="isDeletable()"
      (click)="onDeleteButtonClick()">
    <md-icon class="md-24">delete</md-icon>
  </button>`,
  styleUrls: ['./command.component.scss']
})
export class CommandComponent implements OnInit, AfterViewInit, OnChanges {
  @ViewChild('drawCommandIndexCanvas') private drawCommandIndexCanvas: ElementRef;
  @Input('pathCommandIndex') pathCommandIndex: number;
  @Input('subPathCommandIndex') subPathCommandIndex: number;
  @Input('drawCommandIndex') drawCommandIndex: number;
  @Input('drawCommand') drawCommand: IDrawCommand;

  constructor(private inspectorService: InspectorService) { }

  ngOnInit() {
    // console.log('ngOnInit()');
  }

  ngAfterViewInit() {
    this.draw();
  }

  // TODO(alockwood): use ngFor trackBy to avoid recreating these items on animation frames
  ngOnChanges(changes: SimpleChanges) {
    this.draw();
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

    const ctx: CanvasRenderingContext2D = (canvas.get(0) as any).getContext('2d');
    const radius = commandIndexCanvasSize * dpi / 2;

    ctx.save();
    const color = 'green';
    ctx.beginPath();
    ctx.arc(radius, radius, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = 'white';
    ctx.font = radius + 'px serif';
    const text = (this.drawCommandIndex + 1).toString();
    const textWidth = ctx.measureText(text).width;
    // TODO(alockwood): is there a better way to get the height?
    const textHeight = ctx.measureText('o').width;
    ctx.fillText(text, radius - textWidth / 2, radius + textHeight / 2);
    ctx.fill();
    ctx.restore();
  }

  get drawCommandEndPointText() {
    const c = this.drawCommand;
    if (c.svgChar.toUpperCase() === 'Z') {
      return `${c.svgChar}`;
    } else {
      const p = _.last(c.points);
      const x = Number(p.x.toFixed(3)).toString();
      const y = Number(p.y.toFixed(3)).toString();
      return `${c.svgChar} ${x}, ${y}`;
    }
  }

  isEditable() {
    // TODO(alockwood): implement this
    return false;
  }

  isDeletable() {
    return this.drawCommand.isSplit;
  }

  onEditButtonClick() {
    this.inspectorService.notifyChange({
      eventType: EventType.Edit,
      pathCommandIndex: this.pathCommandIndex,
      subPathCommandIndex: this.subPathCommandIndex,
      drawCommandIndex: this.drawCommandIndex,
    });
  }

  onDeleteButtonClick() {
    this.inspectorService.notifyChange({
      eventType: EventType.Delete,
      pathCommandIndex: this.pathCommandIndex,
      subPathCommandIndex: this.subPathCommandIndex,
      drawCommandIndex: this.drawCommandIndex,
    });
  }
}
