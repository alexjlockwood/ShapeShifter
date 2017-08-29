import 'rxjs/add/operator/distinctUntilChanged';
import 'rxjs/add/operator/combineLatest';
import 'rxjs/add/operator/map';

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostBinding,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { OverlayContainer } from '@angular/material';
import { DropFilesAction } from 'app/components/dialogs';
import { ActionMode, ActionSource } from 'app/model/actionmode';
import { DestroyableMixin } from 'app/scripts/mixins';
import {
  ActionModeService,
  ClipboardService,
  DemoService,
  DialogService,
  FileImportService,
  LayerTimelineService,
  ShortcutService,
  ThemeService,
} from 'app/services';
import { Duration, SnackBarService } from 'app/services/snackbar.service';
import { State, Store } from 'app/store';
import { getActionMode, getActionModeHover } from 'app/store/actionmode/selectors';
import { isWorkspaceDirty } from 'app/store/common/selectors';
import { ResetWorkspace } from 'app/store/reset/actions';
import * as erd from 'element-resize-detector';
import { environment } from 'environments/environment';
import * as $ from 'jquery';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';

const SHOULD_AUTO_LOAD_DEMO = false;
const IS_DEV_BUILD = !environment.production;
const ELEMENT_RESIZE_DETECTOR = erd({ strategy: 'scroll' });
const STORAGE_KEY_FIRST_TIME_USER = 'storage_key_first_time_user';

enum CursorType {
  Default = 1,
  Pointer,
  Pen,
}

@Component({
  selector: 'app-root',
  templateUrl: './root.component.html',
  styleUrls: ['./root.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RootComponent extends DestroyableMixin() implements OnInit, AfterViewInit, OnDestroy {
  readonly ACTION_SOURCE_FROM = ActionSource.From;
  readonly ACTION_SOURCE_ANIMATED = ActionSource.Animated;
  readonly ACTION_SOURCE_TO = ActionSource.To;

  readonly CURSOR_DEFAULT = CursorType.Default;
  readonly CURSOR_POINTER = CursorType.Pointer;
  readonly CURSOR_PEN = CursorType.Pen;

  @HostBinding('class.ss-dark-theme') isDarkThemeHostBinding: boolean;
  @ViewChild('displayContainer') displayContainerRef: ElementRef;
  private $displayContainer: JQuery;

  private readonly displayBoundsSubject = new BehaviorSubject<Size>({ w: 1, h: 1 });
  canvasBounds$: Observable<Size>;
  isActionMode$: Observable<boolean>;
  cursorType$: Observable<CursorType>;

  constructor(
    private readonly snackBarService: SnackBarService,
    private readonly fileImportService: FileImportService,
    private readonly store: Store<State>,
    private readonly actionModeService: ActionModeService,
    private readonly shortcutService: ShortcutService,
    private readonly demoService: DemoService,
    private readonly dialogService: DialogService,
    private readonly clipboardService: ClipboardService,
    private readonly layerTimelineService: LayerTimelineService,
    public readonly themeService: ThemeService,
    private readonly overlayContainer: OverlayContainer,
  ) {
    super();
  }

  ngOnInit() {
    this.shortcutService.init();
    this.clipboardService.init();

    this.registerSubscription(
      this.themeService.asObservable().subscribe(t => {
        const isDark = t.themeType === 'dark';
        this.isDarkThemeHostBinding = isDark;
        this.overlayContainer.themeClass = isDark ? 'ss-dark-theme' : undefined;
      }),
    );

    $(window).on('beforeunload', event => {
      let isDirty: boolean;
      this.store.select(isWorkspaceDirty).first().subscribe(dirty => (isDirty = dirty));
      if (isDirty && !IS_DEV_BUILD) {
        return `You've made changes but haven't saved. Are you sure you want to navigate away?`;
      }
      return undefined;
    });

    const displaySize$ = this.displayBoundsSubject.asObservable().distinctUntilChanged((s1, s2) => {
      return s1.w === s2.w && s1.h === s2.h;
    });
    this.isActionMode$ = this.store.select(getActionMode).map(mode => mode !== ActionMode.None);
    this.canvasBounds$ = Observable.combineLatest(
      displaySize$,
      this.isActionMode$,
    ).map(([{ w, h }, shouldShowThreeCanvases]) => {
      return { w: w / (shouldShowThreeCanvases ? 3 : 1), h };
    });

    this.cursorType$ = Observable.combineLatest(
      this.store.select(getActionMode),
      this.store.select(getActionModeHover),
    ).map(([mode, hover]) => {
      if (mode === ActionMode.SplitCommands || mode === ActionMode.SplitSubPaths) {
        return CursorType.Pen;
      } else if (hover) {
        return CursorType.Pointer;
      }
      return CursorType.Default;
    });
  }

  ngAfterViewInit() {
    this.$displayContainer = $(this.displayContainerRef.nativeElement);
    ELEMENT_RESIZE_DETECTOR.listenTo(this.$displayContainer.get(0), () => {
      const w = this.$displayContainer.width();
      const h = this.$displayContainer.height();
      this.displayBoundsSubject.next({ w, h });
    });

    if ('serviceWorker' in navigator) {
      const isFirstTimeUser = window.localStorage.getItem(STORAGE_KEY_FIRST_TIME_USER);
      if (!isFirstTimeUser) {
        window.localStorage.setItem(STORAGE_KEY_FIRST_TIME_USER, 'true');
        setTimeout(() => {
          this.snackBarService.show('Ready to work offline', 'Dismiss', Duration.Long);
        });
      }
    }

    if (IS_DEV_BUILD && SHOULD_AUTO_LOAD_DEMO) {
      this.demoService
        .getDemo('morphinganimals')
        .then(({ vectorLayer, animation, hiddenLayerIds }) => {
          this.store.dispatch(new ResetWorkspace(vectorLayer, animation, hiddenLayerIds));
        });
    }
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    ELEMENT_RESIZE_DETECTOR.removeAllListeners(this.$displayContainer.get(0));
    this.shortcutService.destroy();
    this.clipboardService.destroy();
    $(window).unbind('beforeunload');
  }

  // Called by the DropTargetDirective.
  onDropFiles(fileList: FileList) {
    if (!fileList || !fileList.length) {
      return;
    }
    const files: File[] = [];
    // tslint:disable-next-line: prefer-for-of
    for (let i = 0; i < fileList.length; i++) {
      files.push(fileList[i]);
    }
    const type = files[0].type;
    if (!files.every(file => file.type === type)) {
      // TODO: handle attempts to import different types of files better
      return;
    }
    if (type === 'application/json' || files[0].name.match(/\.shapeshifter$/)) {
      // TODO: Show a dialog here as well?
      this.fileImportService.import(fileList, true /* resetWorkspace */);
      return;
    }

    this.dialogService.dropFiles().subscribe(action => {
      if (action === DropFilesAction.AddToWorkspace) {
        this.fileImportService.import(fileList);
      } else if (action === DropFilesAction.ResetWorkspace) {
        this.fileImportService.import(fileList, true /* resetWorkspace */);
      }
    });
  }

  onClick(event: MouseEvent) {
    const actionMode = this.actionModeService.getActionMode();
    if (actionMode === ActionMode.None) {
      this.layerTimelineService.clearSelections();
    } else if (actionMode === ActionMode.Selection) {
      this.actionModeService.setSelections([]);
    } else {
      this.actionModeService.setActionMode(ActionMode.Selection);
    }
  }

  isMobile() {
    return window.navigator.userAgent.includes('Mobile');
  }
}

interface Size {
  readonly w: number;
  readonly h: number;
}
