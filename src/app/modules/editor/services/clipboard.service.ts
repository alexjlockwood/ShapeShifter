import { VectorLayer } from 'app/modules/editor/model/layers';
import { AnimationBlock } from 'app/modules/editor/model/timeline';
import { trackEvent } from 'app/modules/editor/scripts/analytics';
import { on } from 'app/modules/editor/scripts/dom';
import { SvgLoader, VectorDrawableLoader } from 'app/modules/editor/scripts/import';

import { ActionModeService } from './actionmode.service';
import { LayerTimelineService } from './layertimeline.service';
import { PlaybackService } from './playback.service';
import { Duration, SnackBarService } from './snackbar.service';

export class ClipboardService {
  private removeListeners: (() => void)[] = [];

  constructor(
    private readonly layerTimelineService: LayerTimelineService,
    private readonly playbackService: PlaybackService,
    private readonly actionModeService: ActionModeService,
    private readonly snackBarService: SnackBarService,
  ) {}

  init() {
    if (this.removeListeners.length) {
      return;
    }
    const cutCopyHandlerFn = (event: ClipboardEvent, shouldCut: boolean) => {
      const { clipboardData } = event;
      if (!clipboardData || document.activeElement?.matches('input')) {
        return true;
      }

      const selectedBlocks = this.layerTimelineService.getSelectedBlocks();
      if (!selectedBlocks.length) {
        return false;
      }
      const vl = this.layerTimelineService.getVectorLayer();
      const blocks = selectedBlocks.map(b => ({
        ...b.toJSON(),
        // Layer ids restart on every page load, so a block pasted in another tab or after a
        // reload finds its layer by name.
        layerName: vl.findLayerById(b.layerId)?.name,
      }));
      clipboardData.setData(
        'text/plain',
        JSON.stringify({ pageId: PAGE_ID, blocks }, undefined, 2),
      );

      if (shouldCut) {
        this.layerTimelineService.deleteSelectedModels();
      }

      return false;
    };

    const pasteHandlerFn = (event: ClipboardEvent) => {
      const { clipboardData } = event;
      if (!clipboardData || document.activeElement?.matches('input')) {
        return true;
      }
      const str = clipboardData.getData('text');
      const isSvg = /<\/svg>\s*$/.test(str);
      const isVectorDrawable = /<\/vector>\s*$/.test(str);
      const isJson = /\}\s*$/.test(str);
      if (this.actionModeService.isActionMode()) {
        // TODO: make action mode automatically exit when layers/blocks are added in other parts of the app
        if (isSvg || isVectorDrawable || isJson) {
          this.snackBarService.show(
            "Can't import while editing a path morph",
            'Dismiss',
            Duration.Short,
          );
        }
        return false;
      }

      const existingVl = this.layerTimelineService.getVectorLayer();

      if (isSvg) {
        // Paste SVG.
        trackEvent('paste_svg');
        SvgLoader.loadVectorLayerFromSvgString(str, name => !!existingVl.findLayerByName(name))
          .then(vl => this.layerTimelineService.importLayers([vl]))
          .catch(() => console.warn('failed to import SVG'));
      } else if (isVectorDrawable) {
        // Paste VD.
        trackEvent('paste_vector_drawable');
        const importedVl = VectorDrawableLoader.loadVectorLayerFromXmlString(
          str,
          name => !!existingVl.findLayerByName(name),
        );
        if (importedVl) {
          this.layerTimelineService.importLayers([importedVl]);
        }
      } else if (isJson) {
        let parsed;
        try {
          parsed = JSON.parse(str);
        } catch (e) {
          console.error(`Couldn't parse JSON: ${str}`);
          return false;
        }
        if (Array.isArray(parsed.blocks)) {
          const isSamePage = parsed.pageId === PAGE_ID;
          const blocks = parsed.blocks.flatMap((b: any) => {
            let block: AnimationBlock;
            try {
              block = AnimationBlock.from(b);
            } catch {
              // Pasted text isn't validated, so skip blocks that can't be read.
              return [];
            }
            const layerId = getPastedLayerId(existingVl, block, b.layerName, isSamePage);
            if (layerId === undefined) {
              return [];
            }
            const { propertyName, fromValue, toValue, interpolator, startTime, endTime } = block;
            const duration = endTime - startTime;
            return [
              {
                layerId,
                propertyName,
                fromValue,
                toValue,
                currentTime: this.playbackService.getCurrentTime(),
                duration,
                interpolator,
              },
            ];
          });
          if (!blocks.length) {
            this.snackBarService.show(
              "Couldn't find the layers to paste onto",
              'Dismiss',
              Duration.Long,
            );
            return false;
          }
          trackEvent('paste_blocks');
          this.layerTimelineService.addBlocks(blocks, false);
        } else {
          trackEvent('paste_unknown_json');
        }
        return false;
      }

      return false;
    };

    this.removeListeners = [
      on(window, 'cut', event => cutCopyHandlerFn(event, true)),
      on(window, 'copy', event => cutCopyHandlerFn(event, false)),
      on(window, 'paste', pasteHandlerFn),
    ];
  }

  destroy() {
    this.removeListeners.forEach(removeListener => removeListener());
    this.removeListeners = [];
  }
}

// Identifies this page load, so that pasting can tell whether blocks were copied here.
const PAGE_ID = Math.random().toString(36).slice(2);

/**
 * Returns the id of the layer to paste a copied block onto, or undefined if there's no such layer.
 * Blocks copied on this page go back onto the layer they came from, even if it was renamed since.
 * Layer ids restart on every page load, so blocks copied in another tab or before a reload go onto
 * the layer with the same name instead.
 */
function getPastedLayerId(
  vl: VectorLayer,
  block: AnimationBlock,
  layerName: unknown,
  isSamePage: boolean,
) {
  if (isSamePage || typeof layerName !== 'string') {
    // Older versions didn't record layer names.
    return block.layerId;
  }
  return vl.findLayerByName(layerName)?.id;
}
