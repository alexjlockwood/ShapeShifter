import { Injectable } from '@angular/core';
import { VectorLayer } from 'app/model/layers';
import { SvgLoader, VectorDrawableLoader } from 'app/scripts/import';
import { environment } from 'environments/environment';
import * as $ from 'jquery';

import { LayerTimelineService } from './layertimeline.service';

const IS_DEV_BUILD = !environment.production;

declare const ga: Function;

@Injectable()
export class ClipboardService {
  constructor(private readonly layerTimelineService: LayerTimelineService) {}

  init() {
    const cutCopyHandlerFn = (event: JQuery.Event, shouldCut: boolean) => {
      if (document.activeElement.matches('input')) {
        return true;
      }

      const blocks = this.layerTimelineService.getSelectedBlocks().map(b => b.toJSON());
      if (!blocks.length) {
        return true;
      }
      const clipboardData = (event.originalEvent as ClipboardEvent).clipboardData;
      clipboardData.setData('text/plain', JSON.stringify({ blocks }, undefined, 2));

      if (shouldCut) {
        this.layerTimelineService.deleteSelectedModels();
      }

      return false;
    };

    const pasteHandlerFn = (event: JQuery.Event) => {
      if (document.activeElement.matches('input')) {
        return true;
      }

      const clipboardData = (event.originalEvent as ClipboardEvent).clipboardData;
      const str = clipboardData.getData('text/plain');

      if (str.match(/<\/svg>\s*$/)) {
        // Paste SVG.
        ga('send', 'event', 'paste', 'svg');
        const existingVl = this.layerTimelineService.getVectorLayer();
        let importedVl: VectorLayer;
        SvgLoader.loadVectorLayerFromSvgStringWithCallback(
          str,
          vl => (importedVl = vl),
          name => !!existingVl.findLayerByName(name),
        );
        if (importedVl) {
          this.layerTimelineService.importLayers([importedVl]);
        }
      } else if (str.match(/<\/vector>\s*$/)) {
        // Paste VD.
        ga('send', 'event', 'paste', 'vd');
        const existingVl = this.layerTimelineService.getVectorLayer();
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
          // pasteLayers = parsed.layers.map(l => BaseLayer.load(l));
        } else {
          ga('send', 'event', 'paste', 'json.unknown');
        }
        return false;
      }

      return true;
    };

    const cutHandler = (event: JQuery.Event) => cutCopyHandlerFn(event, true);
    const copyHandler = (event: JQuery.Event) => cutCopyHandlerFn(event, false);
    const pasteHandler = pasteHandlerFn;

    if (IS_DEV_BUILD) {
      $(window).on('cut', cutHandler).on('copy', copyHandler).on('paste', pasteHandler);
    }
  }

  destroy() {
    if (IS_DEV_BUILD) {
      $(window).unbind('cut').unbind('copy').unbind('paste');
    }
  }
}
