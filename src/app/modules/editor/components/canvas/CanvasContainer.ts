import { CanvasLayoutMixin, Size } from './CanvasLayoutMixin';

/**
 * Resizes the canvas container when necessary.
 */
export class CanvasContainer extends CanvasLayoutMixin() {
  constructor(private readonly element: HTMLElement) {
    super();
  }

  // @Override
  protected onDimensionsChanged(bounds: Size, viewport: Size) {
    const { w, h } = viewport;
    this.element.setAttribute('width', `${w * this.attrScale}`);
    this.element.setAttribute('height', `${h * this.attrScale}`);
    this.element.style.width = `${w * this.cssScale}px`;
    this.element.style.height = `${h * this.cssScale}px`;
  }
}
