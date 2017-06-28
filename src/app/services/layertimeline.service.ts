import 'rxjs/add/operator/first';
import 'rxjs/add/observable/combineLatest';

import { Injectable } from '@angular/core';
import { Layer } from 'app/scripts/model/layers';
import { AnimationBlock } from 'app/scripts/model/timeline';
import { State, Store } from 'app/store';
import { getSelectedLayerIds, getVectorLayer } from 'app/store/layers/selectors';
import { getAnimation, getSelectedBlockIds } from 'app/store/timeline/selectors';
import * as _ from 'lodash';
import { Observable } from 'rxjs/Observable';

/**
 * A simple service that provides an interface for making layer/timeline changes.
*/
@Injectable()
export class LayerTimelineService {
  constructor(private readonly store: Store<State>) {}

  getSelectedLayers() {
    let layers: Layer[];
    Observable.combineLatest(
      this.store.select(getVectorLayer),
      this.store.select(getSelectedLayerIds),
    )
      .first()
      .subscribe(([vl, ids]) => {
        layers = Array.from(ids).map(id => vl.findLayerById(id));
      });
    return layers;
  }

  getSelectedBlocks() {
    let blocks: AnimationBlock[];
    Observable.combineLatest(
      this.store.select(getAnimation),
      this.store.select(getSelectedBlockIds),
    )
      .first()
      .subscribe(([anim, ids]) => {
        blocks = Array.from(ids).map(id => _.find(anim.blocks, b => b.id === id));
      });
    return blocks;
  }
}
