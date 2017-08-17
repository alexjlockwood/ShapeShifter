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
  private isDrawing = false;
  private path: Path;
  private segment: Segment;
  private lastPoint: Point;

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

  // Called by the CanvasComponent.
  onMouseDown(p: { readonly x: number; readonly y: number }) {
    this.lastPoint = new Point(p);
    this.segment = undefined;
    const hitResult = paper.project.hitTest(this.lastPoint, {
      segments: true,
      stroke: true,
      fill: true,
      tolerance: 5,
    });
    if (hitResult) {
      this.isDragging = true;
      this.isDrawing = false;
      this.path = hitResult.item as Path;
      if (hitResult.type === 'segment') {
        this.segment = hitResult.segment;
      } else if (hitResult.type === 'stroke') {
        const location = hitResult.location;
        this.segment = this.path.insert(location.index + 1, this.lastPoint);
        this.path.smooth();
      }
      if (hitResult.type === 'fill') {
        paper.project.activeLayer.addChild(hitResult.item);
      }
    } else {
      this.isDragging = false;
      this.isDrawing = true;
      if (this.path) {
        this.path.selected = false;
      }
      this.path = new Path({
        segments: [this.lastPoint],
        strokeColor: 'black',
        fillColor: 'black',
        fullySelected: true,
      });
    }
  }

  // Called by the CanvasComponent.
  onMouseMove(p: { readonly x: number; readonly y: number }) {
    const point = new Point(p);
    const delta = point.subtract(this.lastPoint);
    if (this.isDragging) {
      if (this.segment) {
        this.segment.point = this.segment.point.add(delta);
        this.path.smooth();
      } else if (this.path) {
        this.path.position = this.path.position.add(delta);
      }
    } else if (this.isDrawing) {
      this.path.add(point);
    }
    this.lastPoint = point;
  }

  // Called by the CanvasComponent.
  onMouseUp(point: { readonly x: number; readonly y: number }) {
    this.isDragging = false;
    this.isDrawing = false;
    this.lastPoint = undefined;
    this.path.simplify(10);
    this.path.fullySelected = true;
    this.path.closed = true;
  }

  // Called by the CanvasComponent.
  onMouseLeave(point: { readonly x: number; readonly y: number }) {}
}
