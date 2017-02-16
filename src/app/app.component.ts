import {
  Component, OnInit, AfterViewInit, ElementRef,
  ViewChild, OnDestroy, HostListener
} from '@angular/core';
import { environment } from '../environments/environment';
import { Layer, VectorLayer, GroupLayer, PathLayer } from './scripts/layers';
import { VectorLayerLoader } from './scripts/parsers';
import { Point } from './scripts/common';
import { CanvasType } from './CanvasType';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { HoverStateService } from './services/hoverstate.service';
import { LayerStateService, Event as LayerStateEvent, MorphabilityStatus } from './services/layerstate.service';
import { DividerDragEvent } from './splitter/splitter.directive';
import { CanvasResizeService } from './services/canvasresize.service';
import { SelectionStateService } from './services/selectionstate.service';
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
    private layerStateService: LayerStateService,
    private hoverStateService: HoverStateService,
    private selectionStateService: SelectionStateService,
    private canvasResizeService: CanvasResizeService) { }

  ngOnInit() {
    this.canvasContainer = $(this.canvasContainerRef.nativeElement);

    // TODO: unregister these in ngOnDestroy
    this.initKeyDownListener();
    this.initBeforeOnLoadListener();

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
  }

  private initKeyDownListener() {
    // Register global key events.
    // TODO: unregister this in ngOnDestroy
    $(window).on('keydown', event => {
      if (document.activeElement.matches('input')) {
        return true;
      }
      if (event.keyCode === 8 || event.keyCode === 46) {
        // In case there's a JS error, never navigate away.
        event.preventDefault();
        this.deleteSelectedSplitPoints();
        return false;
      } else if (event.metaKey && event.keyCode === 'Z'.charCodeAt(0)) {
        // Undo/redo (Z key).
        // TODO: implement an undo service to keep track of undo/redo state.
        // return false;
      } else if (event.keyCode === 32) {
        // Spacebar.
        // TODO: start the currently displayed animation
        // return false;
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
