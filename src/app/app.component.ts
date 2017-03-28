import {
  Component, OnInit, ViewChild, AfterViewInit,
  OnDestroy, ElementRef, ChangeDetectionStrategy
} from '@angular/core';
import { environment } from '../environments/environment';
import { CanvasType } from './CanvasType';
import { Subscription } from 'rxjs/Subscription';
import { Observable } from 'rxjs/Observable';
import { SubPath, Command, PathUtil } from './scripts/commands';
import {
  AnimatorService,
  CanvasResizeService,
  SelectionStateService,
  CanvasModeService,
  CanvasMode,
  LayerStateService,
  MorphabilityStatus,
} from './services';
import * as $ from 'jquery';
import * as erd from 'element-resize-detector';
import * as _ from 'lodash';
import { MdSnackBar } from '@angular/material';
import { DemoUtil, DEMO_MAP } from './scripts/demos';

const IS_DEV_MODE = !environment.production;
const AUTO_LOAD_DEMO = IS_DEV_MODE && true;
const ELEMENT_RESIZE_DETECTOR = erd();
const STORAGE_KEY_FIRST_TIME_USER = 'storage_key_first_time_user';

// TODO: hide/disable pair subpaths mode if there is only one subpath each
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  ARE_CANVAS_MODES_ENABLED = IS_DEV_MODE && true;

  START_CANVAS = CanvasType.Start;
  PREVIEW_CANVAS = CanvasType.Preview;
  END_CANVAS = CanvasType.End;

  SELECT_POINTS_MODE = CanvasMode.SelectPoints;
  ADD_POINTS_MODE = CanvasMode.AddPoints;
  PAIR_SUBPATHS_MODE = CanvasMode.PairSubPaths;
  SPLIT_SUBPATHS_MODE = CanvasMode.SplitSubPaths;

  MORPHABILITY_NONE = MorphabilityStatus.None;
  MORPHABILITY_UNMORPHABLE = MorphabilityStatus.Unmorphable;
  MORPHABILITY_MORPHABLE = MorphabilityStatus.Morphable;

  morphabilityStatus = MorphabilityStatus.None;
  morphabilityStatusTextObservable: Observable<string>;
  wasMorphable = false;

  canvasModeObservable: Observable<CanvasMode>;

  private readonly subscriptions: Subscription[] = [];

  private canvasContainer: JQuery;
  private currentPaneWidth = 0;
  private currentPaneHeight = 0;

  @ViewChild('canvasContainer') private canvasContainerRef: ElementRef;

  constructor(
    private readonly snackBar: MdSnackBar,
    private readonly layerStateService: LayerStateService,
    private readonly selectionStateService: SelectionStateService,
    private readonly animatorService: AnimatorService,
    private readonly canvasResizeService: CanvasResizeService,
    // This is public so that it can be accessed by the template.
    public readonly canvasModeService: CanvasModeService,
  ) { }

  ngOnInit() {
    this.canvasModeObservable = this.canvasModeService.getCanvasModeObservable();
    this.morphabilityStatusTextObservable =
      this.layerStateService.getMorphabilityStatusObservable()
        .map(status => {
          if (status === MorphabilityStatus.Morphable) {
            const hasClosedPath =
              _.chain([CanvasType.Start, CanvasType.End])
                .map(type => this.layerStateService.getActivePathLayer(type).pathData)
                .flatMap(path => path.getSubPaths() as SubPath[])
                .some((subPath: SubPath) => subPath.isClosed())
                .value();
            const hasSplitCmd =
              _.chain([CanvasType.Start, CanvasType.End])
                .map(type => this.layerStateService.getActivePathLayer(type).pathData)
                .flatMap(path => path.getCommands() as Command[])
                .some((cmd: Command) => cmd.isSplit())
                .value();
            return `Reverse${hasClosedPath ? '/shift' : ''} `
              + `the points below ${hasSplitCmd ? 'or drag the orange points above' : ''} `
              + `to alter the animation`;
          }
          if (status === MorphabilityStatus.Unmorphable) {
            const startLayer = this.layerStateService.getActivePathLayer(CanvasType.Start);
            const endLayer = this.layerStateService.getActivePathLayer(CanvasType.End);
            const startCommand = startLayer.pathData;
            const endCommand = endLayer.pathData;
            if (startCommand.getSubPaths().length !== endCommand.getSubPaths().length) {
              return 'Unmorphable '
                + '(<a href="https://github.com/alexjlockwood/ShapeShifter/issues/11" target="_blank">help</a>)';
            }
            for (let i = 0; i < startCommand.getSubPaths().length; i++) {
              const startCmds = startCommand.getSubPaths()[i].getCommands();
              const endCmds = endCommand.getSubPaths()[i].getCommands();
              if (startCmds.length !== endCmds.length) {
                const pathLetter = startCmds.length < endCmds.length ? 'a' : 'b';
                const diff = Math.abs(startCmds.length - endCmds.length);
                if (diff === 1) {
                  return `Add 1 point to <i>subpath #${i + 1}${pathLetter}</i>`;
                } else {
                  return `Add ${diff} points to <i>subpath #${i + 1}${pathLetter}</i>`;
                }
              }
            }
            // The user should never get to this point, but just in case.
            return 'Unmorphable';
          }
          return '';
        });
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
        this.wasMorphable =
          status !== MorphabilityStatus.None && (this.wasMorphable || status === MorphabilityStatus.Morphable);
        if (this.morphabilityStatus !== status) {
          this.morphabilityStatus = status;
          updateCanvasSizes();
        }
      }));

    this.subscriptions.push(
      this.canvasModeService.getCanvasModeObservable().subscribe(canvasMode => {
        if (canvasMode !== CanvasMode.SelectPoints) {
          // Clear all current selections if we are leaving selection mode.
          this.selectionStateService.reset();
        }
      }));

    ELEMENT_RESIZE_DETECTOR.listenTo(this.canvasContainer.get(0), el => {
      updateCanvasSizes();
    });
  }

  ngAfterViewInit() {
    if ('serviceWorker' in navigator) {
      const isFirstTimeUser = window.localStorage.getItem(STORAGE_KEY_FIRST_TIME_USER);
      if (!isFirstTimeUser) {
        window.localStorage.setItem(STORAGE_KEY_FIRST_TIME_USER, 'true');
        setTimeout(() => {
          this.snackBar.open('Ready to work offline', 'Dismiss', { duration: 5000 });
        });
      }
    }
    if (AUTO_LOAD_DEMO) {
      this.autoLoadDemo();
    }
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
      // TODO: don't do anything if user is also clicking 'meta' or 'shift' key?
      // TOOD: i.e. meta + R means refresh page so don't rewind?
      const isMorphable =
        this.layerStateService.getMorphabilityStatus() === MorphabilityStatus.Morphable;
      if (event.keyCode === 8 || event.keyCode === 46) {
        // In case there's a JS error, never navigate away.
        event.preventDefault();
        if (this.canvasModeService.getCanvasMode() === CanvasMode.SelectPoints) {
          // Can only delete points in selection mode.
          PathUtil.deleteSelectedSplitPoints(
            this.layerStateService,
            this.selectionStateService);
        }
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
      } /* else if (event.keyCode === 220) {
        // Used for debugging purposes.
        const activePath = this.layerStateService.getActivePathLayer(CanvasType.Start);
        if (activePath) {
          const path = activePath.pathData;
          const indices = _.shuffle(path.getSubPaths().map((_, i) => i));
          if (indices.length > 1) {
            for (let i = 0; i < indices.length; i++) {
              this.layerStateService.updateActivePath(
                CanvasType.Start,
                path.moveSubPath(indices[0], indices[1]),
                indices[i],
                i === indices.length - 1);
            }
          }
        }
      } */
      return undefined;
    });
  }

  private initBeforeOnLoadListener() {
    // TODO: we should check to see if there are any dirty changes first
    $(window).on('beforeunload', event => {
      if (!IS_DEV_MODE
        && (this.layerStateService.getVectorLayer(CanvasType.Start)
          || this.layerStateService.getVectorLayer(CanvasType.End))) {
        return 'You\'ve made changes but haven\'t saved. ' +
          'Are you sure you want to navigate away?';
      }
      return undefined;
    });
  }

  private autoLoadDemo() {
    setTimeout(() => {
      DemoUtil.loadDemo(this.layerStateService, DEMO_MAP.get('Morphing digits'));
    });
  }
}

