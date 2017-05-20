import * as _ from 'lodash';
import * as $ from 'jquery';
import {
  Component, AfterViewInit, OnDestroy, ElementRef, ViewChild,
  ViewChildren, QueryList, ChangeDetectionStrategy, Input,
} from '@angular/core';
import { CanvasOverlayDirective } from './canvasoverlay.directive';
import { Command } from '../scripts/paths';
import { PathLayer, ClipPathLayer, LayerUtil, VectorLayer } from '../scripts/layers';
import { Point, Matrix, ColorUtil } from '../scripts/common';
import { AnimatorService } from '../services';
import { Store, State, getLayerState } from '../store';
import * as CanvasConstants from './constants';
import { CanvasRulerDirective } from './canvasruler.directive';
import { CanvasLayersDirective } from './canvaslayers.directive';
import { Observable } from 'rxjs/Observable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { CanvasMixin } from './CanvasMixin';
import { DestroyableMixin } from '../scripts/mixins';
import 'rxjs/add/observable/combineLatest';

type Context = CanvasRenderingContext2D;

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanvasComponent
  extends CanvasMixin(DestroyableMixin(class { }))
  implements AfterViewInit {

  @ViewChild('canvasContainer') canvasContainerRef: ElementRef;
  @ViewChild(CanvasLayersDirective) canvasLayers: CanvasLayersDirective;
  @ViewChild(CanvasOverlayDirective) canvasOverlay: CanvasOverlayDirective;
  @ViewChildren(CanvasRulerDirective) canvasRulers: QueryList<CanvasRulerDirective>;
  @Input() sizeObservable: Observable<{ w: number, h: number }>;

  private $canvasContainer: JQuery;

  constructor(
    private readonly animatorService: AnimatorService,
    private readonly store: Store<State>,
  ) { super(); }

  ngAfterViewInit() {
    const directives: CanvasDirective[] = [this.canvasLayers, this.canvasOverlay];
    this.canvasRulers.forEach(r => directives.push(r));
    this.registerDirectives(directives);

    this.$canvasContainer = $(this.canvasContainerRef.nativeElement);
    this.registerSubscription(
      this.store.select(getLayerState)
        .subscribe(({ vectorLayers, hiddenLayerIds }) => {
          this.setVectorLayer(vectorLayers[0]);
          this.canvasLayers.setHiddenLayerIds(hiddenLayerIds);
          this.draw();
        }));
    this.registerSubscription(
      this.sizeObservable
        .subscribe(({ w, h }) => {
          this.setDimensions(w, h);
          this.draw();
        }));
    this.registerSubscription(
      this.animatorService.asObservable().subscribe(event => {
        if (!event.vl) {
          // TODO: don't let this case happen
          return;
        }
        // TODO: how to deal with multiple vector layers?
        this.setVectorLayer(event.vl);
        this.draw();
      }));
  }

  /**
   * Redraws all content.
   */
  draw() {
    this.resizeCanvases(this.$canvasContainer);
    super.draw();
  }

  // MOUSE DOWN
  onMouseDown(event: MouseEvent) {
    this.showRuler(event);
  }

  // MOUSE MOVE
  onMouseMove(event: MouseEvent) {
    this.showRuler(event);
  }

  // MOUSE UP
  onMouseUp(event: MouseEvent) {
    this.showRuler(event);
  }

  // MOUSE LEAVE
  onMouseLeave() {
    this.canvasRulers.forEach(r => r.hideMouse());
  }

  onClick(event: MouseEvent) {
    // TODO: re-enable click canvas to import file?

    // TODO: is this hacky? should we be using onBlur() to reset the app mode?
    // This ensures that parents won't also receive the same click event.
    event.cancelBubble = true;
  }

  /**
   * Converts a mouse point's CSS coordinates into vector layer viewport coordinates.
   */
  // private mouseEventToPoint(event: MouseEvent) {
  //   const canvasOffset = this.canvasContainer.offset();
  //   const x = (event.pageX - canvasOffset.left) / this.cssScale;
  //   const y = (event.pageY - canvasOffset.top) / this.cssScale;
  //   return new Point(x, y);
  // }

  // private executeHighlights(ctx: Context, color: string, lineWidth: number) {
  //   ctx.save();
  //   ctx.lineCap = 'round';
  //   ctx.strokeStyle = color;
  //   ctx.lineWidth = lineWidth;
  //   ctx.stroke();
  //   ctx.restore();
  // }

  // Draws a labeled point with optional text.
  // private executeLabeledPoint(
  //   ctx: Context,
  //   point: Point,
  //   radius: number,
  //   color: string,
  //   text?: string) {

  //   // Convert the point and the radius to physical pixel coordinates.
  //   // We do this to avoid fractional font sizes less than 1px, which
  //   // show up OK on Chrome but not on Firefox or Safari.
  //   point = MathUtil.transformPoint(
  //     point, Matrix.fromScaling(this.attrScale, this.attrScale));
  //   radius *= this.attrScale;

  //   ctx.save();
  //   ctx.beginPath();
  //   ctx.arc(point.x, point.y, radius * POINT_BORDER_FACTOR, 0, 2 * Math.PI, false);
  //   ctx.fillStyle = POINT_BORDER_COLOR;
  //   ctx.fill();

  //   ctx.beginPath();
  //   ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI, false);
  //   ctx.fillStyle = color;
  //   ctx.fill();

  //   if (text) {
  //     ctx.beginPath();
  //     ctx.fillStyle = POINT_TEXT_COLOR;
  //     ctx.font = radius + 'px Roboto, Helvetica Neue, sans-serif';
  //     const width = ctx.measureText(text).width;
  //     // TODO: is there a better way to get the height?
  //     const height = ctx.measureText('o').width;
  //     ctx.fillText(text, point.x - width / 2, point.y + height / 2);
  //     ctx.fill();
  //   }
  //   ctx.restore();
  // }

  /**
   * Sends a signal that the canvas rulers should be redrawn.
   */
  private showRuler(event: MouseEvent) {
    const canvasOffset = this.$canvasContainer.offset();
    const x = (event.pageX - canvasOffset.left) / Math.max(1, this.cssScale);
    const y = (event.pageY - canvasOffset.top) / Math.max(1, this.cssScale);
    this.canvasRulers.forEach(r => r.showMouse(new Point(_.round(x), _.round(y))));
  }
}

// Takes a path point and transforms it so that its coordinates are in terms
// of the VectorLayer's viewport coordinates.
// function applyGroupTransforms(mousePoint: Point, transforms: Matrix[]) {
//   return MathUtil.transformPoint(
//     mousePoint,
//     Matrix.flatten(...transforms.slice().reverse()));
// }

interface Size {
  readonly w: number;
  readonly h: number;
}

export interface CanvasDirective {
  setDimensions(w: number, h: number);
  setVectorLayer(vl: VectorLayer);
  setHiddenLayerIds(layerIds: Set<string>);
  draw();
}
