import 'hammerjs';

import { NgModule } from '@angular/core';
import { FlexLayoutModule } from '@angular/flex-layout';
import { FormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';
import {
  MatButtonModule,
  MatButtonToggleModule,
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
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { StoreModule } from 'app/store/ngrx';

import { PlaybackComponent } from './components/playback/playback.component';
import { PropertyInputComponent } from './components/propertyinput/propertyinput.component';
import { DropTargetDirective } from './components/root/droptarget.directive';
import { RootComponent } from './components/root/root.component';
import { ScrollGroupDirective } from './components/scrollgroup/scrollgroup.directive';
import { SplashScreenComponent } from './components/splashscreen/splashscreen.component';
import { SplitterComponent } from './components/splitter/splitter.component';
import { ToolbarComponent } from './components/toolbar/toolbar.component';
import { ToolPanelComponent } from './components/toolpanel/toolpanel.component';
import { ActionModeService } from './services/actionmode.service';
import { AnimatorService } from './services/animator.service';
import { ClipboardService } from './services/clipboard.service';
import { DemoService } from './services/demo.service';
import { DialogService } from './services/dialog.service';
import { FileExportService } from './services/fileexport.service';
import { FileImportService } from './services/fileimport.service';
import { LayerTimelineService } from './services/layertimeline.service';
import { PaperService } from './services/paper.service';
import { PlaybackService } from './services/playback.service';
import { ShortcutService } from './services/shortcut.service';
import { SnackBarService } from './services/snackbar.service';
import { ThemeService } from './services/theme.service';
import {
  CanvasComponent,
  CanvasContainerDirective,
  CanvasLayersDirective,
  CanvasOverlayDirective,
  CanvasPaperDirective,
  CanvasRulerDirective,
} from './components/canvas';
import {
  ConfirmDialogComponent,
  DemoDialogComponent,
  DropFilesDialogComponent,
} from './components/dialogs';
import {
  LayerListTreeComponent,
  LayerTimelineComponent,
  LayerTimelineGridDirective,
  TimelineAnimationRowComponent,
} from './components/layertimeline';
import { reducer } from './store';

@NgModule({
  declarations: [
    CanvasComponent,
    CanvasContainerDirective,
    CanvasLayersDirective,
    CanvasOverlayDirective,
    CanvasPaperDirective,
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
    ToolPanelComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FlexLayoutModule,
    FormsModule,
    HttpModule,
    StoreModule.provideStore(reducer),
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
    ActionModeService,
    AnimatorService,
    ClipboardService,
    DemoService,
    DialogService,
    FileExportService,
    FileImportService,
    LayerTimelineService,
    PaperService,
    PlaybackService,
    ShortcutService,
    SnackBarService,
    ThemeService,
    { provide: MATERIAL_COMPATIBILITY_MODE, useValue: true },
  ],
  entryComponents: [ConfirmDialogComponent, DemoDialogComponent, DropFilesDialogComponent],
  bootstrap: [RootComponent],
})
export class AppModule {
  constructor(matIconRegistry: MatIconRegistry, private readonly sanitizer: DomSanitizer) {
    matIconRegistry
      // Logo.
      .addSvgIcon('shapeshifter', this.trustUrl('assets/shapeshifter.svg'))
      // Icons.
      .addSvgIcon('addlayer', this.trustUrl('assets/icons/addlayer.svg'))
      .addSvgIcon('autofix', this.trustUrl('assets/icons/autofix.svg'))
      .addSvgIcon('contribute', this.trustUrl('assets/icons/contribute.svg'))
      .addSvgIcon('reverse', this.trustUrl('assets/icons/reverse.svg'))
      .addSvgIcon('animation', this.trustUrl('assets/icons/animation.svg'))
      .addSvgIcon('collection', this.trustUrl('assets/icons/collection.svg'))
      .addSvgIcon('animationblock', this.trustUrl('assets/icons/animationblock.svg'))
      .addSvgIcon('mask', this.trustUrl('assets/icons/clippathlayer.svg'))
      .addSvgIcon('group', this.trustUrl('assets/icons/grouplayer.svg'))
      .addSvgIcon('path', this.trustUrl('assets/icons/pathlayer.svg'))
      .addSvgIcon('vector', this.trustUrl('assets/icons/vectorlayer.svg'))
      // Cursors.
      .addSvgIcon('selectioncursor', this.trustUrl('assets/cursors/selectioncursor.svg'))
      // Tools.
      .addSvgIcon('tool_select', this.trustUrl('assets/tools/tool_select.svg'))
      .addSvgIcon('tool_draw', this.trustUrl('assets/tools/tool_draw.svg'))
      .addSvgIcon('tool_bezier', this.trustUrl('assets/tools/tool_bezier.svg'))
      .addSvgIcon('tool_circle', this.trustUrl('assets/tools/tool_circle.svg'))
      .addSvgIcon('tool_rectangle', this.trustUrl('assets/tools/tool_rectangle.svg'))
      .addSvgIcon('tool_zoompan', this.trustUrl('assets/tools/tool_zoompan.svg'));
  }

  private trustUrl(url: string) {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
