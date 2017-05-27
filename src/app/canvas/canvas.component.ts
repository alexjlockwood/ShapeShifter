import * as _ from 'lodash';
import * as $ from 'jquery';
import {
  Component,
  AfterViewInit,
  ViewChild,
  ElementRef,
  HostListener,
  ViewChildren,
  QueryList,
  ChangeDetectionStrategy,
  Input,
} from '@angular/core';
import { CanvasOverlayDirective } from './canvasoverlay.directive';
import { Point } from '../scripts/common';
import { Store, State, getActiveVectorLayer } from '../store';
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

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanvasComponent
  extends CanvasLayoutMixin(DestroyableMixin())
  implements AfterViewInit {

  readonly CANVAS_TYPE_START = CanvasType.Start;
  readonly CANVAS_TYPE_PREVIEW = CanvasType.Preview;
  readonly CANVAS_TYPE_END = CanvasType.End;

  @ViewChild(CanvasContainerDirective) canvasContainer: CanvasContainerDirective;
  @ViewChild(CanvasLayersDirective) canvasLayers: CanvasLayersDirective;
  @ViewChild(CanvasOverlayDirective) canvasOverlay: CanvasOverlayDirective;
  @ViewChildren(CanvasRulerDirective) canvasRulers: QueryList<CanvasRulerDirective>;

  @Input() canvasType: CanvasType;
  @Input() canvasBounds$: Observable<Size>;

  private readonly $element: JQuery;

  constructor(
    readonly elementRef: ElementRef,
    private readonly store: Store<State>,
  ) {
    super();
    this.$element = $(elementRef.nativeElement);
  }

  ngAfterViewInit() {
    const activeViewport$ =
      this.store.select(getActiveVectorLayer)
        .map(vl => { return { w: vl.width, h: vl.height } })
        .distinctUntilChanged((x, y) => _.isEqual(x, y));
    this.registerSubscription(
      Observable.combineLatest(this.canvasBounds$, activeViewport$)
        .map(([bounds, viewport]) => { return { bounds, viewport } })
        .subscribe(({ bounds, viewport }) => {
          const w = Math.max(1, bounds.w - CANVAS_MARGIN * 2);
          const h = Math.max(1, bounds.h - CANVAS_MARGIN * 2);
          this.setDimensions({ w, h }, viewport);
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
