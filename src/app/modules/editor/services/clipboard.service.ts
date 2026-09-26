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

      const vl = this.layerTimelineService.getVectorLayer();
      const blocks = this.layerTimelineService.getSelectedBlocks().map(b => ({
        ...b.toJSON(),
        // Layer ids restart on every page load, so a block pasted in another tab or after a
        // reload finds its layer by name.
        layerName: vl.findLayerById(b.layerId)?.name,
      }));
      if (!blocks.length) {
        return false;
      }
      clipboardData.setData('text/plain', JSON.stringify({ blocks }, undefined, 2));

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
          trackEvent('paste_blocks');
          const vl = this.layerTimelineService.getVectorLayer();
          this.layerTimelineService.addBlocks(
            parsed.blocks.flatMap((b: any) => {
              let block: AnimationBlock;
              try {
                block = AnimationBlock.from(b);
              } catch {
                // Pasted text isn't validated, so skip blocks that can't be read.
                return [];
              }
              const layerId = getPastedLayerId(vl, block.layerId, b.layerName);
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
            }),
            false,
          );
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

/**
 * Returns the id of the layer to paste a copied block onto: the layer it was copied from, if it's
 * still there, or else the layer with its name. Returns undefined if there's no such layer.
 */
function getPastedLayerId(vl: VectorLayer, layerId: string, layerName: unknown) {
  if (typeof layerName !== 'string') {
    // Copied by an older version, which didn't record layer names.
    return layerId;
  }
  if (vl.findLayerById(layerId)?.name === layerName) {
    return layerId;
  }
  return vl.findLayerByName(layerName)?.id;
}
