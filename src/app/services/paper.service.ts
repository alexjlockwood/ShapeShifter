import 'rxjs/add/operator/first';

import { Injectable } from '@angular/core';
import { ToolMode } from 'app/model/paper';
import { State, Store } from 'app/store';
import { SetHoveredLayer } from 'app/store/layers/actions';
import { getHoveredLayerId, getSelectedLayerIds, getVectorLayer } from 'app/store/layers/selectors';
import { SetFillColor, SetStrokeColor, SetToolMode } from 'app/store/paper/actions';
import { getFillColor, getStrokeColor, getToolMode } from 'app/store/paper/selectors';
import { OutputSelector } from 'reselect';

import { LayerTimelineService } from './layertimeline.service';

/**
 * A simple service that provides an interface for making paper.js changes.
 */
@Injectable()
export class PaperService {
  constructor(
    private readonly layerTimelineService: LayerTimelineService,
    private readonly store: Store<State>,
  ) {}

  // Layers.

  selectLayer(layerId: string, clearExisting: boolean) {
    this.layerTimelineService.selectLayer(layerId, clearExisting);
  }

  clearSelections() {
    this.layerTimelineService.clearSelections();
  }

  /** Sets the hovered layer. */
  setHoveredLayer(layerId: string | undefined) {
    if (this.queryStore(getHoveredLayerId) !== layerId) {
      this.store.dispatch(new SetHoveredLayer(layerId));
    }
  }

  /** Clears an existing hovered layer. */
  clearHoveredLayer() {
    this.setHoveredLayer(undefined);
  }

  getVectorLayerObservable() {
    return this.store.select(getVectorLayer);
  }

  getSelectedLayerIdsObservable() {
    return this.store.select(getSelectedLayerIds);
  }

  getHoveredLayerIdObservable() {
    return this.store.select(getHoveredLayerId);
  }

  // Tool modes.

  setToolMode(toolMode: ToolMode) {
    if (this.getToolMode() !== toolMode) {
      this.store.dispatch(new SetToolMode(toolMode));
    }
  }

  getToolMode() {
    return this.queryStore(getToolMode);
  }

  getToolModeObservable() {
    return this.store.select(getToolMode);
  }

  // Fill/stroke colors.

  getFillColorObservable() {
    return this.store.select(getFillColor);
  }

  getStrokeColorObservable() {
    return this.store.select(getStrokeColor);
  }

  getFillColor() {
    return this.queryStore(getFillColor);
  }

  setFillColor(fillColor: string) {
    if (this.getFillColor() !== fillColor) {
      this.store.dispatch(new SetFillColor(fillColor));
    }
  }

  getStrokeColor() {
    return this.queryStore(getStrokeColor);
  }

  setStrokeColor(strokeColor: string) {
    if (this.getStrokeColor() !== strokeColor) {
      this.store.dispatch(new SetStrokeColor(strokeColor));
    }
  }

  private queryStore<T>(selector: OutputSelector<Object, T, (res: Object) => T>) {
    let obj: T;
    this.store
      .select(selector)
      .first()
      .subscribe(o => (obj = o));
    return obj;
  }
}
