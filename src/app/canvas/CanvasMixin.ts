import * as _ from 'lodash';
import { OnDestroy } from '@angular/core';
import { VectorLayer } from '../scripts/layers';
import * as CanvasConstants from './constants';
import { Constructor } from '../scripts/mixins';
import { CanvasDirective } from './canvas.component';
import { Subscription } from 'rxjs/Subscription';

type Context = CanvasRenderingContext2D;

export function CanvasMixin<T extends Constructor<{}>>(Base = class { } as T) {
  return class extends Base {
    private width = 1;
    private height = 1;
    private vectorLayer: VectorLayer;
    private hiddenLayerIds: Set<string>;
    private readonly canvasDirectives: CanvasDirective[] = [];

    protected registerDirectives(directives: CanvasDirective[]) {
      this.canvasDirectives.push(...directives);
    }

    // TODO: make sure imported vector layers always have same width/height
    // TODO: make sure changing the width/height of one vector changes all other vectors?
    getVectorLayer() {
      return this.vectorLayer;
    }

    setVectorLayer(vl: VectorLayer) {
      this.vectorLayer = vl;
      this.canvasDirectives.forEach(d => d.setVectorLayer(vl));
    }

    getViewport() {
      const vl = this.getVectorLayer();
      const w = vl ? vl.width : 1;
      const h = vl ? vl.height : 1;
      return { w, h };
    }

    setDimensions(w: number, h: number) {
      this.width = Math.max(1, w - CanvasConstants.CANVAS_MARGIN * 2);
      this.height = Math.max(1, h - CanvasConstants.CANVAS_MARGIN * 2);
      this.canvasDirectives.forEach(d => d.setDimensions(w, h));
    }

    getDimensions() {
      return { w: this.width, h: this.height };
    }

    setHiddenLayerIds(layerIds: Set<string>) {
      this.hiddenLayerIds = layerIds;
      this.canvasDirectives.forEach(d => d.setHiddenLayerIds(layerIds));
    }

    getHiddenLayerIds() {
      return this.hiddenLayerIds;
    }

    /**
     * The 'cssScale' represents the number of CSS pixels per SVG viewport pixel.
     */
    get cssScale() {
      const { w: vlWidth, h: vlHeight } = this.getViewport();
      const { w: width, h: height } = this.getDimensions();
      const vectorAspectRatio = vlWidth / vlHeight;
      const containerAspectRatio = width / height;
      if (vectorAspectRatio > containerAspectRatio) {
        return width / vlWidth;
      } else {
        return height / vlHeight;
      }
    }

    /**
     * The 'attrScale' represents the number of physical pixels per SVG viewport pixel.
     */
    get attrScale() {
      return this.cssScale * devicePixelRatio;
    }

    // Scale the canvas so that everything from this point forward is drawn
    // in terms of the SVG's viewport coordinates.
    protected setupCtxWithViewportCoords = (ctx: Context) => {
      ctx.scale(this.attrScale, this.attrScale);
      const { w, h } = this.getViewport();
      ctx.clearRect(0, 0, w, h);
    }

    protected resizeCanvases(...$canvases: JQuery[]) {
      const { w: vlWidth, h: vlHeight } = this.getViewport();
      $canvases.forEach(canvas => {
        canvas
          .attr({
            width: vlWidth * this.attrScale,
            height: vlHeight * this.attrScale,
          })
          .css({
            width: vlWidth * this.cssScale,
            height: vlHeight * this.cssScale,
          });
      });
    }

    draw() {
      this.canvasDirectives.forEach(d => d.draw());
    }
  };
}
