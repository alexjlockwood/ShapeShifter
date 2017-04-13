import * as $ from 'jquery';
import * as erd from 'element-resize-detector';
import * as _ from 'lodash';
import {
  Component, OnInit, ViewChild, AfterViewInit,
  OnDestroy, ElementRef, ChangeDetectionStrategy
} from '@angular/core';
import { MdSnackBar } from '@angular/material';
import { environment } from '../environments/environment';
import { Subscription } from 'rxjs/Subscription';
import { Observable } from 'rxjs/Observable';
import { CanvasType } from './CanvasType';
import { VectorLayer, PathLayer, LayerUtil } from './scripts/layers';
import { SvgLoader, VectorDrawableLoader } from './scripts/import';
import { SubPath, Command } from './scripts/paths';
import {
  AnimatorService,
  CanvasResizeService,
  SelectionService,
  SelectionType,
  AppModeService,
  AppMode,
  StateService,
  MorphStatus,
  FilePickerService,
} from './services';
import { deleteSelectedSplitPoints } from './services/selection.service';
import { DemoUtil, DEMO_MAP } from './scripts/demos';
import 'rxjs/add/observable/combineLatest';

const IS_DEV_MODE = !environment.production;
const AUTO_LOAD_DEMO = IS_DEV_MODE && true;
const ELEMENT_RESIZE_DETECTOR = erd();
const STORAGE_KEY_FIRST_TIME_USER = 'storage_key_first_time_user';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly START_CANVAS = CanvasType.Start;
  readonly PREVIEW_CANVAS = CanvasType.Preview;
  readonly END_CANVAS = CanvasType.End;

  readonly SELECTION_MODE = AppMode.Selection;
  readonly SPLIT_COMMANDS_MODE = AppMode.SplitCommands;
  readonly SPLIT_SUBPATHS_MODE = AppMode.SplitSubPaths;

  readonly MORPH_NONE = MorphStatus.None;
  readonly MORPH_UNMORPHABLE = MorphStatus.Unmorphable;
  readonly MORPH_MORPHABLE = MorphStatus.Morphable;

  appModeObservable: Observable<AppMode>;
  statusTextObservable: Observable<string>;
  wasMorphable = false;

  private readonly subscriptions: Subscription[] = [];

  private canvasContainer: JQuery;
  private currentPaneWidth = 0;
  private currentPaneHeight = 0;

  private pendingFilePickerCanvasType: CanvasType;
  private isAppModeKeyboardShortcutActive = false;

  @ViewChild('canvasContainer') private canvasContainerRef: ElementRef;

  constructor(
    private readonly snackBar: MdSnackBar,
    private readonly filePickerService: FilePickerService,
    private readonly stateService: StateService,
    private readonly selectionService: SelectionService,
    private readonly animatorService: AnimatorService,
    private readonly canvasResizeService: CanvasResizeService,
    // This is public so that it can be accessed by the template.
    public readonly appModeService: AppModeService,
  ) { }

  ngOnInit() {
    this.appModeObservable = this.appModeService.asObservable();
    this.statusTextObservable =
      Observable.combineLatest(
        this.stateService.getMorphStatusObservable(),
        this.selectionService.asObservable(),
        this.appModeService.asObservable(),
      ).map(obj => {
        const [status, selections, appMode] = obj;
        const startLayer = this.stateService.getActivePathLayer(CanvasType.Start);
        const endLayer = this.stateService.getActivePathLayer(CanvasType.End);
        if (!startLayer || !endLayer) {
          // TODO: should we display a message here? does this ever even happen?
          return '';
        }

        if (appMode === AppMode.SplitSubPaths) {
          // TODO: show better user messaging when attempting to morph btw stroked and fill paths
          if (startLayer.isFilled() && endLayer.isFilled()) {
            return 'Draw a line across a subpath to split it into 2';
          } else if (startLayer.isStroked() && endLayer.isStroked()) {
            return 'Choose a point along a subpath to split it into 2';
          }
        }

        if (appMode === AppMode.Selection) {
          const subPathSelections = selections.filter(s => s.type === SelectionType.SubPath);
          if (subPathSelections.length) {
            const { source, subIdx } = subPathSelections[0];
            const startPath = startLayer.pathData;
            const endPath = endLayer.pathData;
            const isSourceStart = source === CanvasType.Start;
            const oppSubPaths =
              (isSourceStart ? endPath : startPath).getSubPaths().filter(s => !s.isCollapsing());
            const numOppSubPaths = oppSubPaths.length;
            const numAvailableOppSubPaths = numOppSubPaths - (subIdx < numOppSubPaths ? 1 : 0);
            const sourceSubPathName = `<i>Subpath #${subIdx + 1}${isSourceStart ? 'a' : 'b'}</i>`;
            if (!numAvailableOppSubPaths) {
              return `${sourceSubPathName} selected`;
            }
            const direction = isSourceStart ? 'right' : 'left';
            return `${sourceSubPathName} selected. `
              + `Choose a corresponding subpath on the ${direction} to customize the animation.`;
          }
        }

        if (status === MorphStatus.Morphable) {
          const hasClosedPath =
            _.chain([CanvasType.Start, CanvasType.End])
              .map(type => this.stateService.getActivePathLayer(type).pathData)
              .flatMap(path => path.getSubPaths() as SubPath[])
              .some((subPath: SubPath) => subPath.isClosed() && !subPath.isCollapsing())
              .value();
          const hasSplitCmd =
            _.chain([CanvasType.Start, CanvasType.End])
              .map(type => this.stateService.getActivePathLayer(type).pathData)
              .flatMap(path => path.getCommands() as Command[])
              .some((cmd: Command) => cmd.isSplit())
              .value();
          return `Reverse${hasClosedPath ? '/shift' : ''} `
            + `the points below ${hasSplitCmd ? 'or drag the orange points above' : ''} `
            + `to customize the animation`;
        }
        if (status === MorphStatus.Unmorphable) {
          const startCommand = startLayer.pathData;
          const endCommand = endLayer.pathData;
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
          // The user should never get to this point, but fallthrough just in case.
        }
        return '';
      });
    this.initKeyCodeListeners();
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
      this.stateService.getMorphStatusObservable().subscribe(status => {
        this.wasMorphable =
          status !== MorphStatus.None && (this.wasMorphable || status === MorphStatus.Morphable);
        updateCanvasSizes();
      }));

    this.subscriptions.push(
      this.filePickerService.asObservable()
        .subscribe((canvasType: CanvasType) => this.addPathsFromSvg(canvasType)));

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
    $(window).unbind('keyup');
    $(window).unbind('beforeunload');
  }

  get morphStatus() {
    return this.stateService.getMorphStatus();
  }

  onCanvasContainerClick() {
    // TODO: is this hacky? should we be using onBlur() to reset the app mode?
    this.appModeService.setAppMode(AppMode.Selection);
  }

  private initKeyCodeListeners() {
    const getAppModeShortcutFn = (event: JQueryEventObject) => {
      if (this.isMacOs() ? event.metaKey : event.ctrlKey) {
        if (event.altKey) {
          return AppMode.SplitSubPaths;
        }
        return AppMode.SplitCommands;
      }
      return undefined;
    };

    $(window).on('keydown', event => {
      if (document.activeElement.matches('input')) {
        // Ignore shortcuts when an input element has focus.
        return true;
      }

      const newAppMode = getAppModeShortcutFn(event);
      if (newAppMode) {
        this.isAppModeKeyboardShortcutActive = true;
        this.appModeService.setAppMode(newAppMode);
      }

      const isMorphable = this.stateService.getMorphStatus() === MorphStatus.Morphable;
      if (event.keyCode === 8 || event.keyCode === 46) {
        // In case there's a JS error, never navigate away.
        event.preventDefault();
        if (this.appModeService.getAppMode() === AppMode.Selection) {
          // Can only delete points in selection mode.
          deleteSelectedSplitPoints(
            this.stateService,
            this.selectionService);
        }
        return false;
      }
      if (event.keyCode === 32) {
        // Spacebar.
        if (isMorphable) {
          this.animatorService.toggle();
        }
        return false;
      }
      if (event.keyCode === 37) {
        // Left arrow.
        if (isMorphable) {
          this.animatorService.rewind();
        }
        return false;
      }
      if (event.keyCode === 39) {
        // Right arrow.
        if (isMorphable) {
          this.animatorService.fastForward();
        }
        return false;
      }
      if (event.keyCode === 82 && !event.ctrlKey && !event.metaKey) {
        // R.
        if (isMorphable) {
          this.animatorService.setIsRepeating(!this.animatorService.isRepeating());
        }
        return false;
      }
      if (event.keyCode === 83) {
        // S.
        if (isMorphable) {
          this.animatorService.setIsSlowMotion(!this.animatorService.isSlowMotion());
        }
        return false;
      }
      return undefined;
    });

    $(window).on('keyup', event => {
      if (this.isAppModeKeyboardShortcutActive) {
        const newAppMode = getAppModeShortcutFn(event);
        if (newAppMode) {
          this.appModeService.setAppMode(newAppMode);
        } else {
          this.appModeService.setAppMode(AppMode.Selection);
          this.isAppModeKeyboardShortcutActive = false;
        }
      }
      return undefined;
    });
  }

  private initBeforeOnLoadListener() {
    // TODO: we should check to see if there are any dirty changes first
    $(window).on('beforeunload', event => {
      if (!IS_DEV_MODE
        && (this.stateService.getVectorLayer(CanvasType.Start)
          || this.stateService.getVectorLayer(CanvasType.End))) {
        return 'You\'ve made changes but haven\'t saved. ' +
          'Are you sure you want to navigate away?';
      }
      return undefined;
    });
  }

  getSplitCommandsKeyboardShortcut() {
    return this.isMacOs() ? '⌘' : 'Ctrl';
  }

  getSplitSubPathsKeyboardShortcut() {
    return this.isMacOs() ? '⌘⌥' : 'Ctrl + Alt';
  }

  private isMacOs() {
    return navigator.appVersion.indexOf('Mac') >= 0;
  }

  // Proxies a button click to the <input> tag that opens the file picker.
  addPathsFromSvg(canvasType?: CanvasType) {
    this.pendingFilePickerCanvasType = canvasType;
    $('#addPathsFromSvgButton').click();
  }

  // Called when the user picks a file from the file picker.
  onSvgFilesPicked(fileList: FileList) {
    const pendingCanvasType = this.pendingFilePickerCanvasType;
    this.pendingFilePickerCanvasType = undefined;
    if (!fileList || !fileList.length) {
      console.warn('Failed to load SVG file');
      return;
    }

    const files: File[] = [];
    for (let i = 0; i < fileList.length; i++) {
      files.push(fileList[i]);
    }

    let numCallbacks = 0;
    let numErrors = 0;
    const vls: VectorLayer[] = [];
    const maybeAddVectorLayersFn = () => {
      numCallbacks++;
      if (numErrors === files.length) {
        this.snackBar.open(
          `Couldn't import paths from SVG.`,
          'Dismiss',
          { duration: 5000 });
      } else if (numCallbacks === files.length) {
        const importedPathIds = LayerUtil.getAllIds(vls, l => l instanceof PathLayer);
        const numImportedPaths = importedPathIds.length;
        this.stateService.addVectorLayers(vls);
        const canvasTypesToCheck =
          pendingCanvasType === undefined
            ? [CanvasType.Start, CanvasType.End]
            : [pendingCanvasType];
        for (const canvasType of canvasTypesToCheck) {
          const activePathId = this.stateService.getActivePathId(canvasType);
          if (activePathId) {
            continue;
          }
          this.stateService.setActivePathId(canvasType, importedPathIds.shift());
        }
        this.snackBar.open(
          `Imported ${numImportedPaths} path${numImportedPaths === 1 ? '' : 's'}`,
          'Dismiss',
          { duration: 2750 });
      }
    };

    const currentIds = LayerUtil.getAllIds(this.stateService.getImportedVectorLayers());
    for (const file of files) {
      const fileReader = new FileReader();

      fileReader.onload = event => {
        const svgText = (event.target as any).result;
        SvgLoader.loadVectorLayerFromSvgStringWithCallback(svgText, vectorLayer => {
          if (!vectorLayer) {
            numErrors++;
            maybeAddVectorLayersFn();
            return;
          }
          vls.push(vectorLayer);
          currentIds.push(...LayerUtil.getAllIds([vectorLayer]));
          maybeAddVectorLayersFn();
        }, currentIds);
      };

      fileReader.onerror = event => {
        const target = event.target as any;
        switch (target.error.code) {
          case target.error.NOT_FOUND_ERR:
            alert('File not found');
            break;
          case target.error.NOT_READABLE_ERR:
            alert('File is not readable');
            break;
          case target.error.ABORT_ERR:
            break;
          default:
            alert('An error occurred reading this file');
        }
        numErrors++;
        maybeAddVectorLayersFn();
      };

      fileReader.onabort = event => {
        alert('File read cancelled');
      };

      fileReader.readAsText(file);
    }
  }

  // Proxies a button click to the <input> tag that opens the file picker.
  addPathsFromXml(canvasType?: CanvasType) {
    $('#addPathsFromXmlButton').click();
  }

  // Called when the user picks a file from the file picker.
  onXmlFilesPicked(fileList: FileList) {
    if (!fileList || !fileList.length) {
      console.warn('Failed to load XML file');
      return;
    }

    const files: File[] = [];
    for (let i = 0; i < fileList.length; i++) {
      files.push(fileList[i]);
    }

    let numCallbacks = 0;
    let numErrors = 0;
    const vls: VectorLayer[] = [];
    const maybeAddVectorLayersFn = () => {
      numCallbacks++;
      if (numErrors === files.length) {
        this.snackBar.open(
          `Couldn't import the paths from XML.`,
          'Dismiss',
          { duration: 5000 });
      } else if (numCallbacks === files.length) {
        const importedPathIds = LayerUtil.getAllIds(vls, l => l instanceof PathLayer);
        const numImportedPaths = importedPathIds.length;
        this.stateService.addVectorLayers(vls);
        for (const canvasType of [CanvasType.Start, CanvasType.End]) {
          const activePathId = this.stateService.getActivePathId(canvasType);
          if (activePathId) {
            continue;
          }
          this.stateService.setActivePathId(canvasType, importedPathIds.shift());
        }
        this.snackBar.open(
          `Imported ${numImportedPaths} path${numImportedPaths === 1 ? '' : 's'}`,
          'Dismiss',
          { duration: 2750 });
      }
    };

    const currentIds = LayerUtil.getAllIds(this.stateService.getImportedVectorLayers());
    for (const file of files) {
      const fileReader = new FileReader();

      fileReader.onload = event => {
        const xmlText = (event.target as any).result;
        const vectorLayer = VectorDrawableLoader.loadVectorLayerFromXmlString(xmlText, currentIds);
        vls.push(vectorLayer);
        currentIds.push(...LayerUtil.getAllIds([vectorLayer]));
        maybeAddVectorLayersFn();
      };

      fileReader.onerror = event => {
        const target = event.target as any;
        switch (target.error.code) {
          case target.error.NOT_FOUND_ERR:
            alert('File not found');
            break;
          case target.error.NOT_READABLE_ERR:
            alert('File is not readable');
            break;
          case target.error.ABORT_ERR:
            break;
          default:
            alert('An error occurred reading this file');
        }
        numErrors++;
        maybeAddVectorLayersFn();
      };

      fileReader.onabort = event => {
        alert('File read cancelled');
      };

      fileReader.readAsText(file);
    }
  }

  private autoLoadDemo() {
    setTimeout(() => {
      DemoUtil.loadDemo(this.stateService, DEMO_MAP.get('Play-to-pause icon'));
    });
  }
}

