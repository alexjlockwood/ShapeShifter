import { Component, OnInit, ViewChild, OnDestroy, ElementRef } from '@angular/core';
import { environment } from '../environments/environment';
import { CanvasType } from './CanvasType';
import { Subscription } from 'rxjs/Subscription';
import { LayerStateService, MorphabilityStatus } from './services/layerstate.service';
import { AnimatorService, CanvasResizeService, HoverStateService, SelectionStateService } from './services';
import * as $ from 'jquery';
import * as erd from 'element-resize-detector';

const IS_DEV_MODE = !environment.production;
const ELEMENT_RESIZE_DETECTOR = erd();

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {

  // TODO: need to warn user about svgs not being structurally identical somehow...
  // TODO: or give the user a way to update the incorrect path id names or something...?
  START_CANVAS = CanvasType.Start;
  PREVIEW_CANVAS = CanvasType.Preview;
  END_CANVAS = CanvasType.End;
  MORPHABILITY_NONE = MorphabilityStatus.None;
  MORPHABILITY_UNMORPHABLE = MorphabilityStatus.Unmorphable;
  MORPHABILITY_MORPHABLE = MorphabilityStatus.Morphable;
  morphabilityStatus = MorphabilityStatus.None;
  wasMorphable = false;
  private readonly subscriptions: Subscription[] = [];

  private canvasContainer: JQuery;
  private currentPaneWidth = 0;
  private currentPaneHeight = 0;

  @ViewChild('canvasContainer') private canvasContainerRef: ElementRef;

  constructor(
    private readonly layerStateService: LayerStateService,
    private readonly hoverStateService: HoverStateService,
    private readonly selectionStateService: SelectionStateService,
    private readonly animatorService: AnimatorService,
    private readonly canvasResizeService: CanvasResizeService) { }

  ngOnInit() {
    this.initKeyDownListener();
    this.initBeforeOnLoadListener();

    this.canvasContainer = $(this.canvasContainerRef.nativeElement);
    const updateCanvasSizes = () => {
      const numCanvases = this.wasMorphable ? 3 : 2;
      const width = this.canvasContainer.width() / numCanvases;
      const height = this.canvasContainer.height();
      if (this.currentPaneWidth !== width || this.currentPaneHeight !== height) {
        this.currentPaneWidth = width;
        this.currentPaneHeight = height;
        this.canvasResizeService.setSize(width, height);
      }
    };

    this.subscriptions.push(
      this.layerStateService.getMorphabilityStatusObservable().subscribe(status => {
        this.wasMorphable = this.wasMorphable || status === MorphabilityStatus.Morphable;
        if (this.morphabilityStatus !== status) {
          this.morphabilityStatus = status;
          updateCanvasSizes();
        }
      }));

    ELEMENT_RESIZE_DETECTOR.listenTo(this.canvasContainer.get(0), el => {
      updateCanvasSizes();
    });
  }

  ngOnDestroy() {
    ELEMENT_RESIZE_DETECTOR.removeAllListeners(this.canvasContainer.get(0));
    this.subscriptions.forEach(s => s.unsubscribe());
    $(window).unbind('keydown');
    $(window).unbind('beforeunload');
  }

  private initKeyDownListener() {
    $(window).on('keydown', event => {
      if (document.activeElement.matches('input')) {
        return true;
      }
      const isMorphable =
        this.layerStateService.getMorphabilityStatus() === MorphabilityStatus.Morphable;
      if (event.keyCode === 8 || event.keyCode === 46) {
        // In case there's a JS error, never navigate away.
        event.preventDefault();
        this.deleteSelectedSplitPoints();
        return false;
      } else if (event.keyCode === 32) {
        // Spacebar.
        if (isMorphable) {
          this.animatorService.toggle();
        }
        return false;
      } else if (event.keyCode === 37) {
        // Left arrow.
        if (isMorphable) {
          this.animatorService.rewind();
        }
      } else if (event.keyCode === 39) {
        // Right arrow.
        if (isMorphable) {
          this.animatorService.fastForward();
        }
      } else if (event.keyCode === 82) {
        // R.
        if (isMorphable) {
          this.animatorService.setIsRepeating(!this.animatorService.isRepeating());
        }
      } else if (event.keyCode === 83) {
        // S.
        if (isMorphable) {
          this.animatorService.setIsSlowMotion(!this.animatorService.isSlowMotion());
        }
      }
      return undefined;
    });
  }

  private initBeforeOnLoadListener() {
    // TODO: we should check to see if there are any dirty changes first
    $(window).on('beforeunload', event => {
      if (!IS_DEV_MODE) {
        return 'You\'ve made changes but haven\'t saved. ' +
          'Are you sure you want to navigate away?';
      }
      return undefined;
    });
  }

  /**
   * Deletes any selected split commands when the user clicks the delete key.
   */
  private deleteSelectedSplitPoints() {
    const selections = this.selectionStateService.getSelections();
    if (!selections.length) {
      return;
    }
    // Preconditions: all selections exist in the same editor and
    // all selections correspond to the currently active path id.
    const canvasType = selections[0].source;
    const activePathLayer = this.layerStateService.getActivePathLayer(canvasType);
    const unsplitOpsMap: Map<number, Array<{ subIdx: number, cmdIdx: number }>> = new Map();
    for (const selection of selections) {
      const {subIdx, cmdIdx} = selection.commandId;
      if (!activePathLayer.pathData.subPathCommands[subIdx].commands[cmdIdx].isSplit) {
        continue;
      }
      let subIdxOps = unsplitOpsMap.get(subIdx);
      if (!subIdxOps) {
        subIdxOps = [];
      }
      subIdxOps.push({ subIdx, cmdIdx });
      unsplitOpsMap.set(subIdx, subIdxOps);
    }
    this.hoverStateService.reset();
    this.selectionStateService.reset();
    unsplitOpsMap.forEach((ops, idx) => {
      // TODO: perform these as a single batch instead of inside a loop? (to reduce # of broadcasts)
      this.layerStateService.replaceActivePathCommand(
        canvasType, activePathLayer.pathData.unsplitBatch(ops), idx);
    });
  }
}
