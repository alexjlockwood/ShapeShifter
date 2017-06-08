import 'hammerjs';

import { ActionModeService } from './actionmode/actionmode.service';
import { AnimatorService } from './animator';
import { AppComponent } from './app.component';
import {
  CanvasComponent,
  CanvasContainerDirective,
  CanvasLayersDirective,
  CanvasOverlayDirective,
  CanvasRulerDirective,
} from './canvas';
import {
  ConfirmDialogComponent,
  DemoDialogComponent,
  DialogService,
} from './dialogs';
import { DropTargetDirective } from './droptarget.directive';
import { FileExportService } from './export/fileexport.service';
import { FileImportService } from './import/fileimport.service';
import { LayerListTreeComponent } from './layertimeline/layerlisttree.component';
import { LayerTimelineComponent } from './layertimeline/layertimeline.component';
import { LayerTimelineDirective } from './layertimeline/layertimeline.directive';
import { TimelineAnimationRowComponent } from './layertimeline/timelineanimationrow.component';
import { PlaybackComponent } from './playback/playback.component';
import { PlaybackService } from './playback/playback.service';
import { PropertyInputComponent } from './propertyinput/propertyinput.component';
import { ScrollGroupDirective } from './scrollgroup/scrollgroup.directive';
import { ShortcutService } from './shortcut/shortcut.service';
import { SplitterComponent } from './splitter/splitter.component';
import { reducer } from './store';
import { ToolbarComponent } from './toolbar/toolbar.component';
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
  MdSnackBarModule,
  MdToolbarModule,
  MdTooltipModule,
} from '@angular/material';
import { BrowserModule, DomSanitizer } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { StoreModule } from '@ngrx/store';

@NgModule({
  declarations: [
    AppComponent,
    CanvasComponent,
    CanvasContainerDirective,
    CanvasLayersDirective,
    CanvasOverlayDirective,
    CanvasRulerDirective,
    ConfirmDialogComponent,
    DemoDialogComponent,
    DropTargetDirective,
    LayerListTreeComponent,
    LayerTimelineComponent,
    LayerTimelineDirective,
    PlaybackComponent,
    PropertyInputComponent,
    ScrollGroupDirective,
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
    MdSnackBarModule,
    MdToolbarModule,
    MdTooltipModule,
  ],
  providers: [
    ActionModeService,
    AnimatorService,
    DialogService,
    FileExportService,
    FileImportService,
    PlaybackService,
    ShortcutService,
  ],
  entryComponents: [
    ConfirmDialogComponent,
    DemoDialogComponent,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {

  constructor(
    readonly mdIconRegistry: MdIconRegistry,
    readonly sanitizer: DomSanitizer) {
    mdIconRegistry
      // Logo.
      .addSvgIcon('shapeshifter', sanitizer.bypassSecurityTrustResourceUrl('assets/shapeshifter.svg'))
      // Icons.
      .addSvgIcon('addlayer', sanitizer.bypassSecurityTrustResourceUrl('assets/icons/addlayer.svg'))
      .addSvgIcon('addanimation', sanitizer.bypassSecurityTrustResourceUrl('assets/icons/addanimation.svg'))
      .addSvgIcon('autofix', sanitizer.bypassSecurityTrustResourceUrl('assets/icons/autofix.svg'))
      .addSvgIcon('demos', sanitizer.bypassSecurityTrustResourceUrl('assets/icons/demos.svg'))
      .addSvgIcon('reverse', sanitizer.bypassSecurityTrustResourceUrl('assets/icons/reverse.svg'))
      .addSvgIcon('animation', sanitizer.bypassSecurityTrustResourceUrl('assets/icons/animation.svg'))
      .addSvgIcon('collection', sanitizer.bypassSecurityTrustResourceUrl('assets/icons/collection.svg'))
      .addSvgIcon('animationblock', sanitizer.bypassSecurityTrustResourceUrl('assets/icons/animationblock.svg'))
      .addSvgIcon('clippathlayer', sanitizer.bypassSecurityTrustResourceUrl('assets/icons/clippathlayer.svg'))
      .addSvgIcon('grouplayer', sanitizer.bypassSecurityTrustResourceUrl('assets/icons/grouplayer.svg'))
      .addSvgIcon('pathlayer', sanitizer.bypassSecurityTrustResourceUrl('assets/icons/pathlayer.svg'))
      .addSvgIcon('vectorlayer', sanitizer.bypassSecurityTrustResourceUrl('assets/icons/vectorlayer.svg'))
      // Cursors.
      .addSvgIcon('selectioncursor', sanitizer.bypassSecurityTrustResourceUrl('assets/cursorsselectioncursor.svg'));
  }
}
