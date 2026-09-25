import { AnimationBlock } from 'app/modules/editor/model/timeline';
import { trackEvent } from 'app/modules/editor/scripts/analytics';
import { bugsnagClient } from 'app/modules/editor/scripts/bugsnag';
import { on } from 'app/modules/editor/scripts/dom';
import { SvgLoader, VectorDrawableLoader } from 'app/modules/editor/scripts/import';

import { ActionModeService } from './actionmode.service';
import { LayerTimelineService } from './layertimeline.service';
import { PlaybackService } from './playback.service';

export class ClipboardService {
  private removeListeners: (() => void)[] = [];

  constructor(
    private readonly layerTimelineService: LayerTimelineService,
    private readonly playbackService: PlaybackService,
    private readonly actionModeService: ActionModeService,
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

      const blocks = this.layerTimelineService.getSelectedBlocks().map(b => b.toJSON());
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
      if (this.actionModeService.isActionMode()) {
        // TODO: make action mode automatically exit when layers/blocks are added in other parts of the app
        bugsnagClient.notify('Attempt to import files while in action mode', {
          severity: 'warning',
        });
        return false;
      }
      const { clipboardData } = event;
      if (!clipboardData || document.activeElement?.matches('input')) {
        return true;
      }

      const str = clipboardData.getData('text');
      const existingVl = this.layerTimelineService.getVectorLayer();

      if (str.match(/<\/svg>\s*$/)) {
        // Paste SVG.
        trackEvent('paste_svg');
        SvgLoader.loadVectorLayerFromSvgString(str, name => !!existingVl.findLayerByName(name))
          .then(vl => this.layerTimelineService.importLayers([vl]))
          .catch(() => console.warn('failed to import SVG'));
      } else if (str.match(/<\/vector>\s*$/)) {
        // Paste VD.
        trackEvent('paste_vector_drawable');
        const importedVl = VectorDrawableLoader.loadVectorLayerFromXmlString(
          str,
          name => !!existingVl.findLayerByName(name),
        );
        if (importedVl) {
          this.layerTimelineService.importLayers([importedVl]);
        }
      } else if (str.match(/\}\s*$/)) {
        let parsed;
        try {
          parsed = JSON.parse(str);
        } catch (e) {
          console.error(`Couldn't parse JSON: ${str}`);
          return false;
        }
        if (parsed.blocks) {
          trackEvent('paste_blocks');
          this.layerTimelineService.addBlocks(
            parsed.blocks.map((b: any) => {
              const block = AnimationBlock.from(b);
              const {
                layerId,
                propertyName,
                fromValue,
                toValue,
                interpolator,
                startTime,
                endTime,
              } = block;
              const duration = endTime - startTime;
              return {
                layerId,
                propertyName,
                fromValue,
                toValue,
                currentTime: this.playbackService.getCurrentTime(),
                duration,
                interpolator,
              };
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
