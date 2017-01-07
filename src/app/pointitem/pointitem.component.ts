import { Component, AfterViewInit, Input, ViewChild, ElementRef } from '@angular/core';
import * as $ from 'jquery';

@Component({
  selector: 'app-pointitem',
  templateUrl: './pointitem.component.html',
  styleUrls: ['./pointitem.component.scss']
})
export class PointItemComponent implements AfterViewInit {
  @ViewChild('commandIndexCanvas') private commandIndexCanvas: ElementRef;
  @Input() commandIndex: number;
  @Input() commandString: string;
  isItemEditable: boolean = true;

  constructor() { }

  ngAfterViewInit() {
    // TODO(alockwood): use ngFor trackBy to avoid recreating these items on animation frames
    this.drawCommandIndex();
  }

  private drawCommandIndex() {
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
    ctx.fillStyle = "white";
    ctx.font = commandIndexCanvasSize + 'px serif';
    const text = (this.commandIndex + 1).toString();
    const textWidth = ctx.measureText(text).width;
    // TODO(alockwood): is there a better way to get the height?
    const textHeight = ctx.measureText('o').width;
    ctx.fillText(text, radius - textWidth / 2, radius + textHeight / 2);
    ctx.fill();
    ctx.restore();
  }

  onEditPointClick() {

  }

  onDeletePointClick() {

  }
}
