import type { Guide } from 'app/modules/editor/model/guides';
import { guidesToJSON, parseGuides } from 'app/modules/editor/model/guides';
import { LayerUtil, VectorLayer } from 'app/modules/editor/model/layers';
import {
  CURRENT_PROJECT_VERSION,
  getRequiredVersion,
  ProjectFormatError,
} from 'app/modules/editor/model/projectVersion';
import { Animation } from 'app/modules/editor/model/timeline';
import * as ModelUtil from 'app/modules/editor/scripts/common/ModelUtil';
import { AvdSerializer, SpriteSerializer, SvgSerializer } from 'app/modules/editor/scripts/export';
import { State, Store } from 'app/modules/editor/store';
import { getGuides } from 'app/modules/editor/store/guides/selectors';
import { getHiddenLayerIds, getVectorLayer } from 'app/modules/editor/store/layers/selectors';
import { getAnimation } from 'app/modules/editor/store/timeline/selectors';
import JSZip from 'jszip';
import { padStart } from 'lodash-es';

// Re-exported so that code saving projects can read the version from the service that saves them.
export { CURRENT_PROJECT_VERSION } from 'app/modules/editor/model/projectVersion';

const EXPORTED_FPS = [30, 60];

export interface ParsedProject {
  readonly vectorLayer: VectorLayer;
  readonly hiddenLayerIds: ReadonlySet<string>;
  readonly animation: Animation;
  readonly guides: ReadonlyArray<Guide>;
  /**
   * True when the project's version is higher than this build's `CURRENT_PROJECT_VERSION`, or
   * isn't a positive integer at all (a missing one counts as 1). The project still loads; callers
   * show a warning that some things may not show, and saving may drop them.
   */
  readonly newerVersion: boolean;
}

/**
 * A simple service that exports vectors and animations.
 */
export class FileExportService {
  static fromJSON(jsonObj: any): ParsedProject {
    const layers = jsonObj?.layers;
    const timeline = jsonObj?.timeline;
    if (!layers?.vectorLayer || !timeline?.animation) {
      if (jsonObj?.vectorLayer || jsonObj?.animations) {
        // Shape Shifter before 1.0 (the Angular app) saved the vector layer and the animations
        // at the top level, with no version field at all.
        throw new ProjectFormatError(
          "This project was saved by a version of Shape Shifter older than 1.0, whose format isn't supported anymore.",
        );
      }
      throw new ProjectFormatError("This doesn't look like a Shape Shifter project.");
    }
    // Every build has written a version, but a hand-written or generated project may leave it
    // out, and the only format it can mean is the first one.
    const version = jsonObj.version ?? 1;
    const newerVersion =
      !Number.isInteger(version) || version < 1 || version > CURRENT_PROJECT_VERSION;
    const vectorLayer = new VectorLayer(layers.vectorLayer);
    const hiddenLayerIds = new Set<string>(layers.hiddenLayerIds);
    const animation = new Animation(timeline.animation);
    animation.blocks = animation.blocks.filter(b => ModelUtil.canAnimate(vectorLayer, b));
    // Only projects saved with the canvas editor's guides have them.
    const guides = parseGuides(jsonObj.guides);
    return { vectorLayer, hiddenLayerIds, animation, guides, newerVersion };
  }

  constructor(private readonly store: Store<State>) {}

  exportJSON() {
    const vl = this.getVectorLayer();
    const anim = this.getAnimation();
    const guides = getGuides(this.store.getState());
    const layers = {
      vectorLayer: vl.toJSON(),
      hiddenLayerIds: Array.from(this.getHiddenLayerIds()),
    };
    const timeline = { animation: anim.toJSON() };
    const jsonStr = JSON.stringify(
      {
        version: getRequiredVersion({ layers, timeline }),
        layers,
        timeline,
        // Left out without any, so that projects that don't use them stay the same.
        ...(guides.length ? { guides: guidesToJSON(guides) } : {}),
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
        fpsFolder.file(`frame${padStart(i.toString(), length, '0')}.svg`, s);
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
