import { Injectable } from '@angular/core';
import { AnimationBlock } from 'app/modules/editor/model/timeline';
import { bugsnagClient } from 'app/modules/editor/scripts/bugsnag';
import { SvgLoader, VectorDrawableLoader } from 'app/modules/editor/scripts/import';
import * as $ from 'jquery';

import { ActionModeService } from './actionmode.service';
import { LayerTimelineService } from './layertimeline.service';
import { PlaybackService } from './playback.service';

declare const ga: Function;

@Injectable({ providedIn: 'root' })
export class ClipboardService {
  constructor(
    private readonly layerTimelineService: LayerTimelineService,
    private readonly playbackService: PlaybackService,
    private readonly actionModeService: ActionModeService,
  ) {}

  init() {
    const cutCopyHandlerFn = (event: JQuery.Event, shouldCut: boolean) => {
      if (document.activeElement.matches('input')) {
        return true;
      }

      const blocks = this.layerTimelineService.getSelectedBlocks().map(b => b.toJSON());
      if (!blocks.length) {
        return false;
      }
      const clipboardData = (event.originalEvent as ClipboardEvent).clipboardData;
      clipboardData.setData('text/plain', JSON.stringify({ blocks }, undefined, 2));

      if (shouldCut) {
        this.layerTimelineService.deleteSelectedModels();
      }

      return false;
    };

    const pasteHandlerFn = (event: JQuery.Event) => {
      if (this.actionModeService.isActionMode()) {
        // TODO: make action mode automatically exit when layers/blocks are added in other parts of the app
        bugsnagClient.notify('Attempt to import files while in action mode', {
          severity: 'warning',
        });
        return false;
      }
      if (document.activeElement.matches('input')) {
        return true;
      }

      const clipboardData = (event.originalEvent as ClipboardEvent).clipboardData;
      const str = clipboardData.getData('text');
      const existingVl = this.layerTimelineService.getVectorLayer();

      if (str.match(/<\/svg>\s*$/)) {
        // Paste SVG.
        ga('send', 'event', 'paste', 'svg');
        SvgLoader.loadVectorLayerFromSvgString(str, name => !!existingVl.findLayerByName(name))
          .then(vl => this.layerTimelineService.importLayers([vl]))
          .catch(() => console.warn('failed to import SVG'));
      } else if (str.match(/<\/vector>\s*$/)) {
        // Paste VD.
        ga('send', 'event', 'paste', 'vd');
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
          ga('send', 'event', 'paste', 'json.blocks');
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
          ga('send', 'event', 'paste', 'json.unknown');
        }
        return false;
      }

      return false;
    };

    const cutHandler = (event: JQuery.Event) => cutCopyHandlerFn(event, true);
    const copyHandler = (event: JQuery.Event) => cutCopyHandlerFn(event, false);
    const pasteHandler = pasteHandlerFn;

    $(window)
      .on('cut', cutHandler)
      .on('copy', copyHandler)
      .on('paste', pasteHandler);
  }

  destroy() {
    $(window)
      .unbind('cut')
      .unbind('copy')
      .unbind('paste');
  }
}
