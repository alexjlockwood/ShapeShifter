import 'rxjs/add/operator/first';
import 'rxjs/add/observable/combineLatest';

import { Injectable } from '@angular/core';
import { Layer } from 'app/scripts/model/layers';
import { AnimationBlock } from 'app/scripts/model/timeline';
import { State, Store } from 'app/store';
import { SetSelectedLayers } from 'app/store/layers/actions';
import { getSelectedLayerIds, getVectorLayer } from 'app/store/layers/selectors';
import { MultiAction } from 'app/store/multiaction/actions';
import { SelectAnimation, SetSelectedBlocks } from 'app/store/timeline/actions';
import { getAnimation, getSelectedBlockIds } from 'app/store/timeline/selectors';
import * as _ from 'lodash';

/**
 * A simple service that provides an interface for making layer/timeline changes.
*/
@Injectable()
export class LayerTimelineService {
  constructor(private readonly store: Store<State>) {}

  private getSelectedLayerIds() {
    let layerIds: Set<string>;
    this.store.select(getSelectedLayerIds).first().subscribe(ids => {
      layerIds = new Set(ids);
    });
    return layerIds;
  }

  getSelectedLayers() {
    let layers: ReadonlyArray<Layer>;
    this.store.select(getVectorLayer).first().subscribe(vl => {
      const layerIds = this.getSelectedLayerIds();
      layers = Array.from(layerIds).map(id => vl.findLayerById(id));
    });
    return layers;
  }

  private getSelectedBlockIds() {
    let blockIds: Set<string>;
    this.store.select(getSelectedBlockIds).first().subscribe(ids => {
      blockIds = new Set(ids);
    });
    return blockIds;
  }

  getSelectedBlocks() {
    let blocks: ReadonlyArray<AnimationBlock>;
    this.store.select(getAnimation).first().subscribe(anim => {
      const blockIds = this.getSelectedBlockIds();
      blocks = Array.from(blockIds).map(id => _.find(anim.blocks, b => b.id === id));
    });
    return blocks;
  }

  selectLayer(layerId: string, clearExisting: boolean) {
    const selectedLayerIds = this.getSelectedLayerIds();
    if (clearExisting) {
      selectedLayerIds.forEach(id => {
        if (id !== layerId) {
          selectedLayerIds.delete(id);
        }
      });
    }
    if (!clearExisting && selectedLayerIds.has(layerId)) {
      selectedLayerIds.delete(layerId);
    } else {
      selectedLayerIds.add(layerId);
    }
    this.store.dispatch(
      new MultiAction(
        new SetSelectedLayers(selectedLayerIds),
        new SelectAnimation(false),
        new SetSelectedBlocks(new Set()),
      ),
    );
  }

  selectBlock(blockId: string, clearExisting: boolean) {
    const selectedBlockIds = this.getSelectedBlockIds();
    if (clearExisting) {
      selectedBlockIds.forEach(id => {
        if (id !== blockId) {
          selectedBlockIds.delete(id);
        }
      });
    }
    if (!clearExisting && selectedBlockIds.has(blockId)) {
      selectedBlockIds.delete(blockId);
    } else {
      selectedBlockIds.add(blockId);
    }
    this.store.dispatch(
      new MultiAction(
        new SetSelectedBlocks(selectedBlockIds),
        new SelectAnimation(false),
        new SetSelectedLayers(new Set()),
      ),
    );
  }

  selectAnimation(isSelected: boolean) {
    this.store.dispatch(
      new MultiAction(
        new SetSelectedBlocks(new Set()),
        new SelectAnimation(isSelected),
        new SetSelectedLayers(new Set()),
      ),
    );
  }

  clearSelections() {
    this.store.dispatch(
      new MultiAction(
        new SetSelectedBlocks(new Set()),
        new SelectAnimation(false),
        new SetSelectedLayers(new Set()),
      ),
    );
  }
}
