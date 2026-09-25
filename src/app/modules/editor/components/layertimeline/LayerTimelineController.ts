import { ActionMode } from 'app/modules/editor/model/actionmode';
import {
  ClipPathLayer,
  GroupLayer,
  Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import { Animation, AnimationBlock } from 'app/modules/editor/model/timeline';
import { trackEvent } from 'app/modules/editor/scripts/analytics';
import * as ModelUtil from 'app/modules/editor/scripts/common/ModelUtil';
import { getContentSize, getPosition } from 'app/modules/editor/scripts/dom';
import { Dragger } from 'app/modules/editor/scripts/dragger';
import { IntervalTree } from 'app/modules/editor/scripts/intervals';
import { DestroyableMixin } from 'app/modules/editor/scripts/mixins';
import type { EditorServices } from 'app/modules/editor/services/createEditorServices';
import { Shortcut, ShortcutService } from 'app/modules/editor/services/shortcut.service';
import { Duration } from 'app/modules/editor/services/snackbar.service';
import { State, Store } from 'app/modules/editor/store';
import { BatchAction } from 'app/modules/editor/store/batch/actions';
import { getLayerTimelineState, isWorkspaceDirty } from 'app/modules/editor/store/common/selectors';
import { SetSelectedLayers, SetVectorLayer } from 'app/modules/editor/store/layers/actions';
import { getVectorLayer } from 'app/modules/editor/store/layers/selectors';
import { ResetWorkspace } from 'app/modules/editor/store/reset/actions';
import { getAnimation } from 'app/modules/editor/store/timeline/selectors';
import { environment } from 'environments/environment';
import _ from 'lodash';
import type { RefObject } from 'react';

import * as TimelineConsts from './constants';
import type { ScrubEvent } from './TimelineGridRenderer';

const IS_DEV_BUILD = !environment.production;

// Distance in pixels from a snap point before snapping to the point.
const SNAP_PIXELS = 10;
const LAYER_INDENT_PIXELS = 20;
const MIN_BLOCK_DURATION = 10;
const MAX_ZOOM = 10;
const MIN_ZOOM = 0.01;
export const DEFAULT_HORIZ_ZOOM = 2; // 1ms = 2px.

enum MouseActions {
  // We are dragging a block to a different location on the timeline.
  Moving = 1,
  // Scales all selected blocks w/o altering their initial positions.
  ScalingUniformStart,
  ScalingUniformEnd,
  // Scales all blocks and also translates their initial positions.
  ScalingTogetherStart,
  ScalingTogetherEnd,
}

export interface LayerTimelineElements {
  readonly timeline: RefObject<HTMLElement | null>;
  readonly timelineAnimation: RefObject<HTMLElement | null>;
}

/** Updates the layer timeline's React state. */
export interface LayerTimelineView {
  setHorizZoom(horizZoom: number): void;
  setDragIndicator(info: DragIndicatorInfo): void;
}

/**
 * Handles the layer timeline's mouse gestures (dragging blocks and layers, scrubbing, and
 * zooming) along with the actions in its menus.
 */
export class LayerTimelineController extends DestroyableMixin() {
  private dragIndicator: DragIndicatorInfo = { isVisible: false, left: 0, top: 0 };
  private horizZoom_ = DEFAULT_HORIZ_ZOOM;

  private shouldSuppressRebuildSnapTimes = false;
  private snapTimes = new Map<string, number[]>();

  private animation: Animation;
  private vectorLayer: VectorLayer;
  private selectedBlockIds: ReadonlySet<string>;
  private currActionMode: ActionMode | undefined;
  private autoZoomTimeout: number | undefined;

  // Mouse wheel zoom variables.
  private zoomStartActiveAnimation: HTMLElement | undefined;
  private targetHorizZoom = 0;
  private performZoomRAF: number | undefined;
  private endZoomTimeout: number | undefined;
  private zoomStartTimeCursorPos = 0;

  constructor(
    private readonly elements: LayerTimelineElements,
    private readonly view: LayerTimelineView,
    private readonly store: Store<State>,
    private readonly services: EditorServices,
  ) {
    super();
    // The subscription in init() keeps these up to date.
    const { animation, vectorLayer, selectedBlockIds } = getLayerTimelineState(store.getState());
    this.animation = animation;
    this.vectorLayer = vectorLayer;
    this.selectedBlockIds = selectedBlockIds;
  }

  init() {
    this.registerSubscription(
      this.store
        .select(getLayerTimelineState)
        .subscribe(
          ({
            animation,
            vectorLayer,
            selectedBlockIds,
            isBeingReset,
            actionMode,
            singleSelectedPathBlock,
          }) => {
            this.animation = animation;
            this.rebuildSnapTimes();
            this.vectorLayer = vectorLayer;
            this.selectedBlockIds = selectedBlockIds;
            if (isBeingReset) {
              // TODO: store the 'zoom' info in the store to avoid using this isBeingReset flag
              this.autoZoomToAnimation();
            }
            const prevActionMode = this.currActionMode;
            this.currActionMode = actionMode;
            if (
              prevActionMode === ActionMode.None &&
              actionMode === ActionMode.Selection &&
              singleSelectedPathBlock
            ) {
              // Move the current time to the beginning of the selected block when
              // entering action mode.
              this.services.playbackService.setCurrentTime(singleSelectedPathBlock.startTime);
            }
          },
        ),
    );
    this.registerSubscription(
      this.services.shortcutService.asObservable().subscribe(shortcut => {
        if (shortcut === Shortcut.ZoomToFit) {
          this.autoZoomToAnimation();
        }
      }),
    );
    this.autoZoomTimeout = window.setTimeout(() => this.autoZoomToAnimation());
  }

  // @Override
  dispose() {
    super.dispose();
    window.clearTimeout(this.autoZoomTimeout);
    window.clearTimeout(this.endZoomTimeout);
    if (this.performZoomRAF) {
      window.cancelAnimationFrame(this.performZoomRAF);
    }
  }

  private get horizZoom() {
    return this.horizZoom_;
  }

  private set horizZoom(horizZoom: number) {
    this.horizZoom_ = horizZoom;
    this.view.setHorizZoom(horizZoom);
  }

  private get currentTime() {
    return this.services.playbackService.getCurrentTime();
  }

  private get timeline() {
    return this.elements.timeline.current;
  }

  onNewWorkspaceClick() {
    const resetWorkspaceFn = () => {
      trackEvent('File', 'New');
      this.store.dispatch(new ResetWorkspace());
    };
    if (isWorkspaceDirty(this.store.getState()) && !IS_DEV_BUILD) {
      void this.services.dialogService
        .confirm('Start over?', `You'll lose any unsaved changes.`)
        .then(result => {
          if (result) {
            resetWorkspaceFn();
          }
        });
    } else {
      resetWorkspaceFn();
    }
  }

  onSaveToFileClick() {
    trackEvent('File', 'Save');
    this.services.fileExportService.exportJSON();
  }

  onLoadDemoClick() {
    trackEvent('File', 'Demo');
    void this.services.dialogService.pickDemo().then(selectedDemoInfo => {
      if (!selectedDemoInfo) {
        return;
      }
      trackEvent('Demos', 'Demo selected', selectedDemoInfo.title);
      this.services.projectService
        .getProject(`demos/${selectedDemoInfo.id}.shapeshifter`)
        .then(({ vectorLayer, animation, hiddenLayerIds }) => {
          this.store.dispatch(new ResetWorkspace(vectorLayer, animation, hiddenLayerIds));
        })
        .catch(() => {
          const msg =
            'serviceWorker' in navigator && navigator.serviceWorker.controller
              ? 'Demo not available offline'
              : `Couldn't fetch demo`;
          this.services.snackBarService.show(msg, 'Dismiss', Duration.Long);
        });
    });
  }

  onExportSvgClick() {
    trackEvent('Export', 'SVG');
    this.services.fileExportService.exportSvg();
  }

  onExportVectorDrawableClick() {
    trackEvent('Export', 'Vector Drawable');
    this.services.fileExportService.exportVectorDrawable();
  }

  onExportAnimatedVectorDrawableClick() {
    trackEvent('Export', 'Animated Vector Drawable');
    this.services.fileExportService.exportAnimatedVectorDrawable();
  }

  onExportSvgSpritesheetClick() {
    trackEvent('Export', 'SVG Spritesheet');
    this.services.fileExportService.exportSvgSpritesheet();
  }

  onExportCssKeyframesClick() {
    // TODO: implement this feature
    trackEvent('Export', 'CSS Keyframes');
    this.services.fileExportService.exportCssKeyframes();
  }

  onAnimationHeaderTextClick(event: MouseEvent) {
    if (!this.services.actionModeService.isActionMode()) {
      const isSelected = !ShortcutService.isOsDependentModifierKey(event) && !event.shiftKey;
      this.services.layerTimelineService.selectAnimation(isSelected);
    }
  }

  onTimelineHeaderScrub(event: ScrubEvent) {
    let time = event.time;
    if (!event.disableSnap) {
      time = this.snapTime(time, false);
    }
    this.services.playbackService.setCurrentTime(time);
  }

  onAddPathLayerClick() {
    const vl = getVectorLayer(this.store.getState());
    const layer = new PathLayer({
      name: LayerUtil.getUniqueLayerName([vl], 'path'),
      children: [],
      pathData: undefined,
    });
    this.services.layerTimelineService.addLayer(layer);
  }

  onAddClipPathLayerClick() {
    const vl = getVectorLayer(this.store.getState());
    const layer = new ClipPathLayer({
      name: LayerUtil.getUniqueLayerName([vl], 'mask'),
      children: [],
      pathData: undefined,
    });
    this.services.layerTimelineService.addLayer(layer);
  }

  onAddGroupLayerClick() {
    const vl = getVectorLayer(this.store.getState());
    const name = LayerUtil.getUniqueLayerName([vl], 'group');
    const layer = new GroupLayer({ name, children: [] });
    this.services.layerTimelineService.addLayer(layer);
  }

  onTimelineBlockMouseDown(mouseDownEvent: MouseEvent, dragBlock: AnimationBlock) {
    const animation = this.animation;
    const target = mouseDownEvent.target as Element;

    const property = target.closest('.slt-property');
    if (!property) {
      return;
    }

    // Some geometry and hit-testing basics.
    const animRect = property.getBoundingClientRect();
    const xToTimeFn = (x: number) => ((x - animRect.left) / animRect.width) * animation.duration;
    const downTime = xToTimeFn(mouseDownEvent.clientX);

    // Determine the action based on where the user clicked and the modifier keys.
    const metaKey = ShortcutService.isOsDependentModifierKey(mouseDownEvent);
    let action = MouseActions.Moving;
    if (target.classList.contains('slt-timeline-block-edge-end')) {
      action =
        mouseDownEvent.shiftKey || metaKey
          ? MouseActions.ScalingTogetherEnd
          : MouseActions.ScalingUniformEnd;
    } else if (target.classList.contains('slt-timeline-block-edge-start')) {
      action =
        mouseDownEvent.shiftKey || metaKey
          ? MouseActions.ScalingTogetherStart
          : MouseActions.ScalingUniformStart;
    }

    // Start up a cache of info for each selected block, calculating the left and right
    // bounds for each selected block, based on adjacent non-dragging blocks.
    const blocksByPropertyByLayer = ModelUtil.getOrderedBlocksByPropertyByLayer(animation);

    // Either drag all selected blocks or just the mousedown block.
    const draggingBlocks = this.selectedBlockIds.has(dragBlock.id)
      ? animation.blocks.filter(b => this.selectedBlockIds.has(b.id))
      : [dragBlock];
    const stagnantBlocks = animation.blocks.filter(block => {
      return (
        draggingBlocks.every(b => block.id !== b.id) &&
        draggingBlocks.some(({ layerId, propertyName }) => {
          return block.layerId === layerId && block.propertyName === propertyName;
        })
      );
    });

    interface IntervalInfo {
      readonly blockId: string;
      readonly layerId: string;
      readonly propertyName: string;
      readonly startTime: number;
      readonly endTime: number;
    }

    const intervalTree = new IntervalTree<IntervalInfo>();
    stagnantBlocks.forEach(b => {
      const { id, layerId, propertyName, startTime, endTime } = b;
      intervalTree.insert(Math.min(startTime, animation.duration), Math.max(0, endTime), {
        blockId: id,
        layerId,
        propertyName,
        startTime,
        endTime,
      });
    });

    interface BlockInfo {
      readonly block: AnimationBlock;
      readonly downStartTime: number;
      readonly downEndTime: number;
      readonly startBound: number;
      readonly endBound: number;
      newStartTime: number;
      newEndTime: number;
    }

    const blockInfos: BlockInfo[] = draggingBlocks.map(block => {
      const blockNeighbors = blocksByPropertyByLayer[block.layerId][block.propertyName];
      const indexIntoNeighbors = _.findIndex(blockNeighbors, b => block.id === b.id);

      // By default the block is only bound by the animation duration.
      let startBound = 0;
      let endBound = animation.duration;

      // For each block find the left-most non-selected block and use that as
      // the start bound.
      if (indexIntoNeighbors > 0) {
        for (let i = indexIntoNeighbors - 1; i >= 0; i--) {
          const neighbor = blockNeighbors[i];
          if (!draggingBlocks.includes(neighbor) || action === MouseActions.ScalingUniformStart) {
            // Only be bound by neighbors not being dragged
            // except when uniformly changing just start time.
            startBound = neighbor.endTime;
            break;
          }
        }
      }

      // For each block find the right-most non-selected block and use that as
      // the end bound.
      if (indexIntoNeighbors < blockNeighbors.length - 1) {
        for (let i = indexIntoNeighbors + 1; i < blockNeighbors.length; i++) {
          const neighbor = blockNeighbors[i];
          if (!draggingBlocks.includes(neighbor) || action === MouseActions.ScalingUniformEnd) {
            // Only be bound by neighbors not being dragged
            // except when uniformly changing just end time.
            endBound = neighbor.startTime;
            break;
          }
        }
      }

      return {
        block,
        startBound,
        endBound,
        downStartTime: block.startTime,
        downEndTime: block.endTime,
        newStartTime: block.startTime,
        newEndTime: block.endTime,
      };
    });

    const dragBlockDownStartTime = dragBlock.startTime;
    const dragBlockDownEndTime = dragBlock.endTime;

    let minStartTime: number;
    let maxEndTime: number;
    if (
      action === MouseActions.ScalingTogetherStart ||
      action === MouseActions.ScalingTogetherEnd
    ) {
      minStartTime = blockInfos.reduce((t, info) => Math.min(t, info.block.startTime), Infinity);
      maxEndTime = blockInfos.reduce((t, info) => Math.max(t, info.block.endTime), 0);
      // Avoid divide by zero.
      maxEndTime = Math.max(maxEndTime, minStartTime + MIN_BLOCK_DURATION);
    }

    const isOverlappingBlockFn = (info: BlockInfo, low: number, high: number) => {
      const { layerId, propertyName } = info.block;
      return intervalTree.intersectsWith(
        low,
        high,
        d => d.layerId === layerId && d.propertyName === propertyName,
      );
    };

    new Dragger({
      direction: 'horizontal',
      downX: mouseDownEvent.clientX,
      downY: mouseDownEvent.clientY,
      draggingCursor: action === MouseActions.Moving ? 'grabbing' : 'ew-resize',
      onBeginDragFn: () => {
        this.shouldSuppressRebuildSnapTimes = true;
      },
      onDropFn: () =>
        setTimeout(() => {
          this.shouldSuppressRebuildSnapTimes = false;
          this.rebuildSnapTimes();
        }, 0),
      onDragFn: event => {
        // Calculate the 'time delta' (the number of milliseconds the user has moved
        // since the gesture began).
        let timeDelta = Math.round(xToTimeFn(event.clientX) - downTime);
        const allowSnap = !event.shiftKey && !ShortcutService.isOsDependentModifierKey(event);
        const replacementBlocks: AnimationBlock[] = [];
        switch (action) {
          case MouseActions.Moving: {
            blockInfos.forEach(info => {
              // Snap time delta.
              if (allowSnap && info.block.id === dragBlock.id) {
                const newStartTime = info.downStartTime + timeDelta;
                const newStartTimeSnapDelta = this.snapTime(newStartTime) - newStartTime;
                const newEndTime = info.downEndTime + timeDelta;
                const newEndTimeSnapDelta = this.snapTime(newEndTime) - newEndTime;
                if (newStartTimeSnapDelta) {
                  if (newEndTimeSnapDelta) {
                    timeDelta += Math.min(newStartTimeSnapDelta, newEndTimeSnapDelta);
                  } else {
                    timeDelta += newStartTimeSnapDelta;
                  }
                } else if (newEndTimeSnapDelta) {
                  timeDelta += newEndTimeSnapDelta;
                }
              }
              // Clamp time delta to ensure it remains within the duration's bounds.
              const min = -info.downStartTime;
              const max = animation.duration - info.downEndTime;
              timeDelta = _.clamp(timeDelta, min, max);
            });

            const deltas = _(blockInfos)
              .filter(info => {
                // For each block, check if it overlaps with any of the stagnant blocks.
                const low = info.downStartTime + timeDelta;
                const end = info.downEndTime + timeDelta;
                return isOverlappingBlockFn(info, low, end);
              })
              .flatMap(info => {
                const {
                  block: { id, layerId, propertyName },
                } = info;
                const neighbors = blocksByPropertyByLayer[layerId][propertyName].filter(
                  ngh => id !== ngh.id,
                );
                return _.flatMap(neighbors, ngh => {
                  return [ngh.startTime - info.downEndTime, ngh.endTime - info.downStartTime];
                });
              })
              .sort((a, b) => Math.abs(a - timeDelta) - Math.abs(b - timeDelta))
              .value();

            const deltaIndex = _.findIndex(deltas, delta => {
              return blockInfos.every(info => {
                const low = info.downStartTime + delta;
                const high = info.downEndTime + delta;
                if (low < 0 || high > animation.duration) {
                  return false;
                }
                return !isOverlappingBlockFn(info, low, high);
              });
            });
            if (deltaIndex >= 0) {
              timeDelta = deltas[deltaIndex];
            }

            blockInfos.forEach(info => {
              const blockDuration = info.block.endTime - info.block.startTime;
              const block = info.block.clone();
              block.startTime = info.downStartTime + timeDelta;
              block.endTime = block.startTime + blockDuration;
              replacementBlocks.push(block);
            });
            break;
          }
          case MouseActions.ScalingUniformStart: {
            blockInfos.forEach(info => {
              // Snap time delta.
              if (allowSnap && info.block.id === dragBlock.id) {
                const newStartTime = info.downStartTime + timeDelta;
                const newStartTimeSnapDelta = this.snapTime(newStartTime) - newStartTime;
                if (newStartTimeSnapDelta) {
                  timeDelta += newStartTimeSnapDelta;
                }
              }
              // Clamp time delta.
              const min = info.startBound - info.downStartTime;
              const max = info.block.endTime - MIN_BLOCK_DURATION - info.downStartTime;
              timeDelta = _.clamp(timeDelta, min, max);
            });
            blockInfos.forEach(info => {
              const block = info.block.clone();
              block.startTime = info.downStartTime + timeDelta;
              replacementBlocks.push(block);
            });
            break;
          }
          case MouseActions.ScalingUniformEnd: {
            blockInfos.forEach(info => {
              // Snap time delta.
              if (allowSnap && info.block === dragBlock) {
                const newEndTime = info.downEndTime + timeDelta;
                const newEndTimeSnapDelta = this.snapTime(newEndTime) - newEndTime;
                if (newEndTimeSnapDelta) {
                  timeDelta += newEndTimeSnapDelta;
                }
              }
              // Clamp time delta.
              const min = info.block.startTime + MIN_BLOCK_DURATION - info.downEndTime;
              const max = info.endBound - info.downEndTime;
              timeDelta = _.clamp(timeDelta, min, max);
            });
            blockInfos.forEach(info => {
              const block = info.block.clone();
              block.endTime = info.downEndTime + timeDelta;
              replacementBlocks.push(block);
            });
            break;
          }
          case MouseActions.ScalingTogetherStart: {
            let scale =
              (dragBlockDownStartTime + timeDelta - maxEndTime) /
              (dragBlockDownStartTime - maxEndTime);
            scale = Math.min(scale, maxEndTime / (maxEndTime - minStartTime));
            let cancel = false;
            blockInfos.forEach(info => {
              info.newStartTime = maxEndTime - (maxEndTime - info.downStartTime) * scale;
              info.newEndTime = Math.max(
                maxEndTime - (maxEndTime - info.downEndTime) * scale,
                info.newStartTime + MIN_BLOCK_DURATION,
              );
              if (info.newStartTime < info.startBound || info.newEndTime > info.endBound) {
                cancel = true;
              }
            });
            if (!cancel) {
              blockInfos.forEach(info => {
                const block = info.block.clone();
                block.startTime = info.newStartTime;
                block.endTime = info.newEndTime;
                replacementBlocks.push(block);
              });
            }
            break;
          }
          case MouseActions.ScalingTogetherEnd: {
            let scale =
              (dragBlockDownEndTime + timeDelta - minStartTime) /
              (dragBlockDownEndTime - minStartTime);
            scale = Math.min(
              scale,
              (animation.duration - minStartTime) / (maxEndTime - minStartTime),
            );
            let cancel = false;
            blockInfos.forEach(info => {
              info.newStartTime = minStartTime + (info.downStartTime - minStartTime) * scale;
              info.newEndTime = Math.max(
                minStartTime + (info.downEndTime - minStartTime) * scale,
                info.newStartTime + MIN_BLOCK_DURATION,
              );
              if (info.newStartTime < info.startBound || info.newEndTime > info.endBound) {
                cancel = true;
              }
            });
            if (!cancel) {
              blockInfos.forEach(info => {
                const block = info.block.clone();
                block.startTime = info.newStartTime;
                block.endTime = info.newEndTime;
                replacementBlocks.push(block);
              });
            }
            break;
          }
        }
        const anim = getAnimation(this.store.getState());
        const blocks = replacementBlocks.filter(replacementBlock => {
          // Note that existingBlock may not be found if changes were made to the animation
          // (i.e. a block was deleted during a drag).
          const existingBlock = _.find(anim.blocks, b => replacementBlock.id === b.id);
          return (
            existingBlock &&
            (replacementBlock.startTime !== existingBlock.startTime ||
              replacementBlock.endTime !== existingBlock.endTime)
          );
        });
        this.services.layerTimelineService.updateBlocks(blocks);
      },
    });
  }

  /**
   * Builds a cache of snap times for all available animations.
   */
  private rebuildSnapTimes() {
    if (this.shouldSuppressRebuildSnapTimes) {
      return;
    }
    this.snapTimes = new Map();
    const snapTimesSet = new Set<number>();
    snapTimesSet.add(0);
    snapTimesSet.add(this.animation.duration);
    this.animation.blocks.forEach(block => {
      snapTimesSet.add(block.startTime);
      snapTimesSet.add(block.endTime);
    });
    this.snapTimes.set(this.animation.id, Array.from(snapTimesSet));
  }

  /**
   * Returns a new time, possibly snapped to animation boundaries
   */
  private snapTime(time: number, includeActiveTime = true) {
    const animation = this.animation;
    const snapTimes = this.snapTimes.get(animation.id) ?? [];
    const snapDelta = SNAP_PIXELS / this.horizZoom;
    const reducerFn = (best: number, snapTime: number) => {
      const dist = Math.abs(time - snapTime);
      return dist < snapDelta && dist < Math.abs(time - best) ? snapTime : best;
    };
    let bestSnapTime = snapTimes.reduce(reducerFn, Infinity);
    if (includeActiveTime) {
      bestSnapTime = reducerFn(bestSnapTime, this.currentTime);
    }
    return isFinite(bestSnapTime) ? bestSnapTime : time;
  }

  onTimelineBlockClick(event: MouseEvent, block: AnimationBlock) {
    const clearExisting = !ShortcutService.isOsDependentModifierKey(event) && !event.shiftKey;
    this.services.layerTimelineService.selectBlock(block.id, clearExisting);
  }

  onTimelineBlockDoubleClick(event: MouseEvent, block: AnimationBlock) {
    this.services.playbackService.setCurrentTime(block.startTime);
  }

  onAddTimelineBlockClick(layer: Layer, propertyName: string) {
    const property = layer.inspectableProperties.get(propertyName);
    if (!property) {
      return;
    }
    const clonedValue = property.cloneValue((layer as any)[propertyName]);
    this.services.layerTimelineService.addBlocks([
      {
        layerId: layer.id,
        propertyName,
        fromValue: clonedValue,
        toValue: clonedValue,
        currentTime: this.currentTime,
      },
    ]);
  }

  onConvertToClipPathClick(layer: Layer) {
    const clipPathLayer = new ClipPathLayer(layer as PathLayer);
    clipPathLayer.id = _.uniqueId();
    this.services.layerTimelineService.swapLayers(layer.id, clipPathLayer);
  }

  onConvertToPathClick(layer: Layer) {
    const pathLayer = new PathLayer(layer as ClipPathLayer);
    pathLayer.id = _.uniqueId();
    this.services.layerTimelineService.swapLayers(layer.id, pathLayer);
  }

  onFlattenGroupClick(layer: Layer) {
    this.services.layerTimelineService.flattenGroupLayer(layer.id);
  }

  onLayerClick(event: MouseEvent, clickedLayer: Layer) {
    const isMeta = ShortcutService.isOsDependentModifierKey(event);
    const isShift = event.shiftKey;
    if (!isMeta && !isShift) {
      // Clear the existing selections.
      this.services.layerTimelineService.selectLayer(clickedLayer.id, true);
      return;
    }

    if (isMeta && !isShift) {
      // Add the single layer to the existing selections, toggling the
      // layer if it is already selected.
      this.services.layerTimelineService.selectLayer(clickedLayer.id, false);
      return;
    }

    if (isMeta && isShift) {
      // Add the single layer to the existing selections.
      const layerIds = this.services.layerTimelineService.getSelectedLayerIds();
      layerIds.add(clickedLayer.id);
      this.services.layerTimelineService.setSelectedLayers(layerIds);
      return;
    }

    // Batch add layers to the existing selections.
    const { vectorLayer } = this;
    const topDownSortedLayers = LayerUtil.runPreorderTraversal(vectorLayer);
    const clickedLayerIndex = _.findIndex(topDownSortedLayers, l => l.id === clickedLayer.id);
    const selectedLayerIds = this.services.layerTimelineService.getSelectedLayerIds();
    // TODO: re-implement this behavior to match the behavior of Sketch
    // TODO will need to store most recently selected layer ID in order to implement this behavior
    const { startIndex, endIndex } = (function () {
      // Find the first selected layer before clickedLayerIndex.
      const beforeLayerIndex = _.findLastIndex(
        topDownSortedLayers,
        l => selectedLayerIds.has(l.id),
        clickedLayerIndex,
      );
      if (beforeLayerIndex >= 0) {
        // Batch select [beforeLayerIndex, clickedLayerIndex].
        return { startIndex: beforeLayerIndex, endIndex: clickedLayerIndex };
      }
      // Find the first selected layer after clickedLayerIndex.
      const afterLayerIndex = _.findIndex(
        topDownSortedLayers,
        l => selectedLayerIds.has(l.id),
        clickedLayerIndex,
      );
      if (afterLayerIndex >= 0) {
        // Batch select [clickedLayerIndex, afterLayerIndex].
        return { startIndex: clickedLayerIndex, endIndex: afterLayerIndex };
      }
      // Batch select [0, clickedLayerIndex].
      return { startIndex: 0, endIndex: clickedLayerIndex };
    })();
    for (let i = startIndex; i <= endIndex; i++) {
      selectedLayerIds.add(topDownSortedLayers[i].id);
    }
    this.services.layerTimelineService.setSelectedLayers(selectedLayerIds);
  }

  onLayerToggleExpanded(event: MouseEvent, layer: Layer) {
    const recursive = ShortcutService.isOsDependentModifierKey(event) || event.shiftKey;
    this.services.layerTimelineService.toggleExpandedLayer(layer.id, recursive);
  }

  onLayerToggleVisibility(layer: Layer) {
    this.services.layerTimelineService.toggleVisibleLayer(layer.id);
  }

  onLayerMouseDown(mouseDownEvent: MouseEvent, mouseDownDragLayer: Layer) {
    const layersList = (mouseDownEvent.target as Element).closest('.slt-layers-list');
    const scroller = (mouseDownEvent.target as Element).closest('.slt-layers-list-scroller');
    if (!layersList || !scroller) {
      return;
    }

    interface LayerInfo {
      layer: Layer;
      element: Element;
      localRect: Rect;
      moveIntoEmptyLayerGroup?: boolean;
    }

    let orderedLayerInfos: LayerInfo[] = [];
    let scrollerRect: DOMRect;
    let targetLayerInfo: LayerInfo | undefined;
    let targetEdge: string;

    const dragLayers: ReadonlyArray<Layer> = (function (
      lts: EditorServices['layerTimelineService'],
    ) {
      const selectedLayerIds = lts.getSelectedLayerIds();
      // Don't drag any other selected layers if the drag layer isn't selected itself.
      // At the end of the drag, we will select the drag layer and deselect the others.
      const dragLayerIdSet = selectedLayerIds.has(mouseDownDragLayer.id)
        ? selectedLayerIds
        : new Set([mouseDownDragLayer.id]);
      const topDownSortedLayers = LayerUtil.runPreorderTraversal(lts.getVectorLayer());
      return topDownSortedLayers.filter(l => dragLayerIdSet.has(l.id));
    })(this.services.layerTimelineService);

    new Dragger({
      direction: 'both',
      downX: mouseDownEvent.clientX,
      downY: mouseDownEvent.clientY,

      onBeginDragFn: () => {
        // Build up a list of all layers ordered by Y position.
        orderedLayerInfos = [];
        scrollerRect = scroller.getBoundingClientRect();
        const scrollTop = scroller.scrollTop;
        layersList.querySelectorAll<HTMLElement>('.slt-layer-container').forEach(element => {
          const layerId = element.dataset.layerId;
          if (!layerId) {
            // The root layer doesn't have an ID set.
            return;
          }

          let rect: Rect = element.getBoundingClientRect();
          rect = {
            left: rect.left,
            top: rect.top + scrollTop - scrollerRect.top,
            bottom: rect.bottom + scrollTop - scrollerRect.top,
            height: rect.height,
            right: rect.right,
            width: rect.width,
          };

          const layer = this.vectorLayer.findLayerById(layerId);
          if (!layer) {
            return;
          }
          orderedLayerInfos.push({ layer, element, localRect: rect });

          // Add a fake target for empty groups.
          if (layer instanceof GroupLayer && !layer.children.length) {
            const left = rect.left + LAYER_INDENT_PIXELS;
            const top = rect.bottom;
            rect = { ...rect, ...{ left, top } };
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
        const localEventY = event.clientY - scrollerRect.top + scroller.scrollTop;
        // Find the target layer and edge (top or bottom).
        targetLayerInfo = undefined;
        let minDistance = Infinity;
        let minDistanceIndent = Infinity; // Tie break to most indented layer.
        for (const layerInfo of orderedLayerInfos) {
          // Skip if mouse to the left of this layer.
          if (event.clientX < layerInfo.localRect.left) {
            continue;
          }

          for (const edge of ['top', 'bottom']) {
            // Test distance to top edge.
            const distance = Math.abs(localEventY - layerInfo.localRect[edge as 'top' | 'bottom']);
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

        // Disallow dragging a layer into itself or its children.
        if (targetLayerInfo) {
          let layer: Layer | undefined = targetLayerInfo.layer;
          while (layer) {
            const layerId = layer.id;
            if (_.find(dragLayers, l => l.id === layerId)) {
              targetLayerInfo = undefined;
              break;
            }
            layer = LayerUtil.findParent(this.vectorLayer, layerId);
          }
        }

        if (targetLayerInfo && targetEdge === 'bottom') {
          const nextSibling = LayerUtil.findNextSibling(this.vectorLayer, targetLayerInfo.layer.id);
          if (nextSibling && nextSibling.id === mouseDownDragLayer.id) {
            targetLayerInfo = undefined;
          }
        }

        const dragIndicatorInfo: DragIndicatorInfo = { isVisible: !!targetLayerInfo };
        if (targetLayerInfo) {
          dragIndicatorInfo.left = targetLayerInfo.localRect.left;
          dragIndicatorInfo.top = targetLayerInfo.localRect[targetEdge as 'top' | 'bottom'];
        }
        this.updateDragIndicator(dragIndicatorInfo);
      },

      onDropFn: () => {
        this.updateDragIndicator({ isVisible: false });

        if (!targetLayerInfo) {
          return;
        }

        const dragLayerIds: ReadonlyArray<string> = dragLayers.map(l => l.id);

        const addDragLayersFn = (
          vl: VectorLayer,
          parent: Layer,
          startingIndex = parent.children.length,
        ) => {
          const layersToAdd = dragLayers.map(l => {
            const otherDragLayerIds = dragLayerIds.filter(id => id !== l.id);
            return LayerUtil.removeLayers(l, ...otherDragLayerIds);
          });
          return LayerUtil.addLayers(vl, parent.id, startingIndex, ...layersToAdd);
        };

        const removeDragLayersFn = (vl: VectorLayer) => LayerUtil.removeLayers(vl, ...dragLayerIds);

        const initialVl = this.vectorLayer;
        const targetLayer = targetLayerInfo.layer;
        let replacementVl: VectorLayer | undefined;

        if (targetLayerInfo.moveIntoEmptyLayerGroup) {
          // Moving into an empty layer group.
          replacementVl = addDragLayersFn(removeDragLayersFn(initialVl), targetLayer);
        } else if (LayerUtil.findParent(initialVl, targetLayer.id)) {
          // Moving next to another layer.
          const tempVl = removeDragLayersFn(initialVl);
          const parent = LayerUtil.findParent(tempVl, targetLayer.id);
          const index = parent ? _.findIndex(parent.children, l => l.id === targetLayer.id) : -1;
          if (parent && index >= 0) {
            replacementVl = addDragLayersFn(tempVl, parent, index + (targetEdge === 'top' ? 0 : 1));
          }
        }

        if (replacementVl) {
          this.store.dispatch(
            new BatchAction(
              new SetVectorLayer(replacementVl),
              new SetSelectedLayers(new Set(dragLayerIds)),
            ),
          );
        }
      },
    });
  }

  private updateDragIndicator(info: DragIndicatorInfo) {
    this.dragIndicator = { ...this.dragIndicator, ...info };
    this.view.setDragIndicator(this.dragIndicator);
  }

  /**
   * Handles ctrl + mouse wheel event for zooming into and out of the timeline.
   */
  onWheelEvent(event: WheelEvent) {
    const startZoomFn = () => {
      const timelineAnimation = this.elements.timelineAnimation.current;
      if (!timelineAnimation) {
        return;
      }
      this.zoomStartActiveAnimation = timelineAnimation;
      this.zoomStartTimeCursorPos =
        getPosition(timelineAnimation).left +
        this.currentTime * this.horizZoom +
        TimelineConsts.TIMELINE_ANIMATION_PADDING;
    };

    const performZoomFn = () => {
      this.horizZoom = this.targetHorizZoom;

      // Set the scroll offset such that the time cursor remains at zoomStartTimeCursorPos
      const { timeline } = this;
      if (this.zoomStartActiveAnimation && timeline) {
        const newScrollLeft =
          getPosition(this.zoomStartActiveAnimation).left +
          timeline.scrollLeft +
          this.currentTime * this.horizZoom +
          TimelineConsts.TIMELINE_ANIMATION_PADDING -
          this.zoomStartTimeCursorPos;
        timeline.scrollLeft = newScrollLeft;
      }
    };

    const endZoomFn = () => {
      this.zoomStartTimeCursorPos = 0;
      this.zoomStartActiveAnimation = undefined;
      this.endZoomTimeout = undefined;
      this.targetHorizZoom = 0;
    };

    // chrome+mac trackpad pinch-zoom = ctrlKey
    if (ShortcutService.isOsDependentModifierKey(event) || event.ctrlKey) {
      if (!this.targetHorizZoom) {
        // Multiple changes can happen to targetHorizZoom before the
        // actual zoom level is updated (see performZoom_).
        this.targetHorizZoom = this.horizZoom;
      }

      event.preventDefault();
      // Firefox scrolls by lines instead of pixels.
      const deltaY =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY;
      this.targetHorizZoom *= 1.01 ** -deltaY;
      this.targetHorizZoom = _.clamp(this.targetHorizZoom, MIN_ZOOM, MAX_ZOOM);
      if (this.targetHorizZoom !== this.horizZoom) {
        // Zoom has changed.
        if (this.performZoomRAF) {
          window.cancelAnimationFrame(this.performZoomRAF);
        }
        this.performZoomRAF = window.requestAnimationFrame(() => performZoomFn());
        if (this.endZoomTimeout) {
          window.clearTimeout(this.endZoomTimeout);
        } else {
          startZoomFn();
        }
        this.endZoomTimeout = window.setTimeout(() => endZoomFn(), 100);
      }
      return false;
    }
    return undefined;
  }

  /**
   * Zooms the timeline to fit the first animation.
   */
  autoZoomToAnimation() {
    const { timeline } = this;
    if (!timeline) {
      return;
    }
    // Shave off 48 pixels for safety.
    const horizZoom = (getContentSize(timeline, 'width') - 48) / this.animation.duration;
    this.horizZoom = _.clamp(horizZoom, MIN_ZOOM, MAX_ZOOM);
  }

  // Proxies a button click to the <input> tag that opens the file picker.
  // We clear the element's value to make it possible to import the same file
  // more than once.
  onLaunchFilePickerClick(input: HTMLInputElement) {
    input.value = '';
    input.click();
  }

  onImportedFilesPicked(fileList: FileList | null) {
    if (fileList) {
      this.services.fileImportService.import(fileList);
    }
  }
}

interface Rect {
  readonly left: number;
  readonly top: number;
  readonly bottom: number;
  readonly height: number;
  readonly right: number;
  readonly width: number;
}

export interface DragIndicatorInfo {
  left?: number;
  top?: number;
  isVisible?: boolean;
}
