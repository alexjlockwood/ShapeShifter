import * as $ from 'jquery';
import { Directive, ElementRef } from '@angular/core';
import { CanvasLayoutMixin, Size } from './CanvasLayoutMixin';

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
  protected onDimensionsChanged(bounds: Size, viewport: Size) {
    const { w, h } = viewport;
    this.element.attr({ width: w * this.attrScale, height: h * this.attrScale })
    this.element.css({ width: w * this.cssScale, height: h * this.cssScale });
  }
}
