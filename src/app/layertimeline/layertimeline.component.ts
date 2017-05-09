import * as _ from 'lodash';
import * as $ from 'jquery';
import {
  Component, OnInit, ChangeDetectionStrategy, OnDestroy,
} from '@angular/core';

import { Callbacks as TimelineAnimationRowCallbacks } from './timelineanimationrow.component';
import { Callbacks as LayerListTreeCallbacks } from './layerlisttree.component';
import { ScrubEvent } from './layertimeline.directive';

import { VectorLayer, Layer, GroupLayer, LayerUtil, PathLayer, ClipPathLayer } from '../scripts/layers';
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
  ReplaceVectorLayer,
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
  private vectorLayers: ReadonlyArray<VectorLayer>;

  layerTimelineModel$: Observable<LayerTimelineModel>;

  constructor(private readonly store: Store<State>) { }

  ngOnInit() {
    this.layerTimelineModel$ = Observable.combineLatest(
      this.store.select(getAnimations),
      this.store.select(getVectorLayers),
      this.store.select(getSelectedAnimationId),
      this.store.select(getActiveAnimationId),
    ).map(([animations, vectorLayers, selectedAnimationId, activeAnimationId]) => {
      this.vectorLayers = vectorLayers;
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

    // TODO: make sure it is impossible to drag layers across different vector layers?
    const vectorLayers = this.vectorLayers;

    // tslint:disable-next-line
    new Dragger({
      direction: 'both',
      downX: mouseDownEvent.clientX,
      downY: mouseDownEvent.clientY,

      onBeginDragFn: () => {
        // console.info('onBeginDragStart');
        this.shouldSuppressClick = true;

        // build up a list of all layers ordered by Y position
        orderedLayerInfos = [];
        scrollerRect = $scroller.get(0).getBoundingClientRect();
        const scrollTop = $scroller.scrollTop();
        $layersList.find('.slt-layer-container').each((_, element) => {
          // toString() is necessary because JQuery converts the ID into a number.
          const layerId: string = ($(element).data('layer-id') || '').toString();
          if (!layerId) {
            // The root layer doesn't have an ID set.
            // console.info('ignoring element:', element);
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

          const layer = this.findLayerById(layerId);
          orderedLayerInfos.push({
            layer,
            element,
            localRect: rect,
          });

          // Add a fake target for empty groups.
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
        // console.info('onBeginDragEnd');
      },

      onDragFn: event => {
        // console.info('onDragStart');
        const localEventY = event.clientY - scrollerRect.top + $scroller.scrollTop();
        // Find the target layer and edge (top or bottom).
        // console.info('targetLayerInfo=', undefined);
        targetLayerInfo = undefined;
        let minDistance = Infinity;
        let minDistanceIndent = Infinity; // Tie break to most indented layer.
        for (let i = 0; i < orderedLayerInfos.length; i++) {
          const layerInfo = orderedLayerInfos[i];

          // Skip if mouse to the left of this layer.
          if (event.clientX < layerInfo.localRect.left) {
            continue;
          }

          for (const edge of ['top', 'bottom']) {
            // Test distance to top edge.
            const distance = Math.abs(localEventY - layerInfo.localRect[edge]);
            const indent = layerInfo.localRect.left;
            if (distance <= minDistance) {
              if (distance !== minDistance || indent > minDistanceIndent) {
                minDistance = distance;
                minDistanceIndent = indent;
                // console.info('targetLayerInfo=', layerInfo);
                targetLayerInfo = layerInfo;
                targetEdge = edge;
              }
            }
          }
        }

        // Disallow dragging a layer into itself or its children.
        if (targetLayerInfo) {
          let layer = targetLayerInfo.layer;
          while (layer) {
            if (layer === dragLayer) {
              // console.info('targetLayerInfo=', undefined);
              targetLayerInfo = undefined;
              break;
            }
            layer = LayerUtil.findParent(this.vectorLayers, layer.id);
          }
        }

        if (targetLayerInfo && targetEdge === 'bottom'
          && LayerUtil.findNextSibling(this.vectorLayers, targetLayerInfo.layer.id) === dragLayer) {
          // console.info('targetLayerInfo=', undefined);
          targetLayerInfo = undefined;
        }

        const dragIndicatorInfo: DragIndicatorInfo = { isVisible: !!targetLayerInfo };
        if (targetLayerInfo) {
          dragIndicatorInfo.left = targetLayerInfo.localRect.left;
          dragIndicatorInfo.top = targetLayerInfo.localRect[targetEdge];
        }
        // console.info('updateDragIndicator', dragIndicatorInfo);
        this.updateDragIndicator(dragIndicatorInfo);
        // console.info('onDragEnd');
      },

      onDropFn: () => {
        // console.info('onDropStart');
        this.updateDragIndicator({ isVisible: false });
        // console.info('updateDragIndicator finished');

        if (targetLayerInfo) {
          const root = LayerUtil.findVectorLayer(this.vectorLayers, dragLayer.id);
          let replacementVl: VectorLayer;
          if (targetLayerInfo.moveIntoEmptyLayerGroup) {
            // Moving into an empty layer group.
            console.log('remove start');
            replacementVl = LayerUtil.removeLayerFromTree(this.vectorLayers, dragLayer.id);
            console.log('remove end');
            // dragLayer = dragLayer.clone();
            const newParent = targetLayerInfo.layer;
            console.log('add start');
            replacementVl =
              LayerUtil.addLayerToTree(
                replacementVl, newParent.id, dragLayer.clone(), newParent.children.length);
            console.log('add end');
            // newParent.children.push(dragLayer);
            // dragLayer.parent = newParent;
          } else {
            // Moving next to another layer.
            let newParent = LayerUtil.findParent(this.vectorLayers, targetLayerInfo.layer.id);
            if (newParent) {
              console.log('remove start', this.vectorLayers, dragLayer, newParent);
              replacementVl = LayerUtil.removeLayerFromTree(this.vectorLayers, dragLayer.id);
              newParent = LayerUtil.findParent([replacementVl], targetLayerInfo.layer.id);
              console.log('remove end', replacementVl);
              let index =
                newParent.children
                  ? _.findIndex(newParent.children, child => child.id === targetLayerInfo.layer.id)
                  : -1;
              if (index >= 0) {
                index += (targetEdge === 'top') ? 0 : 1;
                console.log('add start', replacementVl, index);
                replacementVl =
                  LayerUtil.addLayerToTree(replacementVl, newParent.id, dragLayer.clone(), index);
                console.log('add end', replacementVl);
                // newParent.children.splice(index, 0, dragLayer);
                // dragLayer.parent = newParent;
              }
            }
          }
          if (replacementVl) {
            replacementVl.walk(l => {
              if (l instanceof PathLayer || l instanceof ClipPathLayer) {
                if (l.children.length) {
                  console.error(replacementVl);
                  throw new Error('group layer at invalid position');
                }
              }
            });
            setTimeout(() => {
              this.store.dispatch(new ReplaceVectorLayer(replacementVl));
            });
          }
        }

        setTimeout(() => this.shouldSuppressClick = false, 0);
        // console.info('onDropEnd');
      }
    });
  }

  private findLayerById(id: string) {
    for (const vl of this.vectorLayers) {
      const layer = vl.findLayerById(id);
      if (layer) {
        return layer;
      }
    }
    return undefined;
  }

  private updateDragIndicator(info: DragIndicatorInfo) {
    const curr = this.dragIndicatorSource.getValue();
    this.dragIndicatorSource.next(Object.assign({}, curr, info));
  }

  trackLayerFn(index: number, layer: Layer) {
    return layer.id;
  }

  trackAnimationFn(index: number, animation: Animation) {
    return animation.id;
  }
}

interface LayerTimelineModel {
  readonly animations: ReadonlyArray<Animation>;
  readonly vectorLayers: ReadonlyArray<VectorLayer>;
  readonly selectedAnimationId: string;
}

interface DragIndicatorInfo {
  left?: number;
  top?: number;
  isVisible?: boolean;
}
