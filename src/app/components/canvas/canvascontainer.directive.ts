import { Directive, ElementRef } from '@angular/core';
import * as $ from 'jquery';

import { CanvasLayoutMixin, Size } from './CanvasLayoutMixin';

/**
 * Directive that resizes the canvas container when necessary.
 */
@Directive({ selector: '[appCanvasContainer]' })
export class CanvasContainerDirective extends CanvasLayoutMixin() {
  private readonly element: JQuery;

  constructor(elementRef: ElementRef) {
    super();
    this.element = $(elementRef.nativeElement);
  }

  // @Override
  onDimensionsChanged(bounds: Size, viewport: Size) {
    const { w, h } = viewport;
    this.element.attr({ width: w * this.attrScale, height: h * this.attrScale });
    this.element.css({ width: w * this.cssScale, height: h * this.cssScale });
  }
}
