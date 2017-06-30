import { Injectable } from '@angular/core';
import { GroupLayer, Layer, VectorLayer } from 'app/model/layers';
import { environment } from 'environments/environment';
import * as $ from 'jquery';

import { LayerTimelineService } from './layertimeline.service';

const IS_DEV_BUILD = !environment.production;

@Injectable()
export class ClipboardService {
  constructor(private readonly layerTimelineService: LayerTimelineService) {}

  init() {
    const cutCopyHandlerFn = (event: JQuery.Event, shouldCut: boolean) => {
      if (document.activeElement.matches('input')) {
        return true;
      }

      const clipboardData = (event.originalEvent as ClipboardEvent).clipboardData;

      const layers = this.layerTimelineService
        .getSelectedLayers()
        .filter(l => !(l instanceof VectorLayer))
        .map(l => l.toJSON());
      if (layers.length) {
        const clipboardType = 'layers';
        clipboardData.setData(
          'text/plain',
          JSON.stringify({ clipboardType, layers }, undefined, 2),
        );
        if (shouldCut) {
          // TODO: change to 'delete selected layers'
          this.layerTimelineService.deleteSelectedModels();
        }
        return false;
      }

      const blocks = this.layerTimelineService.getSelectedBlocks().map(b => b.toJSON());
      if (blocks.length) {
        const clipboardType = 'blocks';
        clipboardData.setData(
          'text/plain',
          JSON.stringify({ clipboardType, blocks }, undefined, 2),
        );
        if (shouldCut) {
          // TODO: change to 'delete selected blocks'
          this.layerTimelineService.deleteSelectedModels();
        }
        return false;
      }

      return false;
    };

    const pasteHandlerFn = (event: JQuery.Event) => {
      if (document.activeElement.matches('input')) {
        return true;
      }

      const clipboardData = (event.originalEvent as ClipboardEvent).clipboardData;
      if (clipboardData) {
        // console.info();
      }

      // TODO: query the store and make this the root layer
      const vl: VectorLayer = undefined;
      let targetParent: Layer = vl;
      // TODO: make this the first selected Layer
      const firstSelectedItem: Layer = undefined;
      if (firstSelectedItem && firstSelectedItem instanceof GroupLayer) {
        targetParent = firstSelectedItem;
      }

      const str = clipboardData.getData('text');
      const pasteLayers = undefined;

      if (str.match(/<\/svg>\s*$/)) {
        // paste SVG
        // ga('send', 'event', 'paste', 'svg');
        // let artwork = SvgLoader.loadArtworkFromSvgString(str);
        // pasteLayers = artwork.layers;
      } else if (str.match(/<\/vector>\s*$/)) {
        // paste VD
        // ga('send', 'event', 'paste', 'vd');
        // let artwork = VectorDrawableLoader.loadArtworkFromXmlString(str);
        // pasteLayers = artwork.layers;
      } else if (str.match(/\}\s*$/)) {
        let parsed;
        try {
          parsed = JSON.parse(str);
        } catch (e) {
          console.error(`Couldn't parse JSON: ${str}`);
          return false;
        }
        if (parsed.clipboardType === 'layers') {
          // ga('send', 'event', 'paste', 'json.layers');
          // pasteLayers = parsed.layers.map(l => BaseLayer.load(l));
        } else {
          // ga('send', 'event', 'paste', 'json.unknown');
        }
      }

      if (pasteLayers && pasteLayers.length) {
        // const newSelection = [];
        // pasteLayers.forEach(layer => {
        //   layer.walk(child => {
        //     // TODO: should probably regenerate all of the IDs just to be safe?
        //     // TODO: need to make sure the names are still unique
        //     child.name = ModelUtil.getUniqueLayerName(child.name, child);
        //   });
        //   targetParent.children.push(layer);
        //   newSelection.push(layer);
        // });

        // TODO: set the selected layer ids
        // this.studioState_.selection = newSelection;
        return false;
      }
      return undefined;
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
