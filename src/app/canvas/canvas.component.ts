import * as _ from 'lodash';
import * as $ from 'jquery';
import {
  Component, AfterViewInit, ViewChild, ElementRef, HostListener,
  ViewChildren, QueryList, ChangeDetectionStrategy, Input,
} from '@angular/core';
import { CanvasOverlayDirective } from './canvasoverlay.directive';
import { Command } from '../scripts/paths';
import {
  PathLayer, ClipPathLayer, LayerUtil, Layer, VectorLayer,
} from '../scripts/layers';
import { Point, Matrix, ColorUtil, MathUtil } from '../scripts/common';
import { AnimatorService } from '../services';
import {
  Store, State, getCanvasState,
  getActiveViewport, SelectLayer, ClearLayerSelections
} from '../store';
import { CanvasContainerDirective } from './canvascontainer.directive';
import { CanvasRulerDirective } from './canvasruler.directive';
import { CanvasLayersDirective } from './canvaslayers.directive';
import { Observable } from 'rxjs/Observable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { CanvasLayoutMixin, Size } from './CanvasLayoutMixin';
import { DestroyableMixin } from '../scripts/mixins';
import 'rxjs/add/observable/combineLatest';

// Canvas margin in css pixels.
const CANVAS_MARGIN = 36;
// The minimum distance between a point and a path that causes a snap.
const MIN_SNAP_THRESHOLD = 12;

type Context = CanvasRenderingContext2D;

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanvasComponent
  extends CanvasLayoutMixin(DestroyableMixin())
  implements AfterViewInit {

  @ViewChild(CanvasContainerDirective) canvasContainer: CanvasContainerDirective;
  @ViewChild(CanvasLayersDirective) canvasLayers: CanvasLayersDirective;
  @ViewChild(CanvasOverlayDirective) canvasOverlay: CanvasOverlayDirective;
  @ViewChildren(CanvasRulerDirective) canvasRulers: QueryList<CanvasRulerDirective>;

  @Input() boundsObservable: Observable<Size>;

  private readonly $element: JQuery;
  private vectorLayer: VectorLayer;

  constructor(
    readonly elementRef: ElementRef,
    private readonly animatorService: AnimatorService,
    private readonly store: Store<State>,
  ) {
    super();
    this.$element = $(elementRef.nativeElement);
  }

  private get minSnapThreshold() {
    return MIN_SNAP_THRESHOLD / this.cssScale;
  }

  ngAfterViewInit() {
    this.registerSubscription(
      Observable.combineLatest(this.boundsObservable, this.store.select(getActiveViewport))
        .map(([bounds, viewport]) => { return { bounds, viewport } })
        .subscribe(({ bounds, viewport }) => {
          const w = Math.max(1, bounds.w - CANVAS_MARGIN * 2);
          const h = Math.max(1, bounds.h - CANVAS_MARGIN * 2);
          this.setDimensions({ w, h }, viewport);
        }));
    this.registerSubscription(
      this.store.select(getCanvasState)
        .subscribe(({ activeVectorLayer, hiddenLayerIds, selectedLayerIds }) => {
          this.vectorLayer = activeVectorLayer;
          this.canvasLayers.setLayerState(activeVectorLayer, hiddenLayerIds);
          this.canvasOverlay.setLayerState(activeVectorLayer, hiddenLayerIds, selectedLayerIds);
        }));
    this.registerSubscription(
      this.animatorService.asObservable()
        .filter(event => !!event.vl)
        .subscribe(event => {
          this.vectorLayer = event.vl;
          this.canvasLayers.setVectorLayer(event.vl);
        }));
  }

  // @Override
  onDimensionsChanged(bounds: Size, viewport: Size) {
    const directives = [
      this.canvasContainer,
      this.canvasLayers,
      this.canvasOverlay,
      ...this.canvasRulers.toArray(),
    ];
    directives.forEach(d => d.setDimensions(bounds, viewport));
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent) {
    this.showRuler(event);

    const hitPathLayer = this.hitTestForLayer(this.mouseEventToViewportCoords(event));
    const isMetaOrShiftPressed = event.metaKey || event.shiftKey;
    if (hitPathLayer) {
      const shouldToggle = true;
      this.store.dispatch(
        new SelectLayer(hitPathLayer.id, shouldToggle, !isMetaOrShiftPressed));
    } else if (!isMetaOrShiftPressed) {
      this.store.dispatch(new ClearLayerSelections());
    }
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    this.showRuler(event);
  }

  @HostListener('mouseup', ['$event'])
  onMouseUp(event: MouseEvent) {
    this.showRuler(event);
  }

  @HostListener('mouseleave', ['$event'])
  onMouseLeave(event: MouseEvent) {
    this.canvasRulers.forEach(r => r.hideMouse());
  }

  private showRuler(event: MouseEvent) {
    const canvasOffset = this.$element.offset();
    const x = (event.pageX - canvasOffset.left) / Math.max(1, this.cssScale);
    const y = (event.pageY - canvasOffset.top) / Math.max(1, this.cssScale);
    this.canvasRulers.forEach(r => r.showMouse(new Point(_.round(x), _.round(y))));
  }

  private mouseEventToViewportCoords(event: MouseEvent) {
    const canvasOffset = this.$element.offset();
    const x = (event.pageX - canvasOffset.left) / this.cssScale;
    const y = (event.pageY - canvasOffset.top) / this.cssScale;
    return new Point(x, y);
  }

  private hitTestForLayer(point: Point) {
    const root = this.vectorLayer;
    const recurseFn = (layer: Layer): Layer => {
      if (layer instanceof PathLayer && layer.pathData) {
        const transformedPoint =
          MathUtil.transformPoint(
            point, LayerUtil.getFlattenedTransformForLayer(root, layer.id).invert());
        let isSegmentInRangeFn: (distance: number, cmd: Command) => boolean;
        isSegmentInRangeFn = distance => {
          let maxDistance = this.minSnapThreshold;
          if (layer.isStroked()) {
            maxDistance = Math.max(maxDistance, layer.strokeWidth / 2);
          }
          return distance <= maxDistance;
        };
        const findShapesInRange = layer.isFilled();
        const hitResult = layer.pathData.hitTest(
          transformedPoint, {
            isSegmentInRangeFn,
            findShapesInRange,
          });
        return hitResult.isHit ? layer : undefined;
      }
      // Use 'hitTestLayer || h' and not the other way around because of reverse z-order.
      return layer.children.reduce((h, l) => recurseFn(l) || h, undefined);
    };
    return recurseFn(root) as PathLayer;
  }
}
