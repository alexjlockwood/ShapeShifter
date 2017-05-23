import * as $ from 'jquery';
import { Directive, Input, ElementRef, AfterViewInit } from '@angular/core';
import { CanvasLayoutMixin, Size } from './CanvasLayoutMixin';
import { Observable } from 'rxjs/Observable';
import { DestroyableMixin } from '../scripts/mixins';

@Directive({
  selector: '[appCanvasContainer]',
})
export class CanvasContainerDirective extends CanvasLayoutMixin() {

  private readonly element: JQuery;

  constructor(readonly elementRef: ElementRef) {
    super();
    this.element = $(elementRef.nativeElement);
  }

  // @Override
  onDimensionsChanged(bounds: Size, viewport: Size) {
    const { w, h } = viewport;
    this.element.attr({ width: w * this.attrScale, height: h * this.attrScale })
    this.element.css({ width: w * this.cssScale, height: h * this.cssScale });
  }
}
