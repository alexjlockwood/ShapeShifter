import { BrowserModule, DomSanitizer } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';
import { FlexLayoutModule } from '@angular/flex-layout';
import { StoreModule } from '@ngrx/store';
import { reducer } from './store';
import {
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
  MdIconRegistry,
} from '@angular/material';

// Components & directives.
import { AppComponent } from './app.component';
import { CanvasComponent } from './canvas/canvas.component';
import { CanvasRulerDirective } from './canvas/canvasruler.directive';
import { PathInspectorComponent } from './inspector/pathinspector.component';
import { CommandInspectorComponent } from './inspector/commandinspector.component';
import { SubpathInspectorComponent } from './inspector/subpathinspector.component';
import { SplitterComponent } from './splitter/splitter.component';
import { PlaybackComponent } from './playback/playback.component';
import { ToolbarComponent } from './toolbar/toolbar.component';
import { LayerListTreeComponent } from './layertimeline/layerlisttree.component';
import { PropertyInputComponent } from './propertyinput/propertyinput.component';
import { ScrollGroupDirective } from './scrollgroup/scrollgroup.directive';
import { LayerTimelineComponent } from './layertimeline/layertimeline.component';
import { LayerTimelineDirective } from './layertimeline/layertimeline.directive';
import { TimelineAnimationRowComponent } from './layertimeline/timelineanimationrow.component';

// Services.
import {
  AnimatorService,
  CanvasResizeService,
  HoverService,
  StateService,
  SelectionService,
  SettingsService,
  AppModeService,
  FilePickerService,
  MorphSubPathService,
  ActionModeService,
} from './services';

// Dialogs.
import {
  ConfirmDialogComponent,
  DemoDialogComponent,
  DialogService,
} from './dialogs';

// Pipes.
import { SubPathPairsPipe } from './inspector/pathinspector.component';
import { SvgCommandPipe } from './inspector/commandinspector.component';

import 'hammerjs';

@NgModule({
  declarations: [
    AppComponent,
    CanvasComponent,
    PlaybackComponent,
    SplitterComponent,
    PathInspectorComponent,
    CommandInspectorComponent,
    SubpathInspectorComponent,
    CanvasRulerDirective,
    ToolbarComponent,
    ConfirmDialogComponent,
    DemoDialogComponent,
    SvgCommandPipe,
    SubPathPairsPipe,
    LayerListTreeComponent,
    PropertyInputComponent,
    ScrollGroupDirective,
    LayerTimelineComponent,
    LayerTimelineDirective,
    TimelineAnimationRowComponent,
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpModule,
    FlexLayoutModule,
    BrowserAnimationsModule,
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
    AnimatorService,
    StateService,
    SelectionService,
    HoverService,
    CanvasResizeService,
    DialogService,
    SettingsService,
    AppModeService,
    FilePickerService,
    MorphSubPathService,
    ActionModeService,
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
