import * as $ from 'jquery';
import { Directive, Input, ElementRef, AfterViewInit } from '@angular/core';
import { CanvasSizeMixin, Size } from './CanvasSizeMixin';
import { Observable } from 'rxjs/Observable';
import { DestroyableMixin } from '../scripts/mixins';

@Directive({
  selector: '[appCanvasContainer]',
})
export class CanvasContainerDirective extends CanvasSizeMixin() {

  readonly container: JQuery;

  constructor(readonly elementRef: ElementRef) {
    super();
    this.container = $(elementRef.nativeElement);
  }

  // @Override
  onDimensionsChanged(bounds: Size, viewport: Size) {
    const { w: vlWidth, h: vlHeight } = viewport;
    this.container
      .attr({
        width: vlWidth * this.attrScale,
        height: vlHeight * this.attrScale,
      })
      .css({
        width: vlWidth * this.cssScale,
        height: vlHeight * this.cssScale,
      });
  }
}
