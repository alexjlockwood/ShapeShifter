import { Injectable } from '@angular/core';
import { LayerUtil, VectorLayer } from 'app/modules/editor/model/layers';
import { Animation } from 'app/modules/editor/model/timeline';
import { AvdSerializer, SpriteSerializer, SvgSerializer } from 'app/modules/editor/scripts/export';
import { State, Store } from 'app/modules/editor/store';
import { getHiddenLayerIds, getVectorLayer } from 'app/modules/editor/store/layers/selectors';
import { getAnimation } from 'app/modules/editor/store/timeline/selectors';
import * as $ from 'jquery';
import * as JSZip from 'jszip';
import * as _ from 'lodash';
import { first } from 'rxjs/operators';

// Store a version number just in case we ever change the export format...
const IMPORT_EXPORT_VERSION = 1;

const EXPORTED_FPS = [30, 60];

/**
 * A simple service that exports vectors and animations.
 */
@Injectable({ providedIn: 'root' })
export class FileExportService {
  static fromJSON(jsonObj: any) {
    const { layers, timeline } = jsonObj;
    const vectorLayer = new VectorLayer(layers.vectorLayer);
    const hiddenLayerIds = new Set<string>(layers.hiddenLayerIds);
    const animation = new Animation(timeline.animation);
    return { vectorLayer, hiddenLayerIds, animation };
  }

  constructor(private readonly store: Store<State>) {}

  exportJSON() {
    const vl = this.getVectorLayer();
    const anim = this.getAnimation();
    const jsonStr = JSON.stringify(
      {
        version: IMPORT_EXPORT_VERSION,
        layers: {
          vectorLayer: vl.toJSON(),
          hiddenLayerIds: Array.from(this.getHiddenLayerIds()),
        },
        timeline: {
          animation: anim.toJSON(),
        },
      },
      undefined,
      2,
    );
    downloadFile(jsonStr, `${vl.name}.shapeshifter`);
  }

  exportSvg() {
    // Export standalone SVG frames.
    const vl = this.getVectorLayerWithoutHiddenLayers();
    const anim = this.getAnimationWithoutHiddenBlocks();
    if (!anim.blocks.length) {
      // Just export an SVG if there are no animation blocks defined.
      const svg = SvgSerializer.toSvgString(vl);
      downloadFile(svg, `${vl.name}.svg`);
      return;
    }
    // TODO: figure out how to add better jszip typings
    const zip = new JSZip();
    EXPORTED_FPS.forEach(fps => {
      const numSteps = Math.ceil((anim.duration / 1000) * fps);
      const svgs = SpriteSerializer.createSvgFrames(vl, anim, numSteps);
      const length = (numSteps - 1).toString().length;
      const fpsFolder = zip.folder(`${fps}fps`);
      svgs.forEach((s, i) => {
        fpsFolder.file(`frame${_.padStart(i.toString(), length, '0')}.svg`, s);
      });
    });
    zip.generateAsync({ type: 'blob' }).then((content: Blob) => {
      downloadFile(content, `frames_${vl.name}.zip`);
    });
  }

  // TODO: should we or should we not export hidden layers?
  exportVectorDrawable() {
    const vl = this.getVectorLayerWithoutHiddenLayers();
    const vd = AvdSerializer.toVectorDrawableXmlString(vl);
    const fileName = `vd_${vl.name}.xml`;
    downloadFile(vd, fileName);
  }

  exportAnimatedVectorDrawable() {
    const vl = this.getVectorLayerWithoutHiddenLayers();
    const anim = this.getAnimationWithoutHiddenBlocks();
    const avd = AvdSerializer.toAnimatedVectorDrawableXmlString(vl, anim);
    const fileName = `avd_${anim.name}.xml`;
    downloadFile(avd, fileName);
  }

  exportSvgSpritesheet() {
    // Create an svg sprite animation.
    const vl = this.getVectorLayerWithoutHiddenLayers();
    const anim = this.getAnimationWithoutHiddenBlocks();
    // TODO: figure out how to add better jszip typings
    const zip = new JSZip();
    (async () => {
      await asyncForEach(EXPORTED_FPS, async fps => {
        const numSteps = Math.ceil((anim.duration / 1000) * fps);
        const svgSprite = await SpriteSerializer.createSvgSprite(vl, anim, numSteps);
        const cssSprite = SpriteSerializer.createCss(vl.width, vl.height, anim.duration, numSteps);
        const fileName = `sprite_${fps}fps`;
        const htmlSprite = SpriteSerializer.createHtml(`${fileName}.svg`, `${fileName}.css`);
        const spriteFolder = zip.folder(`${fps}fps`);
        spriteFolder.file(`${fileName}.html`, htmlSprite);
        spriteFolder.file(`${fileName}.css`, cssSprite);
        spriteFolder.file(`${fileName}.svg`, svgSprite);
      });
      zip.generateAsync({ type: 'blob' }).then((content: Blob) => {
        downloadFile(content, `spritesheet_${vl.name}.zip`);
      });
    })();
  }

  exportCssKeyframes() {
    // TODO: implement this
  }

  private getVectorLayer() {
    let vectorLayer: VectorLayer;
    this.store
      .select(getVectorLayer)
      .pipe(first())
      .subscribe(vl => (vectorLayer = vl));
    return vectorLayer;
  }

  private getAnimation() {
    let animation: Animation;
    this.store
      .select(getAnimation)
      .pipe(first())
      .subscribe(anim => (animation = anim));
    return animation;
  }

  private getHiddenLayerIds() {
    let hiddenLayerIds: ReadonlySet<string>;
    this.store
      .select(getHiddenLayerIds)
      .pipe(first())
      .subscribe(ids => (hiddenLayerIds = ids));
    return hiddenLayerIds;
  }

  private getVectorLayerWithoutHiddenLayers() {
    return LayerUtil.removeLayers(this.getVectorLayer(), ...Array.from(this.getHiddenLayerIds()));
  }

  private getAnimationWithoutHiddenBlocks() {
    const anim = this.getAnimation().clone();
    const hiddenLayerIds = this.getHiddenLayerIds();
    anim.blocks = anim.blocks.filter(b => !hiddenLayerIds.has(b.layerId));
    return anim;
  }
}

function downloadFile(content: string | Blob, fileName: string) {
  const anchor = $('<a>')
    .hide()
    .appendTo(document.body);
  const blob = content instanceof Blob ? content : new Blob([content], { type: 'octet/stream' });
  const url = window.URL.createObjectURL(blob);
  anchor.attr({ href: url, download: fileName });
  anchor.get(0).click();
  window.URL.revokeObjectURL(url);
}

async function asyncForEach(
  array: number[],
  callback: (value: number, index: number, array: number[]) => void,
) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}
