import * as _ from 'lodash';
import {
  Component, OnInit, Input, ChangeDetectionStrategy,
  Output, EventEmitter, ViewEncapsulation
} from '@angular/core';
import { Layer } from '../scripts/layers';
import { ModelUtil } from '../scripts/common';
import { Animation } from '../scripts/animations';
import { Store } from '@ngrx/store';
import {
  State,
  getAnimations,
  getSelectedLayerIds,
  getCollapsedLayerIds,
  getHiddenLayerIds,
} from '../scripts/store/reducers';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/combineLatest';

@Component({
  selector: 'app-layerlisttree',
  templateUrl: './layerlisttree.component.html',
  styleUrls: ['./layerlisttree.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // TODO: remove view encapsulation.
  encapsulation: ViewEncapsulation.None,
})
export class LayerListTreeComponent implements OnInit, Callbacks {

  layerModel$: Observable<LayerModel>;

  @Input() layer: Layer;

  // MouseEvents from this layer (or children layers further down the tree)
  // are recursively handled by parent components until they reach
  // the LayerTimelineComponent.
  @Output() onLayerClick = new EventEmitter<LayerEvent>();
  @Output() onLayerDoubleClick = new EventEmitter<LayerEvent>();
  @Output() onLayerMouseDown = new EventEmitter<LayerEvent>();
  @Output() onLayerToggleExpanded = new EventEmitter<LayerEvent>();
  @Output() onLayerToggleVisibility = new EventEmitter<LayerEvent>();
  @Output() onAddTimelineBlockClick = new EventEmitter<TimelineBlockEvent>();

  constructor(private readonly store: Store<State>) { }

  ngOnInit() {
    this.layerModel$ = Observable.combineLatest(
      this.store.select(getAnimations),
      this.store.select(getSelectedLayerIds),
      this.store.select(getCollapsedLayerIds),
      this.store.select(getHiddenLayerIds),
    ).map(([animations, selectedLayerIds, collapsedLayerIds, hiddenLayerIds]) => {
      const isExpandable = this.layer.isVectorLayer() || this.layer.isGroupLayer();
      const availablePropertyNames =
        Array.from(ModelUtil.getAvailablePropertyNamesForLayer(this.layer, animations));
      const existingPropertyNames =
        Array.from(
          _.keys(ModelUtil.getBlocksByAnimationByProperty(this.layer.id, animations)));
      return {
        animations,
        isSelected: selectedLayerIds.has(this.layer.id),
        isExpandable,
        isExpanded: !collapsedLayerIds.has(this.layer.id),
        isVisible: !hiddenLayerIds.has(this.layer.id),
        availablePropertyNames,
        existingPropertyNames,
      }
    });
  }

  // @Override Callbacks
  layerClick(event: MouseEvent, layer: Layer) {
    this.onLayerClick.emit({ event, layer });
  }

  // @Override Callbacks
  layerMouseDown(event: MouseEvent, layer: Layer) {
    this.onLayerMouseDown.emit({ event, layer });
  }

  // @Override Callbacks
  layerToggleExpanded(event: MouseEvent, layer: Layer) {
    this.onLayerToggleExpanded.emit({ event, layer });
    event.stopPropagation();
  }

  // @Override Callbacks
  layerToggleVisibility(event: MouseEvent, layer: Layer) {
    this.onLayerToggleVisibility.emit({ event, layer });
    event.stopPropagation();
  }

  // @Override Callbacks
  addTimelineBlockClick(event: MouseEvent, layer: Layer, propertyName: string) {
    this.onAddTimelineBlockClick.emit({ event, layer, propertyName });
  }

  // Used by *ngFor loop.
  trackLayerFn(index: number, layer: Layer) {
    return layer.id;
  }
}

export interface Callbacks {
  layerClick(event: MouseEvent, layer: Layer);
  layerMouseDown(event: MouseEvent, layer: Layer);
  layerToggleExpanded(event: MouseEvent, layer: Layer);
  layerToggleVisibility(event: MouseEvent, layer: Layer);
  addTimelineBlockClick(event: MouseEvent, layer: Layer, propertyName: string);
}

interface LayerEvent {
  readonly event: MouseEvent;
  readonly layer: Layer;
}

interface TimelineBlockEvent {
  readonly event: MouseEvent;
  readonly layer: Layer;
  readonly propertyName: string;
}

interface LayerModel {
  readonly animations: ReadonlyArray<Animation>;
  readonly isSelected: boolean;
  readonly isExpandable: boolean;
  readonly isExpanded: boolean;
  readonly isVisible: boolean;
  readonly availablePropertyNames: ReadonlyArray<string>;
  readonly existingPropertyNames: ReadonlyArray<string>;
}
