import 'rxjs/add/operator/first';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/map';

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import { ActionMode } from 'app/model/actionmode';
import {
  ClipPathLayer,
  GroupLayer,
  Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/model/layers';
import { Animation, AnimationBlock } from 'app/model/timeline';
import { ModelUtil } from 'app/scripts/common';
import { Dragger } from 'app/scripts/dragger';
import { IntervalTree } from 'app/scripts/intervals';
import { DestroyableMixin } from 'app/scripts/mixins';
import {
  ActionModeService,
  AnimatorService,
  DemoService,
  DialogService,
  FileExportService,
  FileImportService,
  LayerTimelineService,
  ThemeService,
} from 'app/services';
import { Shortcut, ShortcutService } from 'app/services/shortcut.service';
import { Duration, SnackBarService } from 'app/services/snackbar.service';
import { State, Store } from 'app/store';
import { getLayerTimelineState, isWorkspaceDirty } from 'app/store/common/selectors';
import { getVectorLayer } from 'app/store/layers/selectors';
import { ResetWorkspace } from 'app/store/reset/actions';
import { getAnimation } from 'app/store/timeline/selectors';
import { environment } from 'environments/environment';
import * as $ from 'jquery';
import * as _ from 'lodash';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';

import { Callbacks as LayerListTreeCallbacks } from './layerlisttree.component';
import { LayerTimelineGridDirective, ScrubEvent } from './layertimelinegrid.directive';
import { Callbacks as TimelineAnimationRowCallbacks } from './timelineanimationrow.component';
import * as TimelineConsts from './constants';

const IS_DEV_BUILD = !environment.production;

// Distance in pixels from a snap point before snapping to the point.
const SNAP_PIXELS = 10;
const LAYER_INDENT_PIXELS = 20;
const MIN_BLOCK_DURATION = 10;
const MAX_ZOOM = 10;
const MIN_ZOOM = 0.01;
const DEFAULT_HORIZ_ZOOM = 2; // 1ms = 2px.

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

declare const ga: Function;

@Component({
  selector: 'app-layertimeline',
  templateUrl: './layertimeline.component.html',
  styleUrls: ['./layertimeline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayerTimelineComponent extends DestroyableMixin()
  implements OnInit, AfterViewInit, TimelineAnimationRowCallbacks, LayerListTreeCallbacks {
  @ViewChild('timeline') private timelineRef: ElementRef;
  private $timeline: JQuery;

  @ViewChild('timelineAnimation') private timelineAnimationRef: ElementRef;
  @ViewChildren(LayerTimelineGridDirective)
  timelineDirectives: QueryList<LayerTimelineGridDirective>;

  private readonly dragIndicatorSubject = new BehaviorSubject<DragIndicatorInfo>({
    isVisible: false,
    left: 0,
    top: 0,
  });
  dragIndicatorObservable = this.dragIndicatorSubject.asObservable();
  private readonly horizZoomSubject = new BehaviorSubject<number>(DEFAULT_HORIZ_ZOOM);
  horizZoomObservable = this.horizZoomSubject.asObservable();
  private currentTime_ = 0;

  private shouldSuppressClick = false;
  private shouldSuppressRebuildSnapTimes = false;
  private snapTimes: Map<string, number[]>;

  private animation: Animation;
  private vectorLayer: VectorLayer;
  private selectedBlockIds: ReadonlySet<string>;

  layerTimelineModel$: Observable<LayerTimelineModel>;

  // Mouse wheel zoom variables.
  private $zoomStartActiveAnimation: JQuery;
  private targetHorizZoom: number;
  private performZoomRAF: number = undefined;
  private endZoomTimeout: number = undefined;
  private zoomStartTimeCursorPos: number;

  constructor(
    private readonly fileImportService: FileImportService,
    private readonly fileExportService: FileExportService,
    private readonly snackBarService: SnackBarService,
    private readonly animatorService: AnimatorService,
    private readonly store: Store<State>,
    private readonly dialogService: DialogService,
    private readonly demoService: DemoService,
    private readonly actionModeService: ActionModeService,
    readonly shortcutService: ShortcutService,
    private readonly layerTimelineService: LayerTimelineService,
    readonly themeService: ThemeService,
  ) {
    super();
  }

  ngOnInit() {
    let currActionMode: ActionMode;
    this.layerTimelineModel$ = this.store
      .select(getLayerTimelineState)
      .map(
        ({
          animation,
          vectorLayer,
          isAnimationSelected,
          selectedBlockIds,
          isBeingReset,
          isActionMode,
          actionMode,
          singleSelectedPathBlock,
        }) => {
          this.animation = animation;
          this.rebuildSnapTimes();
          this.vectorLayer = vectorLayer;
          this.selectedBlockIds = selectedBlockIds;
          if (isBeingReset) {
            this.autoZoomToAnimation();
          }
          if (currActionMode === ActionMode.None && actionMode === ActionMode.Selection) {
            // Move the current time to the beginning of the selected block when
            // entering action mode.
            this.animatorService.setAnimationTime(singleSelectedPathBlock.startTime);
          }
          currActionMode = actionMode;
          return {
            animation,
            vectorLayer,
            isAnimationSelected,
            isActionMode,
          };
        },
      );
    this.registerSubscription(
      this.shortcutService.asObservable().subscribe(shortcut => {
        if (shortcut === Shortcut.ZoomToFit) {
          this.autoZoomToAnimation();
        }
      }),
    );
  }

  ngAfterViewInit() {
    this.$timeline = $(this.timelineRef.nativeElement);
    this.registerSubscription(
      this.animatorService.asObservable().subscribe(event => {
        this.currentTime = event.currentTime;
      }),
    );
    setTimeout(() => this.autoZoomToAnimation());
  }

  private get horizZoom() {
    return this.horizZoomSubject.getValue();
  }

  private set horizZoom(horizZoom: number) {
    this.horizZoomSubject.next(horizZoom);
  }

  private get currentTime() {
    return this.currentTime_;
  }

  private set currentTime(currentTime: number) {
    this.currentTime_ = currentTime;
    this.timelineDirectives.forEach(dir => (dir.currentTime = currentTime));
  }

  // Called from the LayerTimelineComponent template.
  onNewWorkspaceClick() {
    const resetWorkspaceFn = () => {
      ga('send', 'event', 'File', 'New');
      // TODO: figure out if this hack is necessary and/or can be avoided?
      this.animatorService.reset();
      this.store.dispatch(new ResetWorkspace());
      this.animatorService.reset();
    };
    this.store
      .select(isWorkspaceDirty)
      .first()
      .subscribe(isDirty => {
        if (isDirty && !IS_DEV_BUILD) {
          this.dialogService
            .confirm('Start over?', `You'll lose any unsaved changes.`)
            .filter(result => result)
            .subscribe(resetWorkspaceFn);
        } else {
          resetWorkspaceFn();
        }
      });
  }

  // Called from the LayerTimelineComponent template.
  onSaveToFileClick() {
    ga('send', 'event', 'File', 'Save');
    this.fileExportService.exportJSON();
  }

  // Called from the LayerTimelineComponent template.
  onLoadDemoClick() {
    ga('send', 'event', 'File', 'Demo');
    this.dialogService
      .pickDemo()
      .filter(demoInfo => !!demoInfo)
      .subscribe(selectedDemoInfo => {
        ga('send', 'event', 'Demos', 'Demo selected', selectedDemoInfo.title);

        this.demoService
          .getDemo(selectedDemoInfo.id)
          .then(({ vectorLayer, animation, hiddenLayerIds }) => {
            // TODO: figure out if this hack is necessary and/or can be avoided?
            this.animatorService.reset();
            this.store.dispatch(new ResetWorkspace(vectorLayer, animation, hiddenLayerIds));
            this.animatorService.reset();
          })
          .catch(error => {
            const msg =
              'serviceWorker' in navigator && navigator.serviceWorker.controller
                ? 'Demo not available offline'
                : `Couldn't fetch demo`;
            this.snackBarService.show(msg, 'Dismiss', Duration.Long);
            return Promise.reject(error.message || error);
          });
      });
  }

  // Called from the LayerTimelineComponent template.
  onExportSvgClick() {
    ga('send', 'event', 'Export', 'SVG');
    this.fileExportService.exportSvg();
  }

  // Called from the LayerTimelineComponent template.
  onExportVectorDrawableClick() {
    ga('send', 'event', 'Export', 'Vector Drawable');
    this.fileExportService.exportVectorDrawable();
  }

  // Called from the LayerTimelineComponent template.
  onExportAnimatedVectorDrawableClick() {
    ga('send', 'event', 'Export', 'Animated Vector Drawable');
    this.fileExportService.exportAnimatedVectorDrawable();
  }

  // Called from the LayerTimelineComponent template.
  onExportSvgSpritesheetClick() {
    ga('send', 'event', 'Export', 'SVG Spritesheet');
    this.fileExportService.exportSvgSpritesheet();
  }

  // Called from the LayerTimelineComponent template.
  onExportCssKeyframesClick() {
    ga('send', 'event', 'Export', 'CSS Keyframes');
    // TODO: uncomment this stuff out in the HTML template once implemented
    this.fileExportService.exportCssKeyframes();
  }

  // Called from the LayerTimelineComponent template.
  onAnimationHeaderTextClick(event: MouseEvent) {
    // Stop propagation to ensure that animationTimelineClick() isn't called.
    event.stopPropagation();
    if (!this.actionModeService.isActionMode()) {
      const isSelected = !ShortcutService.getOsDependentModifierKey(event) && !event.shiftKey;
      this.layerTimelineService.selectAnimation(isSelected);
    }
  }

  // Called from the LayerTimelineComponent template.
  onTimelineHeaderScrub(event: ScrubEvent) {
    let time = event.time;
    if (!event.disableSnap) {
      time = this.snapTime(time, false);
    }
    this.currentTime = time;
    this.animatorService.setAnimationTime(time);
  }

  // Called from the LayerTimelineComponent template.
  onAddPathLayerClick() {
    this.store
      .select(getVectorLayer)
      .first()
      .subscribe(vl => {
        const layer = new PathLayer({
          name: LayerUtil.getUniqueLayerName([vl], 'path'),
          children: [],
          pathData: undefined,
        });
        this.layerTimelineService.addLayer(layer);
      });
  }

  // Called from the LayerTimelineComponent template.
  onAddClipPathLayerClick() {
    this.store
      .select(getVectorLayer)
      .first()
      .subscribe(vl => {
        const layer = new ClipPathLayer({
          name: LayerUtil.getUniqueLayerName([vl], 'mask'),
          children: [],
          pathData: undefined,
        });
        this.layerTimelineService.addLayer(layer);
      });
  }

  // Called from the LayerTimelineComponent template.
  onAddGroupLayerClick() {
    this.store
      .select(getVectorLayer)
      .first()
      .subscribe(vl => {
        const name = LayerUtil.getUniqueLayerName([vl], 'group');
        const layer = new GroupLayer({ name, children: [] });
        this.layerTimelineService.addLayer(layer);
      });
  }

  // @Override TimelineAnimationRowCallbacks
  onTimelineBlockMouseDown(mouseDownEvent: MouseEvent, dragBlock: AnimationBlock) {
    const animation = this.animation;
    // TODO: this JQuery 'class' stuff may not work with view encapsulation enabled
    const $target = $(mouseDownEvent.target);

    // Some geometry and hit-testing basics.
    const animRect = $(mouseDownEvent.target)
      .parents('.slt-property')
      .get(0)
      .getBoundingClientRect();
    const xToTimeFn = (x: number) => (x - animRect.left) / animRect.width * animation.duration;
    const downTime = xToTimeFn(mouseDownEvent.clientX);

    // Determine the action based on where the user clicked and the modifier keys.
    const metaKey = ShortcutService.getOsDependentModifierKey(mouseDownEvent);
    let action = MouseActions.Moving;
    if ($target.hasClass('slt-timeline-block-edge-end')) {
      action =
        mouseDownEvent.shiftKey || metaKey
          ? MouseActions.ScalingTogetherEnd
          : MouseActions.ScalingUniformEnd;
    } else if ($target.hasClass('slt-timeline-block-edge-start')) {
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
      readonly startBound?: number;
      readonly endBound?: number;
      newStartTime?: number;
      newEndTime?: number;
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

    // tslint:disable-next-line: no-unused-expression
    new Dragger({
      direction: 'horizontal',
      downX: mouseDownEvent.clientX,
      downY: mouseDownEvent.clientY,
      draggingCursor: action === MouseActions.Moving ? 'grabbing' : 'ew-resize',
      onBeginDragFn: () => {
        this.shouldSuppressClick = true;
        this.shouldSuppressRebuildSnapTimes = true;
      },
      onDropFn: () =>
        setTimeout(() => {
          this.shouldSuppressClick = false;
          this.shouldSuppressRebuildSnapTimes = false;
          this.rebuildSnapTimes();
        }, 0),
      onDragFn: event => {
        // Calculate the 'time delta' (the number of milliseconds the user has moved
        // since the gesture began).
        let timeDelta = Math.round(xToTimeFn(event.clientX) - downTime);
        const allowSnap = !event.shiftKey && !ShortcutService.getOsDependentModifierKey(event);
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
                const { block: { id, layerId, propertyName } } = info;
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
        this.store
          .select(getAnimation)
          .first()
          .subscribe(anim => {
            const blocks = replacementBlocks.filter(replacementBlock => {
              const existingBlock = _.find(anim.blocks, b => replacementBlock.id === b.id);
              return (
                replacementBlock.startTime !== existingBlock.startTime ||
                replacementBlock.endTime !== existingBlock.endTime
              );
            });
            this.layerTimelineService.updateBlocks(blocks);
          });
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
    const snapTimes = this.snapTimes.get(animation.id);
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

  // @Override TimelineAnimationRowCallbacks
  onTimelineBlockClick(event: MouseEvent, block: AnimationBlock) {
    const clearExisting = !ShortcutService.getOsDependentModifierKey(event) && !event.shiftKey;
    this.layerTimelineService.selectBlock(block.id, clearExisting);
  }

  // @Override TimelineAnimationRowCallbacks
  onTimelineBlockDoubleClick(event: MouseEvent, block: AnimationBlock) {
    this.animatorService.setAnimationTime(block.startTime);
  }

  // @Override LayerListTreeComponentCallbacks
  onAddTimelineBlockClick(event: MouseEvent, layer: Layer, propertyName: string) {
    const clonedValue = layer.inspectableProperties
      .get(propertyName)
      .cloneValue(layer[propertyName]);
    this.layerTimelineService.addBlocks([
      {
        layerId: layer.id,
        propertyName,
        fromValue: clonedValue,
        toValue: clonedValue,
        currentTime: this.currentTime,
      },
    ]);
  }

  // @Override LayerListTreeComponentCallbacks
  onConvertToClipPathClick(event: MouseEvent, layer: Layer) {
    const clipPathLayer = new ClipPathLayer(layer as PathLayer);
    clipPathLayer.id = _.uniqueId();
    this.layerTimelineService.swapLayers(layer.id, clipPathLayer);
  }

  // @Override LayerListTreeComponentCallbacks
  onConvertToPathClick(event: MouseEvent, layer: Layer) {
    const pathLayer = new PathLayer(layer as ClipPathLayer);
    pathLayer.id = _.uniqueId();
    this.layerTimelineService.swapLayers(layer.id, pathLayer);
  }

  // @Override LayerListTreeComponentCallbacks
  onFlattenGroupClick(event: MouseEvent, layer: Layer) {
    this.layerTimelineService.flattenGroupLayer(layer.id);
  }

  // @Override LayerListTreeComponentCallbacks
  onLayerClick(event: MouseEvent, layer: Layer) {
    const clearExisting = !ShortcutService.getOsDependentModifierKey(event) && !event.shiftKey;
    this.layerTimelineService.selectLayer(layer.id, clearExisting);
  }

  // @Override LayerListTreeComponentCallbacks
  onLayerToggleExpanded(event: MouseEvent, layer: Layer) {
    const recursive = ShortcutService.getOsDependentModifierKey(event) || event.shiftKey;
    this.layerTimelineService.toggleExpandedLayer(layer.id, recursive);
  }

  // @Override LayerListTreeComponentCallbacks
  onLayerToggleVisibility(event: MouseEvent, layer: Layer) {
    this.layerTimelineService.toggleVisibleLayer(layer.id);
  }

  // @Override LayerListTreeComponentCallbacks
  onLayerMouseDown(mouseDownEvent: MouseEvent, dragLayer: Layer) {
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

    // tslint:disable-next-line: no-unused-expression
    new Dragger({
      direction: 'both',
      downX: mouseDownEvent.clientX,
      downY: mouseDownEvent.clientY,

      onBeginDragFn: () => {
        this.shouldSuppressClick = true;

        // Build up a list of all layers ordered by Y position.
        orderedLayerInfos = [];
        scrollerRect = $scroller.get(0).getBoundingClientRect();
        const scrollTop = $scroller.scrollTop();
        $layersList.find('.slt-layer-container').each((__, element) => {
          // toString() is necessary because JQuery converts the ID into a number.
          const layerId: string = ($(element).data('layer-id') || '').toString();
          if (!layerId) {
            // The root layer doesn't have an ID set.
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

          const layer = this.vectorLayer.findLayerById(layerId);
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
        const localEventY = event.clientY - scrollerRect.top + $scroller.scrollTop();
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
          let layer = targetLayerInfo.layer;
          while (layer) {
            if (layer === dragLayer) {
              targetLayerInfo = undefined;
              break;
            }
            layer = LayerUtil.findParent(this.vectorLayer, layer.id);
          }
        }

        if (
          targetLayerInfo &&
          targetEdge === 'bottom' &&
          LayerUtil.findNextSibling(this.vectorLayer, targetLayerInfo.layer.id) === dragLayer
        ) {
          targetLayerInfo = undefined;
        }

        // TODO: make it possible to drag multiple blocks at a time
        const dragIndicatorInfo: DragIndicatorInfo = { isVisible: !!targetLayerInfo };
        if (targetLayerInfo) {
          dragIndicatorInfo.left = targetLayerInfo.localRect.left;
          dragIndicatorInfo.top = targetLayerInfo.localRect[targetEdge as 'top' | 'bottom'];
        }
        this.updateDragIndicator(dragIndicatorInfo);
      },

      onDropFn: () => {
        this.updateDragIndicator({ isVisible: false });

        if (targetLayerInfo) {
          let replacementVl: VectorLayer;
          if (targetLayerInfo.moveIntoEmptyLayerGroup) {
            // Moving into an empty layer group.
            const sourceVl = this.vectorLayer;
            replacementVl = LayerUtil.removeLayers(sourceVl, dragLayer.id);
            const newParent = targetLayerInfo.layer;
            replacementVl = LayerUtil.addLayer(
              replacementVl,
              newParent.id,
              dragLayer.clone(),
              newParent.children.length,
            );
          } else {
            // Moving next to another layer.
            let newParent = LayerUtil.findParent(this.vectorLayer, targetLayerInfo.layer.id);
            if (newParent) {
              const sourceVl = this.vectorLayer;
              replacementVl = LayerUtil.removeLayers(sourceVl, dragLayer.id);
              newParent = LayerUtil.findParent(replacementVl, targetLayerInfo.layer.id);
              let index = newParent.children
                ? _.findIndex(newParent.children, child => child.id === targetLayerInfo.layer.id)
                : -1;
              if (index >= 0) {
                index += targetEdge === 'top' ? 0 : 1;
                replacementVl = LayerUtil.addLayer(
                  replacementVl,
                  newParent.id,
                  dragLayer.clone(),
                  index,
                );
              }
            }
          }
          if (replacementVl) {
            setTimeout(() => this.layerTimelineService.setVectorLayer(replacementVl));
          }
        }

        setTimeout(() => (this.shouldSuppressClick = false), 0);
      },
    });
  }

  private updateDragIndicator(info: DragIndicatorInfo) {
    const curr = this.dragIndicatorSubject.getValue();
    this.dragIndicatorSubject.next({ ...curr, ...info });
  }

  /**
   * Handles ctrl + mouse wheel event for zooming into and out of the timeline.
   */
  onWheelEvent(event: WheelEvent) {
    const startZoomFn = () => {
      this.$zoomStartActiveAnimation = $(this.timelineAnimationRef.nativeElement);
      this.zoomStartTimeCursorPos =
        this.$zoomStartActiveAnimation.position().left +
        this.currentTime * this.horizZoom +
        TimelineConsts.TIMELINE_ANIMATION_PADDING;
    };

    const performZoomFn = () => {
      this.horizZoom = this.targetHorizZoom;

      // Set the scroll offset such that the time cursor remains at zoomStartTimeCursorPos
      if (this.$zoomStartActiveAnimation) {
        const newScrollLeft =
          this.$zoomStartActiveAnimation.position().left +
          this.$timeline.scrollLeft() +
          this.currentTime * this.horizZoom +
          TimelineConsts.TIMELINE_ANIMATION_PADDING -
          this.zoomStartTimeCursorPos;
        this.$timeline.scrollLeft(newScrollLeft);
      }
    };

    const endZoomFn = () => {
      this.zoomStartTimeCursorPos = 0;
      this.$zoomStartActiveAnimation = undefined;
      this.endZoomTimeout = undefined;
      this.targetHorizZoom = 0;
    };

    // chrome+mac trackpad pinch-zoom = ctrlKey
    if (ShortcutService.getOsDependentModifierKey(event) || event.ctrlKey) {
      if (!this.targetHorizZoom) {
        // Multiple changes can happen to targetHorizZoom before the
        // actual zoom level is updated (see performZoom_).
        this.targetHorizZoom = this.horizZoom;
      }

      event.preventDefault();
      this.targetHorizZoom *= 1.01 ** -event.deltaY;
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

  // Called from the LayerTimelineComponent template.
  onZoomToFitClick(event: MouseEvent) {
    event.stopPropagation();
    this.autoZoomToAnimation();
  }

  /**
   * Zooms the timeline to fit the first animation.
   */
  private autoZoomToAnimation() {
    // Shave off 48 pixels for safety.
    this.horizZoom = (this.$timeline.width() - 48) / this.animation.duration;
  }

  // Proxies a button click to the <input> tag that opens the file picker.
  // We clear the element's value to make it possible to import the same file
  // more than once.
  onLaunchFilePickerClick(sourceElementId: string) {
    $(`#${sourceElementId}`)
      .val('')
      .click();
  }

  // Called from the LayerTimelineComponent template.
  onImportedFilesPicked(fileList: FileList) {
    this.fileImportService.import(fileList);
  }

  onTopSplitterChanged() {
    if (this.timelineDirectives) {
      this.timelineDirectives.forEach(d => d.redraw());
    }
  }

  // Used by *ngFor loop.
  trackLayerFn(index: number, layer: Layer) {
    return layer.id;
  }
}

interface LayerTimelineModel {
  readonly animation: Animation;
  readonly vectorLayer: VectorLayer;
  readonly isAnimationSelected: boolean;
  readonly isActionMode: boolean;
}

interface DragIndicatorInfo {
  left?: number;
  top?: number;
  isVisible?: boolean;
}
