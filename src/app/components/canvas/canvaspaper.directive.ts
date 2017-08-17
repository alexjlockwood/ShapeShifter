import 'rxjs/add/observable/combineLatest';
import 'rxjs/add/observable/merge';

import { AfterViewInit, Directive, ElementRef, HostListener, Input } from '@angular/core';
import { ActionSource } from 'app/model/actionmode';
import * as $ from 'jquery';
import * as paper from 'paper';
import { Path, Point, Segment, Tool } from 'paper';
import { Observable } from 'rxjs/Observable';

import { CanvasLayoutMixin } from './CanvasLayoutMixin';

type Context = CanvasRenderingContext2D;

@Directive({ selector: '[appCanvasPaper]' })
export class CanvasPaperDirective extends CanvasLayoutMixin() implements AfterViewInit {
  @Input() actionSource: ActionSource;

  private readonly $canvas: JQuery<HTMLCanvasElement>;
  private isDragging = false;

  constructor(elementRef: ElementRef) {
    super();
    this.$canvas = $(elementRef.nativeElement) as JQuery<HTMLCanvasElement>;
  }

  ngAfterViewInit() {
    paper.setup(this.$canvas.get(0));
  }

  // @Override
  onDimensionsChanged() {
    const { w, h } = this.getViewport();
    this.$canvas.attr({ width: w * this.attrScale, height: h * this.attrScale });
    this.$canvas.css({ width: w * this.cssScale, height: h * this.cssScale });
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent) {
    event.stopPropagation();
    console.log(new Point(event.x, event.y), new Point(event.clientX, event.clientY));
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    event.stopPropagation();
    console.log(new Point(event.x, event.y), new Point(event.clientX, event.clientY));
  }

  @HostListener('mouseup', ['$event'])
  onMouseUp(event: MouseEvent) {
    event.stopPropagation();
    console.log(new Point(event.x, event.y), new Point(event.clientX, event.clientY));
  }
}
