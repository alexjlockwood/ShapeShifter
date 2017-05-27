import * as _ from 'lodash';
import * as $ from 'jquery';
import { ElementRef } from '@angular/core';
import { Constructor } from '../scripts/mixins';
import { CanvasLayoutMixin } from './CanvasLayoutMixin';
import { Point } from '../scripts/common';

type Context = CanvasRenderingContext2D;

export function CanvasOverlayMixin<T extends Constructor<CanvasLayoutMixin>>(Base: T) {
  return class extends Base {

    draw(ctx: Context) {
      this.onDraw(ctx);
      this.drawPixelGrid(ctx);
    }

    onDraw(ctx: Context) { }

    // Draws the pixel grid on top of the canvas content.
    private drawPixelGrid(ctx: Context) {
      // Note that we draw the pixel grid in terms of physical pixels,
      // not viewport pixels.
      if (this.cssScale > 4) {
        ctx.save();
        ctx.fillStyle = 'rgba(128, 128, 128, .25)';
        const devicePixelRatio = window.devicePixelRatio || 1;
        const viewport = this.getViewport();
        for (let x = 1; x < viewport.w; x++) {
          ctx.fillRect(
            x * this.attrScale - devicePixelRatio / 2,
            0,
            devicePixelRatio,
            viewport.h * this.attrScale);
        }
        for (let y = 1; y < viewport.h; y++) {
          ctx.fillRect(
            0,
            y * this.attrScale - devicePixelRatio / 2,
            viewport.w * this.attrScale,
            devicePixelRatio);
        }
        ctx.restore();
      }
    }
  };
}

export interface CanvasOverlayMixin {
  draw(ctx: Context);
  onDraw(ctx: Context);
}
