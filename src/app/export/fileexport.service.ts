import * as AvdSerializer from './AvdSerializer';
import * as SpriteSerializer from './SpriteSerializer';
import * as SvgSerializer from './SvgSerializer';
import { Injectable } from '@angular/core';
import { VectorLayer } from 'app/scripts/model/layers';
import { Animation } from 'app/scripts/model/timeline';
import {
  State,
  Store,
} from 'app/store';
import {
  getHiddenLayerIds,
  getVectorLayer,
} from 'app/store/layers/selectors';
import {
  getActiveAnimation,
  getAnimations,
} from 'app/store/timeline/selectors';
import * as $ from 'jquery';
import * as JSZip from 'jszip';
import * as _ from 'lodash';

// Store a version number just in case we ever change the export format....
const IMPORT_EXPORT_VERSION = 1;

const EXPORTED_FPS = [30, 60];

/**
 * A simple service that exports vectors and animations.
 */
@Injectable()
export class FileExportService {
  private vectorLayer: VectorLayer;
  private animations: ReadonlyArray<Animation>;
  private activeAnimation: Animation;
  private hiddenLayerIds: Set<string>;

  constructor(readonly store: Store<State>) {
    this.store.select(getVectorLayer).subscribe(vl => this.vectorLayer = vl);
    this.store.select(getAnimations).subscribe(anims => this.animations = anims);
    this.store.select(getActiveAnimation).subscribe(anim => this.activeAnimation = anim);
    this.store.select(getHiddenLayerIds).subscribe(ids => this.hiddenLayerIds = ids);
  }

  exportJSON() {
    const jsonStr = JSON.stringify({
      version: IMPORT_EXPORT_VERSION,
      vectorLayer: this.vectorLayer.toJSON(),
      animations: this.animations.map(anim => anim.toJSON()),
      hiddenLayerIds: Array.from(this.hiddenLayerIds),
    }, undefined, 2);
    downloadFile(jsonStr, `${this.vectorLayer.name}.shapeshifter`);
  }

  // TODO: should we or should we not export hidden layers?
  exportSvg() {
    // Export standalone SVG frames.
    const zip = new JSZip();
    EXPORTED_FPS.forEach(fps => {
      const numSteps = Math.ceil(this.activeAnimation.duration / 1000 * fps);
      const svgs = SpriteSerializer.createSvgFrames(this.vectorLayer, this.activeAnimation, numSteps);
      const length = (numSteps - 1).toString().length;
      const fpsFolder = zip.folder(`${fps}fps`);
      svgs.forEach((s, i) => {
        fpsFolder.file(`frame${_.padStart(i.toString(), length, '0')}.svg`, s);
      });
    });
    zip.generateAsync({ type: 'blob' }).then(content => {
      downloadFile(content, `frames_${this.vectorLayer.name}.zip`);
    });
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
    // Create an svg sprite animation.
    const zip = new JSZip();
    EXPORTED_FPS.forEach(fps => {
      const numSteps = Math.ceil(this.activeAnimation.duration / 1000 * fps);
      const svgSprite =
        SpriteSerializer.createSvgSprite(this.vectorLayer, this.activeAnimation, numSteps);
      const { width, height } = this.vectorLayer;
      const cssSprite =
        SpriteSerializer.createCss(width, height, this.activeAnimation.duration, numSteps);
      const fileName = `sprite_${fps}fps`;
      const htmlSprite = SpriteSerializer.createHtml(`${fileName}.svg`, `${fileName}.css`);
      const spriteFolder = zip.folder(`${fps}fps`);
      spriteFolder.file(`${fileName}.html`, htmlSprite);
      spriteFolder.file(`${fileName}.css`, cssSprite);
      spriteFolder.file(`${fileName}.svg`, svgSprite);
    });
    zip.generateAsync({ type: 'blob' }).then(content => {
      downloadFile(content, `spritesheet_${this.vectorLayer.name}.zip`);
    });
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
