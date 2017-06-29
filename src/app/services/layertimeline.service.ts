import 'rxjs/add/operator/first';
import 'rxjs/add/observable/combineLatest';

import { Injectable } from '@angular/core';
import { Layer, LayerUtil, VectorLayer } from 'app/scripts/model/layers';
import { AnimationBlock } from 'app/scripts/model/timeline';
import { State, Store } from 'app/store';
import {
  ReplaceLayer,
  SetCollapsedLayers,
  SetHiddenLayers,
  SetSelectedLayers,
} from 'app/store/layers/actions';
import {
  getCollapsedLayerIds,
  getHiddenLayerIds,
  getSelectedLayerIds,
  getVectorLayer,
} from 'app/store/layers/selectors';
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

  /**
   * Selects or deselects the animation.
   */
  selectAnimation(isSelected: boolean) {
    this.updateSelections(isSelected, new Set(), new Set());
  }

  /**
   * Selects or deselects the specified block ID.
   */
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
    this.updateSelections(false, selectedBlockIds, new Set());
  }

  /**
   * Selects or deselects the specified layer ID.
   */
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
    this.updateSelections(false, new Set(), selectedLayerIds);
  }

  /**
   * Clears all animation/block/layer selections.
   */
  clearSelections() {
    this.updateSelections(false, new Set(), new Set());
  }

  private updateSelections(
    isAnimationSelected: boolean,
    selectedBlockIds: Set<string>,
    selectedLayerIds: Set<string>,
  ) {
    this.store.dispatch(
      new MultiAction(
        new SelectAnimation(isAnimationSelected),
        new SetSelectedBlocks(selectedBlockIds),
        new SetSelectedLayers(selectedLayerIds),
      ),
    );
  }

  /**
   * Toggles the specified layer's expanded state.
   */
  toggleExpandedLayer(layerId: string, recursive: boolean) {
    const layerIds = new Set([layerId]);
    if (recursive) {
      const layer = this.getVectorLayer().findLayerById(layerId);
      if (layer) {
        layer.walk(l => layerIds.add(l.id));
      }
    }
    const collapsedLayerIds = this.getCollapsedLayerIds();
    if (collapsedLayerIds.has(layerId)) {
      layerIds.forEach(id => collapsedLayerIds.delete(id));
    } else {
      layerIds.forEach(id => collapsedLayerIds.add(id));
    }
    this.store.dispatch(new SetCollapsedLayers(layerIds));
  }

  /**
   * Toggles the specified layer's visibility.
   */
  toggleVisibleLayer(layerId: string) {
    const layerIds = this.getHiddenLayerIds();
    if (layerIds.has(layerId)) {
      layerIds.delete(layerId);
    } else {
      layerIds.add(layerId);
    }
    this.store.dispatch(new SetHiddenLayers(layerIds));
  }

  importLayers(vls: ReadonlyArray<VectorLayer>) {
    if (!vls.length) {
      return;
    }
    const importedVls = vls.slice();
    const vectorLayer = this.getVectorLayer();
    let vectorLayers = [vectorLayer];
    if (!vectorLayer.children.length) {
      // Simply replace the empty vector layer rather than merging with it.
      const vl = importedVls[0].clone();
      vl.name = vl.name;
      importedVls[0] = vl;
      vectorLayers = [];
    }
    const newVectorLayers = [...vectorLayers, ...importedVls];
    const replacementVl =
      newVectorLayers.length === 1
        ? newVectorLayers[0]
        : newVectorLayers.reduce(LayerUtil.mergeVectorLayers);
    this.store.dispatch(new ReplaceLayer(replacementVl));
  }

  /**
   * Adds a layer to the vector tree.
   */
  addLayer(layer: Layer) {
    const vl = this.getVectorLayer();
    const selectedLayers = this.getSelectedLayers();
    if (selectedLayers.length === 1) {
      const selectedLayer = selectedLayers[0];
      if (!(selectedLayer instanceof VectorLayer)) {
        // Add the new layer as a sibling to the currently selected layer.
        const parent = LayerUtil.findParent(vl, selectedLayer.id).clone();
        const children = parent.children.slice();
        parent.children = children.concat([layer]);
        this.store.dispatch(new ReplaceLayer(LayerUtil.replaceLayerInTree(vl, parent)));
        return;
      }
    }
    const vectorLayer = vl.clone();
    vl.children = vl.children.concat([layer]);
    this.store.dispatch(new ReplaceLayer(vl));
  }

  getVectorLayer() {
    let vectorLayer: VectorLayer;
    this.store.select(getVectorLayer).first().subscribe(vl => (vectorLayer = vl));
    return vectorLayer;
  }

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

  private getHiddenLayerIds() {
    let layerIds: Set<string>;
    this.store.select(getHiddenLayerIds).first().subscribe(ids => {
      layerIds = new Set(ids);
    });
    return layerIds;
  }

  private getCollapsedLayerIds() {
    let layerIds: Set<string>;
    this.store.select(getCollapsedLayerIds).first().subscribe(ids => {
      layerIds = new Set(ids);
    });
    return layerIds;
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
}
