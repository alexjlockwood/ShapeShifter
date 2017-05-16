import * as $ from 'jquery';
import * as erd from 'element-resize-detector';
import {
  Component, OnInit, ViewChild, AfterViewInit,
  OnDestroy, ElementRef, ChangeDetectionStrategy
} from '@angular/core';
import { MdSnackBar } from '@angular/material';
import { environment } from '../environments/environment';
import {
  CanvasResizeService,
  FileImporterService,
  ShortcutService,
} from './services';
import 'rxjs/add/observable/combineLatest';
import {
  Store,
  State,
  AddLayers,
} from './store';

const IS_DEV_MODE = !environment.production;
const ELEMENT_RESIZE_DETECTOR = erd();
const STORAGE_KEY_FIRST_TIME_USER = 'storage_key_first_time_user';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {

  private canvasContainer: JQuery;
  private currentPaneWidth = 0;
  private currentPaneHeight = 0;

  @ViewChild('canvasContainer') private canvasContainerRef: ElementRef;

  constructor(
    private readonly snackBar: MdSnackBar,
    private readonly fileImporterService: FileImporterService,
    private readonly canvasResizeService: CanvasResizeService,
    private readonly store: Store<State>,
    private readonly shortcutService: ShortcutService,
  ) { }

  ngOnInit() {
    this.shortcutService.init();

    // TODO: we should check to see if there are any dirty changes first
    $(window).on('beforeunload', event => {
      if (!IS_DEV_MODE) {
        return 'You\'ve made changes but haven\'t saved. ' +
          'Are you sure you want to navigate away?';
      }
      return undefined;
    });
  }

  ngAfterViewInit() {
    this.canvasContainer = $(this.canvasContainerRef.nativeElement);
    const updateCanvasSizes = () => {
      const width = this.canvasContainer.width();
      const height = this.canvasContainer.height();
      if (this.currentPaneWidth !== width
        || this.currentPaneHeight !== height) {
        this.currentPaneWidth = width;
        this.currentPaneHeight = height;
        this.canvasResizeService.setSize(width, height);
      }
    };

    ELEMENT_RESIZE_DETECTOR.listenTo(this.canvasContainer.get(0), el => {
      updateCanvasSizes();
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
    ELEMENT_RESIZE_DETECTOR.removeAllListeners(this.canvasContainer.get(0));
    this.shortcutService.destroy();
    $(window).unbind('beforeunload');
  }

  // Called by the DropTargetDirective.
  onDropFiles(fileList: FileList) {
    this.fileImporterService.import(
      fileList,
      vls => {
        this.store.dispatch(new AddLayers(vls, true /* delete empty vector layer */));
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
