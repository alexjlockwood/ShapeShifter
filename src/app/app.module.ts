import 'hammerjs';

import { NgModule } from '@angular/core';
import { FlexLayoutModule } from '@angular/flex-layout';
import { FormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';
import {
  MdButtonModule,
  MdDialogModule,
  MdIconModule,
  MdIconRegistry,
  MdInputModule,
  MdMenuModule,
  MdOptionModule,
  MdRadioModule,
  MdSlideToggleModule,
  MdSnackBarModule,
  MdToolbarModule,
  MdTooltipModule,
} from '@angular/material';
import { BrowserModule, DomSanitizer } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { StoreModule } from '@ngrx/store';

import { PlaybackComponent } from './components/playback/playback.component';
import { PropertyInputComponent } from './components/propertyinput/propertyinput.component';
import { DropTargetDirective } from './components/root/droptarget.directive';
import { RootComponent } from './components/root/root.component';
import { ScrollGroupDirective } from './components/scrollgroup/scrollgroup.directive';
import { SplashScreenComponent } from './components/splashscreen/splashscreen.component';
import { SplitterComponent } from './components/splitter/splitter.component';
import { ToolbarComponent } from './components/toolbar/toolbar.component';
import { ActionModeService } from './services/actionmode.service';
import { AnimatorService } from './services/animator.service';
import { ClipboardService } from './services/clipboard.service';
import { DemoService } from './services/demo.service';
import { DialogService } from './services/dialog.service';
import { FileExportService } from './services/fileexport.service';
import { FileImportService } from './services/fileimport.service';
import { LayerTimelineService } from './services/layertimeline.service';
import { PlaybackService } from './services/playback.service';
import { ShortcutService } from './services/shortcut.service';
import { SnackBarService } from './services/snackbar.service';
import { ThemeService } from './services/theme.service';
import {
  CanvasComponent,
  CanvasContainerDirective,
  CanvasLayersDirective,
  CanvasOverlayDirective,
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
    BrowserAnimationsModule,
    FlexLayoutModule,
    FormsModule,
    HttpModule,
    StoreModule.provideStore(reducer),
    // Angular material components.
    MdButtonModule,
    MdDialogModule,
    MdIconModule,
    MdInputModule,
    MdMenuModule,
    MdOptionModule,
    MdRadioModule,
    MdSlideToggleModule,
    MdSnackBarModule,
    MdToolbarModule,
    MdTooltipModule,
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
    PlaybackService,
    ShortcutService,
    SnackBarService,
    ThemeService,
  ],
  entryComponents: [ConfirmDialogComponent, DemoDialogComponent, DropFilesDialogComponent],
  bootstrap: [RootComponent],
})
export class AppModule {
  constructor(mdIconRegistry: MdIconRegistry, private readonly sanitizer: DomSanitizer) {
    mdIconRegistry
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
      .addSvgIcon('selectioncursor', this.trustUrl('assets/cursors/selectioncursor.svg'));
  }

  private trustUrl(url: string) {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
