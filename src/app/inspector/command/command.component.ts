import { Component, AfterViewInit, OnChanges, SimpleChanges, Input, ViewChild, ElementRef } from '@angular/core';
import { DrawCommand, ClosePathCommand } from './../../scripts/svgcommands';
import { StateService, VectorLayerType } from './../../state.service';
import * as $ from 'jquery';

@Component({
  selector: 'app-command',
  templateUrl: './command.component.html',
  styleUrls: ['./command.component.scss']
})
export class CommandComponent implements AfterViewInit, OnChanges {
  @ViewChild('commandIndexCanvas') private commandIndexCanvas: ElementRef;
  @Input() vectorLayerType: VectorLayerType;
  @Input() commandIndex: number;
  @Input() drawCommand: DrawCommand;
  isItemEditable: boolean = false;

  constructor() { }

  ngAfterViewInit() {
    this.drawCommandIndex();
  }

  // TODO(alockwood): use ngFor trackBy to avoid recreating these items on animation frames
  ngOnChanges(changes: SimpleChanges) {
    this.drawCommandIndex();
  }

  private drawCommandIndex() {
    this.isItemEditable = this.drawCommand.isModifiable;

    const canvas = $(this.commandIndexCanvas.nativeElement);
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
    const text = (this.commandIndex + 1).toString();
    const textWidth = ctx.measureText(text).width;
    // TODO(alockwood): is there a better way to get the height?
    const textHeight = ctx.measureText('o').width;
    ctx.fillText(text, radius - textWidth / 2, radius + textHeight / 2);
    ctx.fill();
    ctx.restore();
  }

  get drawCommandEndPointText() {
    const c = this.drawCommand;
    if (c instanceof ClosePathCommand) {
      return `${c.svgChar}`;
    } else {
      const p = c.points[c.points.length - 1];
      const x = Number(p.x.toFixed(3)).toString();
      const y = Number(p.y.toFixed(3)).toString();
      return `${c.svgChar} ${x}, ${y}`;
    }
  }

  onEditPointClick() {
    console.log('edit point click');
  }

  onDeletePointClick() {
    console.log('delete point click');
  }
}
