import 'rxjs/add/operator/map';

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { ClipPathLayer, GroupLayer, Layer, PathLayer, VectorLayer } from 'app/model/layers';
import { Animation } from 'app/model/timeline';
import { ModelUtil } from 'app/scripts/common';
import { ActionModeService } from 'app/services';
import { State, Store } from 'app/store';
import { getLayerListTreeState } from 'app/store/common/selectors';
import * as _ from 'lodash';
import { Observable } from 'rxjs/Observable';

@Component({
  selector: 'app-layerlisttree',
  templateUrl: './layerlisttree.component.html',
  styleUrls: ['./layerlisttree.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayerListTreeComponent implements OnInit, Callbacks {
  layerModel$: Observable<LayerModel>;

  @Input() layer: Layer;

  // MouseEvents from this layer (or children layers further down the tree)
  // are recursively handled by parent components until they reach
  // the LayerTimelineComponent.
  @Output() layerClick = new EventEmitter<LayerEvent>();
  @Output() layerDoubleClick = new EventEmitter<LayerEvent>();
  @Output() layerMouseDown = new EventEmitter<LayerEvent>();
  @Output() layerToggleExpanded = new EventEmitter<LayerEvent>();
  @Output() layerToggleVisibility = new EventEmitter<LayerEvent>();
  @Output() addTimelineBlockClick = new EventEmitter<TimelineBlockEvent>();
  @Output() convertToClipPathClick = new EventEmitter<LayerEvent>();
  @Output() convertToPathClick = new EventEmitter<LayerEvent>();
  @Output() flattenGroupClick = new EventEmitter<LayerEvent>();

  constructor(
    private readonly store: Store<State>,
    private readonly actionModeService: ActionModeService,
  ) {}

  ngOnInit() {
    this.layerModel$ = this.store
      .select(getLayerListTreeState)
      .map(({ animation, selectedLayerIds, collapsedLayerIds, hiddenLayerIds, isActionMode }) => {
        const isExpandable = this.isLayerExpandable();
        const availablePropertyNames = Array.from(
          ModelUtil.getAvailablePropertyNamesForLayer(this.layer, animation),
        );
        const getExistingPropertyNamesFn = (layerId: string) => {
          return _.keys(ModelUtil.getOrderedBlocksByPropertyByLayer(animation)[layerId]);
        };
        const existingPropertyNames = getExistingPropertyNamesFn(this.layer.id);
        const isClipPathLayer = this.layer instanceof ClipPathLayer;
        const isPathLayer = this.layer instanceof PathLayer;
        const isMergeable =
          this.layer instanceof GroupLayer &&
          this.layer.children.length > 0 &&
          // TODO: allow merging groups w/ existing blocks in some cases?
          existingPropertyNames.length === 0 &&
          this.layer.children.every(l => {
            return (
              l instanceof PathLayer ||
              l instanceof ClipPathLayer ||
              // TODO: allow merging groups into groups w/ existing blocks in some cases?
              getExistingPropertyNamesFn(l.id).length === 0
            );
          });
        return {
          animation,
          isSelected: selectedLayerIds.has(this.layer.id),
          isExpandable,
          isExpanded: !collapsedLayerIds.has(this.layer.id),
          isVisible: !hiddenLayerIds.has(this.layer.id),
          availablePropertyNames,
          existingPropertyNames,
          isActionMode,
          isClipPathLayer,
          isPathLayer,
          isMorphableLayer: isClipPathLayer || isPathLayer,
          isMergeable,
        };
      });
  }

  // @Override Callbacks
  onLayerClick(event: MouseEvent, layer: Layer) {
    event.stopPropagation();
    if (!this.actionModeService.isActionMode()) {
      this.layerClick.emit({ event, layer });
    }
  }

  // @Override Callbacks
  onLayerMouseDown(event: MouseEvent, layer: Layer) {
    if (!this.actionModeService.isActionMode()) {
      this.layerMouseDown.emit({ event, layer });
    }
  }

  // @Override Callbacks
  onLayerToggleExpanded(event: MouseEvent, layer: Layer) {
    event.stopPropagation();
    if (this.isLayerExpandable()) {
      this.layerToggleExpanded.emit({ event, layer });
    }
  }

  // @Override Callbacks
  onLayerToggleVisibility(event: MouseEvent, layer: Layer) {
    event.stopPropagation();
    if (!this.actionModeService.isActionMode()) {
      this.layerToggleVisibility.emit({ event, layer });
    }
  }

  // @Override Callbacks
  onAddTimelineBlockClick(event: MouseEvent, layer: Layer, propertyName: string) {
    if (!this.actionModeService.isActionMode()) {
      this.addTimelineBlockClick.emit({ event, layer, propertyName });
    }
  }

  // @Override Callbacks
  onConvertToClipPathClick(event: MouseEvent, layer: Layer) {
    if (!this.actionModeService.isActionMode()) {
      this.convertToClipPathClick.emit({ event, layer });
    }
  }

  // @Override Callbacks
  onConvertToPathClick(event: MouseEvent, layer: Layer) {
    if (!this.actionModeService.isActionMode()) {
      this.convertToPathClick.emit({ event, layer });
    }
  }

  // @Override Callbacks
  onFlattenGroupClick(event: MouseEvent, layer: Layer) {
    if (!this.actionModeService.isActionMode()) {
      this.flattenGroupClick.emit({ event, layer });
    }
  }

  // Used by *ngFor loop.
  trackLayerFn(index: number, layer: Layer) {
    return layer.id;
  }

  private isLayerExpandable() {
    return this.layer instanceof VectorLayer || this.layer instanceof GroupLayer;
  }
}

export interface Callbacks {
  onLayerClick(event: MouseEvent, layer: Layer): void;
  onLayerMouseDown(event: MouseEvent, layer: Layer): void;
  onLayerToggleExpanded(event: MouseEvent, layer: Layer): void;
  onLayerToggleVisibility(event: MouseEvent, layer: Layer): void;
  onAddTimelineBlockClick(event: MouseEvent, layer: Layer, propertyName: string): void;
  onConvertToClipPathClick(event: MouseEvent, layer: Layer): void;
  onConvertToPathClick(event: MouseEvent, layer: Layer): void;
  onFlattenGroupClick(event: MouseEvent, layer: Layer): void;
}

// tslint:disable: no-unused-variable
interface LayerEvent {
  readonly event: MouseEvent;
  readonly layer: Layer;
}

// tslint:disable: no-unused-variable
interface TimelineBlockEvent {
  readonly event: MouseEvent;
  readonly layer: Layer;
  readonly propertyName: string;
}

interface LayerModel {
  readonly animation: Animation;
  readonly isSelected: boolean;
  readonly isExpandable: boolean;
  readonly isExpanded: boolean;
  readonly isVisible: boolean;
  readonly availablePropertyNames: ReadonlyArray<string>;
  readonly existingPropertyNames: ReadonlyArray<string>;
  readonly isActionMode: boolean;
}
