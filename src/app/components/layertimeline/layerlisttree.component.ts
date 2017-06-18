import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { ModelUtil } from 'app/scripts/common';
import {
  GroupLayer,
  Layer,
  VectorLayer,
} from 'app/scripts/model/layers';
import { Animation } from 'app/scripts/model/timeline';
import { ActionModeService } from 'app/services';
import {
  State,
  Store,
} from 'app/store';
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
  @Output() onLayerClick = new EventEmitter<LayerEvent>();
  @Output() onLayerDoubleClick = new EventEmitter<LayerEvent>();
  @Output() onLayerMouseDown = new EventEmitter<LayerEvent>();
  @Output() onLayerToggleExpanded = new EventEmitter<LayerEvent>();
  @Output() onLayerToggleVisibility = new EventEmitter<LayerEvent>();
  @Output() onAddTimelineBlockClick = new EventEmitter<TimelineBlockEvent>();

  constructor(
    private readonly store: Store<State>,
    private readonly actionModeService: ActionModeService,
  ) { }

  ngOnInit() {
    this.layerModel$ =
      this.store.select(getLayerListTreeState)
        .map(({ animation, selectedLayerIds, collapsedLayerIds, hiddenLayerIds, isActionMode }) => {
          const isExpandable = this.isLayerExpandable();
          const availablePropertyNames =
            Array.from(ModelUtil.getAvailablePropertyNamesForLayer(this.layer, animation));
          const existingPropertyNames =
            Array.from(_.keys(ModelUtil.getOrderedBlocksByPropertyByLayer(animation)[this.layer.id]));
          return {
            animation,
            isSelected: selectedLayerIds.has(this.layer.id),
            isExpandable,
            isExpanded: !collapsedLayerIds.has(this.layer.id),
            isVisible: !hiddenLayerIds.has(this.layer.id),
            availablePropertyNames,
            existingPropertyNames,
            isActionMode,
          };
        });
  }

  // @Override Callbacks
  layerClick(event: MouseEvent, layer: Layer) {
    event.stopPropagation();
    if (!this.actionModeService.isActionMode()) {
      this.onLayerClick.emit({ event, layer });
    }
  }

  // @Override Callbacks
  layerMouseDown(event: MouseEvent, layer: Layer) {
    if (!this.actionModeService.isActionMode()) {
      this.onLayerMouseDown.emit({ event, layer });
    }
  }

  // @Override Callbacks
  layerToggleExpanded(event: MouseEvent, layer: Layer) {
    event.stopPropagation();
    if (this.isLayerExpandable()) {
      this.onLayerToggleExpanded.emit({ event, layer });
    }
  }

  // @Override Callbacks
  layerToggleVisibility(event: MouseEvent, layer: Layer) {
    event.stopPropagation();
    if (!this.actionModeService.isActionMode()) {
      this.onLayerToggleVisibility.emit({ event, layer });
    }
  }

  // @Override Callbacks
  addTimelineBlockClick(event: MouseEvent, layer: Layer, propertyName: string) {
    event.stopPropagation();
    if (!this.actionModeService.isActionMode()) {
      this.onAddTimelineBlockClick.emit({ event, layer, propertyName });
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
  readonly animation: Animation;
  readonly isSelected: boolean;
  readonly isExpandable: boolean;
  readonly isExpanded: boolean;
  readonly isVisible: boolean;
  readonly availablePropertyNames: ReadonlyArray<string>;
  readonly existingPropertyNames: ReadonlyArray<string>;
  readonly isActionMode: boolean;
}
