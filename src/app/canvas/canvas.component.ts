import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import * as svgloader from './../scripts/svgloader';
import * as ColorUtil from './../scripts/colorutil';
import * as BezierUtils from 'bezier-js';

@Component({
  selector: 'app-canvas',
  template: `
    <div style="display: flex;" fxLayout="column" fxLayoutAlign="center center">
      <div fxLayout="row" fxLayoutAlign="center center" class="canvas-container">
        <!-- <app-ruler class="canvas-ruler orientation-horizontal"></app-ruler>
        <app-ruler class="canvas-ruler orientation-vertical"></app-ruler> -->
        <canvas #canvas class="rendering-canvas" width="600" height="600">
        </canvas>
      </div>
    </div>`,
  styleUrls: ['./canvas.component.scss']
})
export class CanvasComponent implements OnInit {
  @ViewChild('canvas') canvasRef: ElementRef;
  private canvas: any;

  constructor() { }

  ngOnInit() {
    this.canvas = this.canvasRef.nativeElement;
    // this.canvas.width = this.width;
    // this.canvas.height = this.height;
    this.draw();

    console.log(ColorUtil.parseAndroidColor('#ff000000'));
    console.log(BezierUtils);
    console.log(new BezierUtils.Bezier(0, 0, 0, 0, 0, 0));

    let svgString = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24">
  <g transform="scale(0.5,0.5) rotate(90, 12, 12) translate(0,0)">
    <path d="M 0 0 C 9.6 0 4.8 24 24 24" fill="none" stroke="#000" stroke-width="1" />
  </g>
  <path d="M 12 12 L 17 12 L 17 16 L 12 16 L 12,12" fill="red" />
  <circle cx="4" cy="12" r="2" fill="blue"/>
</svg>`
    //console.log(svgloader.loadVectorLayerFromSvgString(svgString));
  }

  draw() {
    const ctx = this.canvas.getContext('2d');
    ctx.fillStyle = 'blue';
    ctx.fillRect(10, 10, 100, 100);
  }
}
