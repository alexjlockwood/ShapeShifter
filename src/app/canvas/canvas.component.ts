import * as _ from 'lodash';
import * as $ from 'jquery';
import {
  Component, AfterViewInit, ViewChild, ElementRef, HostListener,
  ViewChildren, QueryList, ChangeDetectionStrategy, Input,
} from '@angular/core';
import { CanvasOverlayDirective } from './canvasoverlay.directive';
import { Command } from '../scripts/paths';
import {
  PathLayer, LayerUtil, Layer, VectorLayer,
} from '../scripts/layers';
import { Point, MathUtil } from '../scripts/common';
import { AnimatorService } from '../services';
import {
  Store, State, getCanvasState,
  getActiveViewport, SelectLayer, ClearLayerSelections,
  getShapeShifterStartState,
  getShapeShifterEndState,
} from '../store';
import { CanvasContainerDirective } from './canvascontainer.directive';
import { CanvasRulerDirective } from './canvasruler.directive';
import { CanvasLayersDirective } from './canvaslayers.directive';
import { Observable } from 'rxjs/Observable';
import { CanvasLayoutMixin, Size } from './CanvasLayoutMixin';
import { DestroyableMixin } from '../scripts/mixins';
import { CanvasType } from '../CanvasType';
import 'rxjs/add/observable/combineLatest';

// Canvas margin in css pixels.
const CANVAS_MARGIN = 36;
// The minimum distance between a point and a path that causes a snap.
const MIN_SNAP_THRESHOLD = 12;

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

  @Input() canvasType: CanvasType;
  @Input() canvasBounds$: Observable<Size>;

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
      Observable.combineLatest(this.canvasBounds$, this.store.select(getActiveViewport))
        .map(([bounds, viewport]) => { return { bounds, viewport } })
        .subscribe(({ bounds, viewport }) => {
          const w = Math.max(1, bounds.w - CANVAS_MARGIN * 2);
          const h = Math.max(1, bounds.h - CANVAS_MARGIN * 2);
          this.setDimensions({ w, h }, viewport);
        }));
    if (this.canvasType === CanvasType.Preview) {
      this.registerSubscription(
        this.store.select(getCanvasState)
          .subscribe(({ activeVectorLayer, hiddenLayerIds, selectedLayerIds }) => {
            this.vectorLayer = activeVectorLayer;
            this.canvasLayers.setState(activeVectorLayer, hiddenLayerIds);
            this.canvasLayers.draw();
            this.canvasOverlay.setState(activeVectorLayer, hiddenLayerIds, selectedLayerIds);
            this.canvasOverlay.draw();
          }));
      this.registerSubscription(
        this.animatorService.asObservable()
          .map(event => event.vl)
          .filter(vl => !!vl)
          .subscribe(vl => {
            this.vectorLayer = vl;
            this.canvasLayers.setState(vl);
            this.canvasLayers.draw();
          }));
    } else {
      const shapeShifterSelector =
        this.canvasType === CanvasType.Start
          ? getShapeShifterStartState
          : getShapeShifterEndState;
      this.registerSubscription(
        this.store.select(shapeShifterSelector)
          .subscribe(vl => {
            this.vectorLayer = vl;
            this.canvasLayers.setState(vl);
            this.canvasLayers.draw();
          }),
      );
    }
  }

  // @Override
  protected onDimensionsChanged(bounds: Size, viewport: Size) {
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

    const hitLayer = this.hitTestForLayer(this.mouseEventToViewportCoords(event));
    const isMetaOrShiftPressed = event.metaKey || event.shiftKey;
    if (hitLayer) {
      const shouldToggle = true;
      this.store.dispatch(new SelectLayer(hitLayer.id, shouldToggle, !isMetaOrShiftPressed));
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
    this.hideRuler();
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

  private showRuler(event: MouseEvent) {
    const canvasOffset = this.$element.offset();
    const x = (event.pageX - canvasOffset.left) / Math.max(1, this.cssScale);
    const y = (event.pageY - canvasOffset.top) / Math.max(1, this.cssScale);
    this.canvasRulers.forEach(r => r.showMouse(new Point(_.round(x), _.round(y))));
  }

  private hideRuler() {
    this.canvasRulers.forEach(r => r.hideMouse());
  }
}
