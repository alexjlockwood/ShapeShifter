import { Component, OnInit, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { CanvasType } from '../CanvasType';
import { StateService, } from '../services';
import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';
import { VectorLayer, Layer, GroupLayer } from '../scripts/layers';
import { Dragger } from '../scripts/dragger';
import * as $ from 'jquery';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

declare const ga: Function;

const LAYER_INDENT_PIXELS = 20;

@Component({
  selector: 'app-vectorlist',
  templateUrl: './vectorlist.component.html',
  styleUrls: ['./vectorlist.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VectorListComponent implements OnInit, OnDestroy {

  // These are public because they are accessed via the HTML template.
  existingPathIdsObservable: Observable<ReadonlyArray<string>>;
  startActivePathIdObservable: Observable<string>;
  endActivePathIdObservable: Observable<string>;
  vectorLayersObservable: Observable<ReadonlyArray<VectorLayer>>;

  private isHoveringOverListItem = new Map<string, boolean>();
  private isHoveringOverOverflow = new Map<string, boolean>();
  private readonly subscriptions: Subscription[] = [];

  private shouldSuppressClick = false;

  dragIndicatorSource = new BehaviorSubject<DragIndicatorInfo>({ isVisible: false, left: 0, top: 0 });

  constructor(private readonly stateService: StateService) { }

  ngOnInit() {
    this.startActivePathIdObservable = this.stateService.getActivePathIdObservable(CanvasType.Start);
    this.endActivePathIdObservable = this.stateService.getActivePathIdObservable(CanvasType.End);
    this.existingPathIdsObservable = this.stateService.getExistingPathIdsObservable();
    this.existingPathIdsObservable.subscribe(() => {
      this.isHoveringOverListItem.clear();
      this.isHoveringOverOverflow.clear();
    });
    this.vectorLayersObservable = this.stateService.getVectorLayersObservable();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  layerClick(event: MouseEvent, layer: Layer) { }

  layerDoubleClick(event: MouseEvent, layer: Layer) { }

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
    let targetLayerInfo: LayerInfo = undefined;
    let targetEdge: string;

    // TODO: need to add the scroller.
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
            rect = Object.assign({}, rect, { left: rect.left + LAYER_INDENT_PIXELS, top: rect.bottom });
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
            newParent.children.push(dragLayer);
            dragLayer.parent = newParent;
          } else {
            // moving next to another layer
            const newParent = targetLayerInfo.layer.parent;
            if (newParent) {
              dragLayer.remove();
              let index = newParent.children ? newParent.children.indexOf(targetLayerInfo.layer) : -1;
              if (index >= 0) {
                index += (targetEdge === 'top') ? 0 : 1;
                newParent.children.splice(index, 0, dragLayer);
                dragLayer.parent = newParent;
              }
            }
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

  // TODO: figure out if this is right
  private findLayerById(id: string) {
    const vls = this.stateService.getImportedVectorLayers();
    for (const vl of vls) {
      const layer = vl.findLayer(id);
      if (layer) {
        return layer;
      }
    }
    return undefined;
  }
}

interface DragIndicatorInfo {
  left?: number;
  top?: number;
  isVisible?: boolean;
}
