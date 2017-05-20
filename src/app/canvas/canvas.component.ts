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
  extends CanvasMixin(DestroyableMixin())
  implements AfterViewInit {

  @ViewChild('canvasContainer') canvasContainerRef: ElementRef;
  private $canvasContainer: JQuery;

  @ViewChild(CanvasLayersDirective) canvasLayers: CanvasLayersDirective;
  @ViewChild(CanvasOverlayDirective) canvasOverlay: CanvasOverlayDirective;
  @ViewChildren(CanvasRulerDirective) canvasRulers: QueryList<CanvasRulerDirective>;

  @Input() sizeObservable: Observable<{ w: number, h: number }>;

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
          this.resizeCanvases(this.$canvasContainer);
          this.draw();
        }));
    this.registerSubscription(
      this.sizeObservable
        .subscribe(({ w, h }) => {
          this.setDimensions(w, h);
          this.resizeCanvases(this.$canvasContainer);
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
