import {
  AvdSerializer,
  SvgSerializer,
} from '../scripts/export';
import {
  SvgLoader,
  VectorDrawableLoader,
} from '../scripts/import';
import {
  LayerUtil,
  VectorLayer,
} from '../scripts/layers';
import { Animation } from '../scripts/timeline';
import {
  State,
  Store,
} from '../store';
import { getActiveVectorLayer } from '../store/layers/selectors';
import {
  getActiveAnimation,
  getAnimations,
} from '../store/timeline/selectors';
import { Injectable } from '@angular/core';
import * as $ from 'jquery';

/**
 * A simple service that exports vectors and animations.
 */
@Injectable()
export class FileExportService {
  private vectorLayer: VectorLayer;
  private animations: ReadonlyArray<Animation>;
  private activeAnimation: Animation;

  constructor(readonly store: Store<State>) {
    this.store.select(getActiveVectorLayer).subscribe(vl => this.vectorLayer = vl);
    this.store.select(getAnimations).subscribe(anims => this.animations = anims);
    this.store.select(getActiveAnimation).subscribe(anim => this.activeAnimation = anim);
  }

  exportJSON() {
    const jsonStr = JSON.stringify({
      artwork: this.vectorLayer.toJSON(),
      animations: this.animations.map(anim => anim.toJSON()),
    }, undefined, 2);
    downloadFile(jsonStr, `${this.vectorLayer.name}.iconanim`);
  }

  // TODO: should we or should we not export hidden layers?
  exportSvg() {
    const vl = this.vectorLayer;
    const svg = SvgSerializer.toSvgString(vl);
    const fileName = `${vl.name}.svg`;
    downloadFile(svg, fileName);
  }

  // TODO: should we or should we not export hidden layers?
  exportVectorDrawable() {
    const vl = this.vectorLayer;
    const vd = AvdSerializer.toVectorDrawableXmlString(vl);
    const fileName = `vd_${vl.name}.xml`;
    downloadFile(vd, fileName);
  }

  exportAnimatedVectorDrawable() {
    const vl = this.vectorLayer;
    const anim = this.activeAnimation;
    const avd = AvdSerializer.toAnimatedVectorDrawableXmlString(vl, anim);
    const fileName = `avd_${anim.name}.xml`;
    downloadFile(avd, fileName);
  }

  exportSvgSpritesheet() {
    // TODO: implement this
  }

  exportCssKeyframes() {
    // TODO: implement this
  }
}

function downloadFile(content: string | Blob, fileName: string) {
  const anchor = $('<a>').hide().appendTo(document.body);
  let blob: Blob;
  if (content instanceof Blob) {
    blob = content;
  } else {
    blob = new Blob([content], { type: 'octet/stream' });
  }
  const url = window.URL.createObjectURL(blob);
  anchor.attr({ href: url, download: fileName });
  anchor.get(0).click();
  window.URL.revokeObjectURL(url);
}
