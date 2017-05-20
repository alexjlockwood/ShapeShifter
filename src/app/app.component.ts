import * as $ from 'jquery';
import * as erd from 'element-resize-detector';
import {
  Component, OnInit, ViewChild, AfterViewInit,
  OnDestroy, ElementRef, ChangeDetectionStrategy
} from '@angular/core';
import { MdSnackBar } from '@angular/material';
import { environment } from '../environments/environment';
import { FileImporterService, ShortcutService } from './services';
import 'rxjs/add/observable/combineLatest';
import { Store, State, AddLayers } from './store';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/distinctUntilChanged';

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

  private readonly boundsSubject = new BehaviorSubject<Size>({ w: 1, h: 1 });
  readonly boundsObservable = this.boundsSubject.asObservable()
    .distinctUntilChanged(({ w: w1, h: h1 }, { w: w2, h: h2 }) => {
      return w1 === w2 && h1 === h2;
    });

  @ViewChild('displayContainer') displayContainerRef: ElementRef;
  private $displayContainer: JQuery;

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
      if (!IS_DEV_MODE) {
        return 'You\'ve made changes but haven\'t saved. ' +
          'Are you sure you want to navigate away?';
      }
      return undefined;
    });
  }

  ngAfterViewInit() {
    this.$displayContainer = $(this.displayContainerRef.nativeElement);
    ELEMENT_RESIZE_DETECTOR.listenTo(this.$displayContainer.get(0), el => {
      const w = this.$displayContainer.width();
      const h = this.$displayContainer.height();
      this.boundsSubject.next({ w, h });
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

interface Size {
  readonly w: number;
  readonly h: number;
}
