import { LayerUtil, VectorLayer } from 'app/modules/editor/model/layers';
import { Animation } from 'app/modules/editor/model/timeline';
import * as ModelUtil from 'app/modules/editor/scripts/common/ModelUtil';
import { AvdSerializer, SpriteSerializer, SvgSerializer } from 'app/modules/editor/scripts/export';
import { State, Store } from 'app/modules/editor/store';
import { getHiddenLayerIds, getVectorLayer } from 'app/modules/editor/store/layers/selectors';
import { getAnimation } from 'app/modules/editor/store/timeline/selectors';
import JSZip from 'jszip';
import _ from 'lodash';

// Store a version number just in case we ever change the export format...
const IMPORT_EXPORT_VERSION = 1;

const EXPORTED_FPS = [30, 60];

/**
 * A simple service that exports vectors and animations.
 */
export class FileExportService {
  static fromJSON(jsonObj: any) {
    const { layers, timeline } = jsonObj;
    const vectorLayer = new VectorLayer(layers.vectorLayer);
    const hiddenLayerIds = new Set<string>(layers.hiddenLayerIds);
    const animation = new Animation(timeline.animation);
    animation.blocks = animation.blocks.filter(b => ModelUtil.canAnimate(vectorLayer, b));
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
      const fpsFolder = getFolder(zip, `${fps}fps`);
      svgs.forEach((s, i) => {
        fpsFolder.file(`frame${_.padStart(i.toString(), length, '0')}.svg`, s);
      });
    });
    void zip.generateAsync({ type: 'blob' }).then((content: Blob) => {
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
    void (async () => {
      await asyncForEach(EXPORTED_FPS, async fps => {
        const numSteps = Math.ceil((anim.duration / 1000) * fps);
        const svgSprite = await SpriteSerializer.createSvgSprite(vl, anim, numSteps);
        const cssSprite = SpriteSerializer.createCss(vl.width, vl.height, anim.duration, numSteps);
        const fileName = `sprite_${fps}fps`;
        const htmlSprite = SpriteSerializer.createHtml(`${fileName}.svg`, `${fileName}.css`);
        const spriteFolder = getFolder(zip, `${fps}fps`);
        spriteFolder.file(`${fileName}.html`, htmlSprite);
        spriteFolder.file(`${fileName}.css`, cssSprite);
        spriteFolder.file(`${fileName}.svg`, svgSprite);
      });
      const content = await zip.generateAsync({ type: 'blob' });
      downloadFile(content, `spritesheet_${vl.name}.zip`);
    })();
  }

  exportCssKeyframes() {
    // TODO: implement this
  }

  private getVectorLayer() {
    return getVectorLayer(this.store.getState());
  }

  private getAnimation() {
    return getAnimation(this.store.getState());
  }

  private getHiddenLayerIds() {
    return getHiddenLayerIds(this.store.getState());
  }

  private getVectorLayerWithoutHiddenLayers() {
    const vl = this.getVectorLayer();
    const hiddenLayerIds = this.getHiddenLayerIds();
    if (hiddenLayerIds.has(vl.id)) {
      // Hiding the root hides everything in it, so export an empty vector layer.
      return LayerUtil.removeLayers(vl, ...vl.children.map(l => l.id));
    }
    return LayerUtil.removeLayers(vl, ...Array.from(hiddenLayerIds));
  }

  private getAnimationWithoutHiddenBlocks() {
    const anim = this.getAnimation().clone();
    const hiddenLayerIds = this.getHiddenLayerIds();
    // Hiding a group also hides its children, so check the layers that are left.
    const vl = this.getVectorLayerWithoutHiddenLayers();
    anim.blocks = anim.blocks.filter(
      b => !hiddenLayerIds.has(b.layerId) && ModelUtil.canAnimate(vl, b),
    );
    return anim;
  }
}

function downloadFile(content: string | Blob, fileName: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: 'octet/stream' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.style.display = 'none';
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

/** Returns the zip's folder with the specified name, creating it if it doesn't exist. */
function getFolder(zip: JSZip, name: string) {
  const folder = zip.folder(name);
  if (!folder) {
    throw new Error(`Couldn't create the ${name} folder`);
  }
  return folder;
}

async function asyncForEach(
  array: number[],
  callback: (value: number, index: number, array: number[]) => Promise<void>,
) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}
