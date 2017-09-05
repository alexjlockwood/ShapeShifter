import 'rxjs/add/observable/combineLatest';
import 'rxjs/add/operator/distinctUntilChanged';
import 'rxjs/add/operator/map';

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Input,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import { ActionSource } from 'app/model/actionmode';
import { DestroyableMixin } from 'app/scripts/mixins';
import { ThemeService } from 'app/services';
import { State, Store } from 'app/store';
import { getVectorLayer } from 'app/store/layers/selectors';
import * as $ from 'jquery';
import * as _ from 'lodash';
import { Observable } from 'rxjs/Observable';

import { CanvasContainerDirective } from './canvascontainer.directive';
import { CanvasLayersDirective } from './canvaslayers.directive';
import { CanvasOverlayDirective } from './canvasoverlay.directive';
import { CanvasPaperDirective } from './canvaspaper.directive';
import { CanvasRulerDirective } from './canvasruler.directive';
import { CanvasLayoutMixin, Size } from './CanvasLayoutMixin';

// Canvas margin in css pixels.
const CANVAS_MARGIN = 36;

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanvasComponent extends CanvasLayoutMixin(DestroyableMixin())
  implements AfterViewInit {
  @ViewChildren(CanvasContainerDirective) canvasContainer: QueryList<CanvasContainerDirective>;
  @ViewChildren(CanvasLayersDirective) canvasLayers: QueryList<CanvasLayersDirective>;
  @ViewChildren(CanvasOverlayDirective) canvasOverlay: QueryList<CanvasOverlayDirective>;
  @ViewChildren(CanvasPaperDirective) canvasPaper: QueryList<CanvasPaperDirective>;
  @ViewChildren(CanvasRulerDirective) canvasRulers: QueryList<CanvasRulerDirective>;

  @Input() actionSource: ActionSource;
  @Input() canvasBounds$: Observable<Size>;

  private readonly $element: JQuery;

  constructor(
    elementRef: ElementRef,
    private readonly store: Store<State>,
    public readonly themeService: ThemeService,
  ) {
    super();
    this.$element = $(elementRef.nativeElement);
  }

  ngAfterViewInit() {
    const activeViewport$ = this.store
      .select(getVectorLayer)
      .map(vl => ({ w: vl.width, h: vl.height }))
      .distinctUntilChanged(_.isEqual);
    this.registerSubscription(
      Observable.combineLatest(
        this.canvasBounds$,
        activeViewport$,
      ).subscribe(([bounds, viewport]) => {
        const w = Math.max(1, bounds.w - CANVAS_MARGIN * 2);
        const h = Math.max(1, bounds.h - CANVAS_MARGIN * 2);
        this.setDimensions({ w, h }, viewport);
      }),
    );
  }

  // @Override
  onDimensionsChanged(bounds: Size, viewport: Size) {
    const directives = [
      ...this.canvasContainer.toArray(),
      ...this.canvasLayers.toArray(),
      ...this.canvasOverlay.toArray(),
      ...this.canvasPaper.toArray(),
      ...this.canvasRulers.toArray(),
    ];
    directives.forEach(d => d.setDimensions(bounds, viewport));
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent) {
    this.canvasOverlay.forEach(c => c.onMouseDown(event));
    this.showRuler(event);
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    this.canvasOverlay.forEach(c => c.onMouseMove(event));
    this.showRuler(event);
  }

  @HostListener('mouseup', ['$event'])
  onMouseUp(event: MouseEvent) {
    this.canvasOverlay.forEach(c => c.onMouseUp(event));
    this.showRuler(event);
  }

  @HostListener('mouseleave', ['$event'])
  onMouseLeave(event: MouseEvent) {
    this.canvasOverlay.forEach(c => c.onMouseLeave(event));
    this.hideRuler();
  }

  private showRuler(event: MouseEvent) {
    const point = this.eventToPoint(event);
    point.x = Math.round(point.x / Math.max(1, this.attrScale));
    point.y = Math.round(point.y / Math.max(1, this.attrScale));
    this.canvasRulers.forEach(r => r.showMouse(point));
  }

  private hideRuler() {
    this.canvasRulers.forEach(r => r.hideMouse());
  }

  /** Converts mouse event coordinates to canvas-based coordinates. */
  private eventToPoint(event: MouseEvent) {
    const canvasOffset = this.$element.offset();
    const x = (event.pageX - canvasOffset.left) * devicePixelRatio;
    const y = (event.pageY - canvasOffset.top) * devicePixelRatio;
    return { x, y };
  }
}
