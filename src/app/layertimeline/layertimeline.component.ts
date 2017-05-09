import * as _ from 'lodash';
import * as $ from 'jquery';
import {
  Component, OnInit, ChangeDetectionStrategy, OnDestroy,
} from '@angular/core';

import { Callbacks as TimelineAnimationRowCallbacks } from './timelineanimationrow.component';
import { Callbacks as LayerListTreeCallbacks } from './layerlisttree.component';
import { ScrubEvent } from './layertimeline.directive';

import { VectorLayer, Layer, GroupLayer } from '../scripts/layers';
import { Animation, AnimationBlock } from '../scripts/animations';
import { Dragger } from '../scripts/dragger';

import { Store } from '@ngrx/store';
import {
  State,
  getAnimations,
  getVectorLayers,
  getSelectedAnimationId,
  getActiveAnimationId,
} from '../scripts/store/reducers';
import {
  AddAnimations,
  SelectAnimationId,
  ActivateAnimationId,
  AddAnimationBlock,
  AddVectorLayers,
  SelectLayerId,
  ToggleLayerIdExpansion,
  ToggleLayerIdVisibility,
} from '../scripts/store/actions';
import { Observable } from 'rxjs/Observable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import 'rxjs/add/observable/combineLatest';

const LAYER_INDENT_PIXELS = 20;

@Component({
  selector: 'app-layertimeline',
  templateUrl: './layertimeline.component.html',
  styleUrls: ['./layertimeline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayerTimelineComponent implements
  OnInit,
  TimelineAnimationRowCallbacks,
  LayerListTreeCallbacks {

  // Layer timeline variables.
  horizZoom = 2; // 1ms = 2px
  activeTime = 10;
  private shouldSuppressClick = false;
  dragIndicatorSource = new BehaviorSubject<DragIndicatorInfo>({
    isVisible: false, left: 0, top: 0,
  });

  layerTimelineModel$: Observable<LayerTimelineModel>;

  constructor(private readonly store: Store<State>) { }

  ngOnInit() {
    this.layerTimelineModel$ = Observable.combineLatest(
      this.store.select(getAnimations),
      this.store.select(getVectorLayers),
      this.store.select(getSelectedAnimationId),
      this.store.select(getActiveAnimationId),
    ).map(([animations, vectorLayers, selectedAnimationId, activeAnimationId]) => {
      return {
        animations,
        vectorLayers,
        selectedAnimationId,
        activeAnimationId,
      }
    });
  }

  // Called from the LayerTimelineComponent template.
  animationHeaderTextClick(event: MouseEvent, animation: Animation) {
    this.store.dispatch(new SelectAnimationId(animation.id));
  }

  // Called from the LayerTimelineComponent template.
  timelineHeaderScrub(event: ScrubEvent) {
    // TODO: implement this
  }

  // Called from the LayerTimelineComponent template.
  timelineBlockClick(
    event: MouseEvent,
    block: AnimationBlock<any>,
    animation: Animation,
    layer: Layer,
  ) {
    // TODO: implement this
  }

  // @Override TimelineAnimationRowCallbacks
  animationTimelineMouseDown(event: MouseEvent, animation: Animation) {
    this.store.dispatch(new ActivateAnimationId(animation.id));
  }

  // @Override TimelineAnimationRowCallbacks
  timelineBlockMouseDown(
    event: MouseEvent,
    block: AnimationBlock<any>,
    animation: Animation,
    layer: Layer,
  ) {
    // TODO: implement this
  }

  // @Override LayerListTreeComponentCallbacks
  addTimelineBlockClick(
    event: MouseEvent,
    layer: Layer,
    propertyName: string,
  ) {
    this.store.dispatch(new AddAnimationBlock(layer, propertyName));
  }

  // @Override LayerListTreeComponentCallbacks
  layerClick(event: MouseEvent, layer: Layer) {
    const clearExisting = !event.metaKey && !event.shiftKey;
    this.store.dispatch(new SelectLayerId(layer.id, clearExisting));
  }

  // @Override LayerListTreeComponentCallbacks
  layerToggleExpanded(event: MouseEvent, layer: Layer) {
    const recursive = event.metaKey || event.shiftKey
    this.store.dispatch(new ToggleLayerIdExpansion(layer.id, recursive));
    event.stopPropagation();
  }

  // @Override LayerListTreeComponentCallbacks
  layerToggleVisibility(event: MouseEvent, layer: Layer) {
    this.store.dispatch(new ToggleLayerIdVisibility(layer.id));
    event.stopPropagation();
  }

  // @Override LayerListTreeComponentCallbacks
  layerMouseDown(mouseDownEvent: MouseEvent, dragLayer: Layer) {
    const $layersList = $(mouseDownEvent.target).parents('.slt-layers-list');
    const $scroller = $(mouseDownEvent.target).parents('.slt-layers-list-scroller');

    interface LayerInfo {
      layer: Layer;
      element: Element;
      localRect: ClientRect;
      moveIntoEmptyLayerGroup?: boolean;
    }
    let orderedLayerInfos: LayerInfo[] = [];
    let scrollerRect: ClientRect;
    let targetLayerInfo: LayerInfo;
    let targetEdge: string;

    // TODO: need to rethink this... we can't mutate the layers directly anymore like this
    // tslint:disable-next-line
    new Dragger({
      direction: 'both',
      downX: mouseDownEvent.clientX,
      downY: mouseDownEvent.clientY,

      onBeginDragFn: () => {
        this.shouldSuppressClick = true;

        // build up a list of all layers ordered by Y position
        orderedLayerInfos = [];
        scrollerRect = $scroller.get(0).getBoundingClientRect();
        const scrollTop = $scroller.scrollTop();
        $layersList.find('.slt-layer-container').each((i, element) => {
          if (!$(element).data('layer-id')) {
            // the artwork root layer doesn't have an ID set
            return;
          }

          let rect = element.getBoundingClientRect();
          rect = {
            left: rect.left,
            top: rect.top + scrollTop - scrollerRect.top,
            bottom: rect.bottom + scrollTop - scrollerRect.top,
            height: rect.height,
            right: rect.right,
            width: rect.width,
          };

          const layer = this.findLayerById($(element).data('layer-id'));
          orderedLayerInfos.push({
            layer,
            element,
            localRect: rect,
          });

          // add a fake target for empty groups
          if (layer instanceof GroupLayer && !layer.children.length) {
            rect = Object.assign({}, rect, {
              left: rect.left + LAYER_INDENT_PIXELS, top: rect.bottom,
            });
            orderedLayerInfos.push({
              layer,
              element,
              localRect: rect,
              moveIntoEmptyLayerGroup: true,
            });
          }
        });

        orderedLayerInfos.sort((a, b) => a.localRect.top - b.localRect.top);
        this.updateDragIndicator({ isVisible: true, left: 0, top: 0 });
      },

      onDragFn: event => {
        const localEventY = event.clientY - scrollerRect.top + $scroller.scrollTop();
        // find the target layer and edge (top or bottom)
        targetLayerInfo = undefined;
        let minDistance = Infinity;
        let minDistanceIndent = Infinity; // tie break to most indented layer
        for (let i = 0; i < orderedLayerInfos.length; i++) {
          const layerInfo = orderedLayerInfos[i];

          // skip if mouse to the left of this layer
          if (event.clientX < layerInfo.localRect.left) {
            continue;
          }

          for (const edge of ['top', 'bottom']) {
            // test distance to top edge
            const distance = Math.abs(localEventY - layerInfo.localRect[edge]);
            const indent = layerInfo.localRect.left;
            if (distance <= minDistance) {
              if (distance !== minDistance || indent > minDistanceIndent) {
                minDistance = distance;
                minDistanceIndent = indent;
                targetLayerInfo = layerInfo;
                targetEdge = edge;
              }
            }
          }
        }

        // disallow dragging a layer into itself or its children
        if (targetLayerInfo) {
          let layer = targetLayerInfo.layer;
          while (layer) {
            if (layer === dragLayer) {
              targetLayerInfo = undefined;
              break;
            }
            layer = layer.parent;
          }
        }

        if (targetLayerInfo && targetEdge === 'bottom'
          && targetLayerInfo.layer.nextSibling === dragLayer) {
          targetLayerInfo = undefined;
        }

        const dragIndicatorInfo: DragIndicatorInfo = { isVisible: !!targetLayerInfo };
        if (targetLayerInfo) {
          dragIndicatorInfo.left = targetLayerInfo.localRect.left;
          dragIndicatorInfo.top = targetLayerInfo.localRect[targetEdge];
        }
        this.updateDragIndicator(dragIndicatorInfo);
      },

      onDropFn: () => {
        this.updateDragIndicator({ isVisible: false });

        if (targetLayerInfo) {
          // this.scope_.$apply(() => {
          if (targetLayerInfo.moveIntoEmptyLayerGroup) {
            // moving into an empty layer group
            const newParent = targetLayerInfo.layer;
            dragLayer.remove();
            dragLayer = dragLayer.deepClone();
            newParent.children.push(dragLayer);
            dragLayer.parent = newParent;
          } else {
            // moving next to another layer
            const newParent = targetLayerInfo.layer.parent;
            if (newParent) {
              dragLayer.remove();
              let index =
                newParent.children
                  ? _.findIndex(newParent.children, child => child.id === targetLayerInfo.layer.id)
                  : -1;
              if (index >= 0) {
                index += (targetEdge === 'top') ? 0 : 1;
                newParent.children.splice(index, 0, dragLayer);
                dragLayer.parent = newParent;
              }
            }
            // TODO: make the change in a reducer instead of mutating directly...
            // this.stateService.addVectorLayers([]); // notify change
          }

          // this.studioState_.artworkChanged();
          // });
        }

        // this.timeout_(() => this.shouldSuppressClick = false, 0);
      }
    });
  }

  private updateDragIndicator(info: DragIndicatorInfo) {
    const curr = this.dragIndicatorSource.getValue();
    this.dragIndicatorSource.next(Object.assign({}, curr, info));
  }

  // TODO: see TODO above... this will no longer work.
  private findLayerById(id: string) {
    // const vls = this.stateService.getImportedVectorLayers();
    // for (const vl of vls) {
    //   const layer = vl.findLayer(id);
    //   if (layer) {
    //     return layer;
    //   }
    // }
    return undefined;
  }

  trackLayerFn(index: number, layer: Layer) {
    return layer.id;
  }

  trackAnimationFn(index: number, animation: Animation) {
    return animation.id;
  }
}

interface LayerTimelineModel {
  animations: ReadonlyArray<Animation>;
  vectorLayers: ReadonlyArray<VectorLayer>;
  selectedAnimationId: string;
}

interface DragIndicatorInfo {
  left?: number;
  top?: number;
  isVisible?: boolean;
}
