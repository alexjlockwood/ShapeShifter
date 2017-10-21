import * as _ from 'lodash';

export function CanvasLayoutMixin<T extends Constructor>(Base = class {} as T) {
  return class extends Base {
    private bounds = { w: 24, h: 24 };
    private viewport = { w: 24, h: 24 };
    private zoom = 1;
    private translation = { tx: 0, ty: 0 };

    /**
     * The 'cssScale' represents the number of CSS pixels per SVG viewport pixel.
     */
    get cssScale() {
      const { w: vWidth, h: vHeight } = this.getViewport();
      const { w: bWidth, h: bHeight } = this.getBounds();
      const vectorAspectRatio = vWidth / vHeight;
      const containerAspectRatio = bWidth / bHeight;
      if (vectorAspectRatio > containerAspectRatio) {
        return bWidth / vWidth;
      } else {
        return bHeight / vHeight;
      }
    }

    /**
     * The 'attrScale' represents the number of physical pixels per SVG viewport pixel.
     */
    get attrScale() {
      return this.cssScale * devicePixelRatio;
    }

    getBounds() {
      return this.bounds;
    }

    getViewport() {
      return this.viewport;
    }

    getZoom() {
      return this.zoom;
    }

    getTranslation() {
      return this.translation;
    }

    setDimensions(bounds: Size, viewport: Size) {
      if (!_.isEqual(this.bounds, bounds) || !_.isEqual(this.viewport, viewport)) {
        this.bounds = bounds;
        this.viewport = viewport;
        this.onDimensionsChanged(this.bounds, this.viewport);
      }
    }

    protected onDimensionsChanged(bounds: Size, viewport: Size) {}

    setZoomPan(zoom: number, translation: Readonly<{ tx: number; ty: number }>) {
      if (this.zoom !== zoom || !_.isEqual(this.translation, translation)) {
        this.zoom = zoom;
        this.translation = translation;
        this.onZoomPanChanged(zoom, translation);
      }
    }

    protected onZoomPanChanged(zoom: number, translation: Readonly<{ tx: number; ty: number }>) {}
  };
}

export interface Size {
  readonly w: number;
  readonly h: number;
}

export interface CanvasLayoutMixin {
  readonly cssScale: number;
  readonly attrScale: number;
  getViewport(): Size;
  getBounds(): Size;
  setDimensions(bounds: Size, viewport: Size): void;
  onDimensionsChanged(bounds: Size, viewport: Size): void;
}
