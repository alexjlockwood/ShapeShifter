import { Injectable } from '@angular/core';
import { ModelUtil } from 'app/scripts/common';
import {
  GroupLayer,
  Layer,
  VectorLayer,
} from 'app/scripts/model/layers';
import { ActionModeService } from 'app/services/actionmode/actionmode.service';
import {
  State,
  Store,
} from 'app/store';
import { DeleteSelectedModels } from 'app/store/common/actions';
import * as $ from 'jquery';
import { ActionCreators } from 'redux-undo';

@Injectable()
export class ClipboardService {
  private isInit = false;

  constructor(
    private readonly store: Store<State>,
    private readonly actionModeService: ActionModeService,
  ) { }

  init() {
    if (this.isInit) {
      return;
    }
    this.isInit = true;

    const cutCopyHandlerFn = (event: JQueryEventObject, shouldCut: boolean) => {
      if (document.activeElement.matches('input')) {
        return true;
      }

      // TODO: query the store
      const selectedLayers: ReadonlyArray<Layer> = [];
      if (!selectedLayers.length) {
        return false;
      }

      const clipboardData = (event.originalEvent as ClipboardEvent).clipboardData;
      clipboardData.setData('text/plain', JSON.stringify({
        clipboardType: 'layers',
        layers: selectedLayers
          .filter(l => !(l instanceof VectorLayer))
          .map(l => l.toJSON()),
      }, undefined, 2));

      if (shouldCut) {
        // TODO: change to 'delete selected layers'
        this.store.dispatch(new DeleteSelectedModels());
      }

      return false;
    };

    const pasteHandlerFn = (event: JQueryEventObject) => {
      if (document.activeElement.matches('input')) {
        return true;
      }

      // TODO: query the store and make this the root layer
      const vl: VectorLayer = undefined;
      let targetParent: Layer = vl;
      // TODO: make this the first selected Layer
      const firstSelectedItem: Layer = undefined;
      if (firstSelectedItem && firstSelectedItem instanceof GroupLayer) {
        targetParent = firstSelectedItem;
      }

      const clipboardData = (event.originalEvent as ClipboardEvent).clipboardData;
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

    const cutHandler = (event: JQueryEventObject) => cutCopyHandlerFn(event, true);
    const copyHandler = (event: JQueryEventObject) => cutCopyHandlerFn(event, false);
    const pasteHandler = pasteHandlerFn;

    $(window)
      .on('cut', cutHandler)
      .on('copy', copyHandler)
      .on('paste', pasteHandler);
  }

  destroy() {
    if (!this.isInit) {
      return;
    }
    this.isInit = false;
    $(window)
      .unbind('cut')
      .unbind('copy')
      .unbind('paste');
  }
}
