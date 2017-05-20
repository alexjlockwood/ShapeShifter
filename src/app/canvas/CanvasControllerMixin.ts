// import * as _ from 'lodash';
// import { OnDestroy } from '@angular/core';
// import { VectorLayer } from '../scripts/layers';
// import { Constructor } from '../scripts/mixins';
// import { CanvasDirective } from './canvas.component';
// import { Subscription } from 'rxjs/Subscription';

// // Canvas margin in css pixels.
// export const CANVAS_MARGIN = 36;

// type Context = CanvasRenderingContext2D;

// export function CanvasControllerMixin<T extends Constructor<{}>>(Base = class { } as T) {
//   return class extends Base {
//     private width = 1;
//     private height = 1;
//     private vectorLayer: VectorLayer;
//     private hiddenLayerIds: Set<string>;
//     private readonly canvasDirectives: CanvasDirective[] = [];

//     protected registerDirectives(directives: CanvasDirective[]) {
//       this.canvasDirectives.push(...directives);
//     }

//     // TODO: make sure imported vector layers always have same width/height
//     // TODO: make sure changing the width/height of one vector changes all other vectors?
//     getVectorLayer() {
//       return this.vectorLayer;
//     }

//     setVectorLayer(vl: VectorLayer) {
//       this.vectorLayer = vl;
//       this.canvasDirectives.forEach(d => d.setVectorLayer(vl));
//     }

//     getViewport() {
//       const vl = this.getVectorLayer();
//       const w = vl ? vl.width : 1;
//       const h = vl ? vl.height : 1;
//       return { w, h };
//     }

//     setDimensions(w: number, h: number) {
//       this.width = Math.max(1, w - CANVAS_MARGIN * 2);
//       this.height = Math.max(1, h - CANVAS_MARGIN * 2);
//       this.canvasDirectives.forEach(d => d.setDimensions(w, h));
//     }

//     getDimensions() {
//       return { w: this.width, h: this.height };
//     }

//     setHiddenLayerIds(layerIds: Set<string>) {
//       this.hiddenLayerIds = layerIds;
//       this.canvasDirectives.forEach(d => d.setHiddenLayerIds(layerIds));
//     }

//     getHiddenLayerIds() {
//       return this.hiddenLayerIds;
//     }
//   };
// }
