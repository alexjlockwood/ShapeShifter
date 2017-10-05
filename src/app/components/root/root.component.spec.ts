import 'hammerjs';

import { ComponentFixture, TestBed, async, inject } from '@angular/core/testing';
import { FlexLayoutModule } from '@angular/flex-layout';
import { FormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';
import {
  MatButtonModule,
  MatDialogModule,
  MatIconModule,
  MatIconRegistry,
  MatInputModule,
  MatMenuModule,
  MatOptionModule,
  MatRadioModule,
  MatSlideToggleModule,
  MatSnackBarModule,
  MatToolbarModule,
  MatTooltipModule,
} from '@angular/material';
import { MATERIAL_COMPATIBILITY_MODE } from '@angular/material/core';
import { BrowserModule, DomSanitizer } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import {
  CanvasComponent,
  CanvasContainerDirective,
  CanvasLayersDirective,
  CanvasOverlayDirective,
  CanvasRulerDirective,
} from 'app/components/canvas';
import {
  ConfirmDialogComponent,
  DemoDialogComponent,
  DropFilesDialogComponent,
} from 'app/components/dialogs';
import {
  LayerListTreeComponent,
  LayerTimelineComponent,
  LayerTimelineGridDirective,
  TimelineAnimationRowComponent,
} from 'app/components/layertimeline';
import { PlaybackComponent } from 'app/components/playback/playback.component';
import { PropertyInputComponent } from 'app/components/propertyinput/propertyinput.component';
import { DropTargetDirective } from 'app/components/root/droptarget.directive';
import { RootComponent } from 'app/components/root/root.component';
import { ScrollGroupDirective } from 'app/components/scrollgroup/scrollgroup.directive';
import { SplashScreenComponent } from 'app/components/splashscreen/splashscreen.component';
import { SplitterComponent } from 'app/components/splitter/splitter.component';
import { ToolbarComponent } from 'app/components/toolbar/toolbar.component';
import {
  ActionModeService,
  AnimatorService,
  ClipboardService,
  DemoService,
  DialogService,
  FileExportService,
  FileImportService,
  LayerTimelineService,
  PlaybackService,
  ShortcutService,
  SnackBarService,
  ThemeService,
} from 'app/services';
import { Store } from 'app/store';
import { MockStore } from 'test/MockStore';

describe('RootComponent', () => {
  let component: RootComponent;
  let fixture: ComponentFixture<RootComponent>;

  beforeEach(
    async(() => {
      TestBed.configureTestingModule({
        declarations: [
          CanvasComponent,
          CanvasContainerDirective,
          CanvasLayersDirective,
          CanvasOverlayDirective,
          CanvasRulerDirective,
          ConfirmDialogComponent,
          DemoDialogComponent,
          DropFilesDialogComponent,
          DropTargetDirective,
          LayerListTreeComponent,
          LayerTimelineComponent,
          LayerTimelineGridDirective,
          PlaybackComponent,
          PropertyInputComponent,
          RootComponent,
          ScrollGroupDirective,
          SplashScreenComponent,
          SplitterComponent,
          TimelineAnimationRowComponent,
          ToolbarComponent,
        ],
        imports: [
          BrowserModule,
          FlexLayoutModule,
          FormsModule,
          HttpModule,
          NoopAnimationsModule,
          // Angular material components.
          MatButtonModule,
          MatDialogModule,
          MatIconModule,
          MatInputModule,
          MatMenuModule,
          MatOptionModule,
          MatRadioModule,
          MatSlideToggleModule,
          MatSnackBarModule,
          MatToolbarModule,
          MatTooltipModule,
        ],
        providers: [
          { provide: Store, useValue: new MockStore() },
          ActionModeService,
          AnimatorService,
          ClipboardService,
          DemoService,
          DialogService,
          FileExportService,
          FileImportService,
          LayerTimelineService,
          PlaybackService,
          ShortcutService,
          SnackBarService,
          ThemeService,
          { provide: MATERIAL_COMPATIBILITY_MODE, useValue: true },
        ],
      }).compileComponents();
      loadSvgIcons([
        { name: 'addlayer', path: 'assets/icons/addlayer.svg' },
        { name: 'animationblock', path: 'assets/icons/animationblock.svg' },
        { name: 'contribute', path: 'assets/icons/contribute.svg' },
        { name: 'shapeshifter', path: 'assets/shapeshifter.svg' },
        { name: 'vector', path: 'assets/icons/vectorlayer.svg' },
      ]);
    }),
  );

  beforeEach(
    inject([Store], (store: MockStore) => {
      fixture = TestBed.createComponent(RootComponent);
      component = fixture.componentInstance;
      component.ngOnInit();
      fixture.detectChanges();
    }),
  );

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});

function loadSvgIcons(svgIcons: Array<{ name: string; path: string }>) {
  const matIconRegistry = TestBed.get(MatIconRegistry);
  const sanitizer = TestBed.get(DomSanitizer);
  for (const { name, path } of svgIcons) {
    matIconRegistry.addSvgIcon(name, sanitizer.bypassSecurityTrustResourceUrl(path));
  }
}
