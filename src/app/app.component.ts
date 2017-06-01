import 'rxjs/add/operator/distinctUntilChanged';
import 'rxjs/add/operator/combineLatest';

import { environment } from '../environments/environment';
import { FileImporterService, ShortcutService } from './services';
import {
  ActionSource,
  AddLayers,
  State,
  Store,
} from './store';
import { isActionMode } from './store/actionmode/selectors';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { MdSnackBar } from '@angular/material';
import * as erd from 'element-resize-detector';
import * as $ from 'jquery';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';

const IS_DEV_BUILD = !environment.production;
const ELEMENT_RESIZE_DETECTOR = erd();
const STORAGE_KEY_FIRST_TIME_USER = 'storage_key_first_time_user';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly ACTION_SOURCE_FROM = ActionSource.From;
  readonly ACTION_SOURCE_ANIMATED = ActionSource.Animated;
  readonly ACTION_SOURCE_TO = ActionSource.To;

  @ViewChild('displayContainer') displayContainerRef: ElementRef;
  private $displayContainer: JQuery;

  private readonly displayBoundsSubject = new BehaviorSubject<Size>({ w: 1, h: 1 });
  canvasBounds$: Observable<Size>;
  isShapeShifterMode$: Observable<boolean>;

  constructor(
    private readonly snackBar: MdSnackBar,
    private readonly fileImporterService: FileImporterService,
    private readonly store: Store<State>,
    private readonly shortcutService: ShortcutService,
  ) { }

  ngOnInit() {
    this.shortcutService.init();

    // TODO: we should check to see if there are any dirty changes first
    $(window).on('beforeunload', event => {
      if (!IS_DEV_BUILD) {
        return 'You\'ve made changes but haven\'t saved. ' +
          'Are you sure you want to navigate away?';
      }
      return undefined;
    });

    const displaySize$ = this.displayBoundsSubject.asObservable()
      .distinctUntilChanged(({ w: w1, h: h1 }, { w: w2, h: h2 }) => {
        return w1 === w2 && h1 === h2;
      });
    this.isShapeShifterMode$ = this.store.select(isActionMode);
    this.canvasBounds$ = Observable.combineLatest(displaySize$, this.isShapeShifterMode$)
      .map(([{ w, h }, shouldShowThreeCanvases]) => {
        return { w: w / (shouldShowThreeCanvases ? 3 : 1), h };
      });
  }

  ngAfterViewInit() {
    this.$displayContainer = $(this.displayContainerRef.nativeElement);
    ELEMENT_RESIZE_DETECTOR.listenTo(this.$displayContainer.get(0), el => {
      const w = this.$displayContainer.width();
      const h = this.$displayContainer.height();
      this.displayBoundsSubject.next({ w, h });
    });

    if ('serviceWorker' in navigator) {
      const isFirstTimeUser = window.localStorage.getItem(STORAGE_KEY_FIRST_TIME_USER);
      if (!isFirstTimeUser) {
        window.localStorage.setItem(STORAGE_KEY_FIRST_TIME_USER, 'true');
        setTimeout(() => {
          this.snackBar.open('Ready to work offline', 'Dismiss', { duration: 5000 });
        });
      }
    }
  }

  ngOnDestroy() {
    ELEMENT_RESIZE_DETECTOR.removeAllListeners(this.$displayContainer.get(0));
    this.shortcutService.destroy();
    $(window).unbind('beforeunload');
  }

  // Called by the DropTargetDirective.
  onDropFiles(fileList: FileList) {
    this.fileImporterService.import(
      fileList,
      vls => {
        this.store.dispatch(new AddLayers(vls));
        this.snackBar.open(
          `Imported ${vls.length} path${vls.length === 1 ? '' : 's'}`,
          'Dismiss',
          { duration: 2750 });
      },
      () => {
        this.snackBar.open(
          `Couldn't import paths from SVG.`,
          'Dismiss',
          { duration: 5000 });
      });
  }
}

interface Size {
  readonly w: number;
  readonly h: number;
}
