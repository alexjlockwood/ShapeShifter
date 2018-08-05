import { OverlayContainer } from '@angular/cdk/overlay';
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
import { DialogService, DropFilesAction } from 'app/modules/editor/components/dialogs';
import { ProjectService } from 'app/modules/editor/components/project';
import { ActionMode, ActionSource } from 'app/modules/editor/model/actionmode';
import { CursorType } from 'app/modules/editor/model/paper';
import { bugsnagClient } from 'app/modules/editor/scripts/bugsnag';
import { DestroyableMixin } from 'app/modules/editor/scripts/mixins';
import {
  ActionModeService,
  ClipboardService,
  FileImportService,
  LayerTimelineService,
  ShortcutService,
  ThemeService,
} from 'app/modules/editor/services';
import { Duration, SnackBarService } from 'app/modules/editor/services/snackbar.service';
import { State, Store } from 'app/modules/editor/store';
import { getActionMode, getActionModeHover } from 'app/modules/editor/store/actionmode/selectors';
import { isWorkspaceDirty } from 'app/modules/editor/store/common/selectors';
import { getCursorType } from 'app/modules/editor/store/paper/selectors';
import { ResetWorkspace } from 'app/modules/editor/store/reset/actions';
import * as erd from 'element-resize-detector';
import { environment } from 'environments/environment';
import * as $ from 'jquery';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { distinctUntilChanged, first, map } from 'rxjs/operators';

const IS_DEV_BUILD = !environment.production;
const ELEMENT_RESIZE_DETECTOR = erd({ strategy: 'scroll' });
const STORAGE_KEY_FIRST_TIME_USER = 'storage_key_first_time_user';

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

  readonly IS_BETA = environment.beta;

  @HostBinding('class.ss-dark-theme')
  isDarkThemeHostBinding: boolean;
  @ViewChild('displayContainer')
  displayContainerRef: ElementRef;
  private $displayContainer: JQuery;

  private readonly displayBoundsSubject = new BehaviorSubject<Size>({ w: 1, h: 1 });
  canvasBounds$: Observable<Size>;
  isActionMode$: Observable<boolean>;
  cursorClassName$: Observable<string>;

  constructor(
    private readonly snackBarService: SnackBarService,
    private readonly fileImportService: FileImportService,
    private readonly store: Store<State>,
    private readonly actionModeService: ActionModeService,
    private readonly shortcutService: ShortcutService,
    private readonly demoService: ProjectService,
    private readonly dialogService: DialogService,
    private readonly clipboardService: ClipboardService,
    private readonly layerTimelineService: LayerTimelineService,
    readonly themeService: ThemeService,
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
        const { classList } = this.overlayContainer.getContainerElement();
        if (isDark) {
          classList.add('ss-dark-theme');
        } else {
          classList.remove('ss-dark-theme');
        }
      }),
    );

    $(window).on('beforeunload', event => {
      let isDirty: boolean;
      this.store
        .select(isWorkspaceDirty)
        .pipe(first())
        .subscribe(dirty => (isDirty = dirty));
      if (isDirty && !IS_DEV_BUILD) {
        return `You've made changes but haven't saved. Are you sure you want to navigate away?`;
      }
      return undefined;
    });

    const displaySize$ = this.displayBoundsSubject.asObservable().pipe(
      distinctUntilChanged((s1, s2) => {
        return s1.w === s2.w && s1.h === s2.h;
      }),
    );
    this.isActionMode$ = this.store
      .select(getActionMode)
      .pipe(map(mode => mode !== ActionMode.None));
    this.canvasBounds$ = combineLatest(displaySize$, this.isActionMode$).pipe(
      map(([{ w, h }, shouldShowThreeCanvases]) => {
        return { w: w / (shouldShowThreeCanvases ? 3 : 1), h };
      }),
    );

    this.cursorClassName$ = combineLatest(
      this.store.select(getCursorType),
      this.store.select(getActionMode),
      this.store.select(getActionModeHover),
    ).pipe(
      map(([cursorType, mode, hover]) => {
        if (mode === ActionMode.SplitCommands || mode === ActionMode.SplitSubPaths) {
          return CursorType.Pen;
        } else if (hover) {
          return CursorType.Pointer;
        }
        return cursorType || CursorType.Default;
      }),
      map(cursorType => `cursor-${cursorType}`),
    );
  }

  ngAfterViewInit() {
    if (!this.isMobile()) {
      this.$displayContainer = $(this.displayContainerRef.nativeElement);
      ELEMENT_RESIZE_DETECTOR.listenTo(this.$displayContainer.get(0), () => {
        const w = this.$displayContainer.width();
        const h = this.$displayContainer.height();
        this.displayBoundsSubject.next({ w, h });
      });
    }

    if ('serviceWorker' in navigator) {
      const isFirstTimeUser = window.localStorage.getItem(STORAGE_KEY_FIRST_TIME_USER);
      if (!isFirstTimeUser) {
        window.localStorage.setItem(STORAGE_KEY_FIRST_TIME_USER, 'true');
        setTimeout(() => {
          this.snackBarService.show('Ready to work offline', 'Dismiss', Duration.Long);
        });
      }
    }

    const projectUrl = getUrlParameter('project');
    if (projectUrl) {
      this.demoService
        .getProject(projectUrl)
        .then(({ vectorLayer, animation, hiddenLayerIds }) => {
          this.store.dispatch(new ResetWorkspace(vectorLayer, animation, hiddenLayerIds));
        })
        .catch(e => {
          this.snackBarService.show(
            `There was a problem loading the Shape Shifter project`,
            'Dismiss',
            Duration.Long,
          );
        });
    }
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    if (!this.isMobile()) {
      ELEMENT_RESIZE_DETECTOR.removeAllListeners(this.$displayContainer.get(0));
    }
    this.shortcutService.destroy();
    this.clipboardService.destroy();
    $(window).unbind('beforeunload');
  }

  // Called by the DropTargetDirective.
  onDropFiles(fileList: FileList) {
    if (this.actionModeService.isActionMode()) {
      // TODO: make action mode automatically exit when layers/blocks are added in other parts of the app
      bugsnagClient.notify('Attempt to import files while in action mode', {
        severity: 'warning',
      });
      return;
    }
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

function getUrlParameter(name: string) {
  name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
  const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
  const results = regex.exec(location.search);
  return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}
