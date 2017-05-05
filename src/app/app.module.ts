import { BrowserModule, DomSanitizer } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';
import { FlexLayoutModule } from '@angular/flex-layout';
import { MaterialModule, MdIconRegistry } from '@angular/material';

// Components & directives.
import { AppComponent } from './app.component';
import { CanvasComponent } from './canvas/canvas.component';
import { TimelineComponent } from './timeline/timeline.component';
import { TimelineRulerComponent } from './timeline/timelineruler.component';
import { CanvasRulerDirective } from './canvas/canvasruler.directive';
import { PathInspectorComponent } from './inspector/pathinspector.component';
import { CommandInspectorComponent } from './inspector/commandinspector.component';
import { SubpathInspectorComponent } from './inspector/subpathinspector.component';
import { SettingsComponent } from './settings/settings.component';
import { SplitterComponent } from './splitter/splitter.component';
import { PlaybackComponent } from './playback/playback.component';
import { ToolbarComponent } from './toolbar/toolbar.component';
import { LayerTreeComponent } from './layertimeline/layertree.component';
import { PropertyInputComponent } from './propertyinput/propertyinput.component';
import { ScrollGroupDirective } from './scrollgroup/scrollgroup.directive';
import { LayerTimelineComponent } from './layertimeline/layertimeline.component';

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
    SettingsComponent,
    ToolbarComponent,
    TimelineComponent,
    TimelineRulerComponent,
    ConfirmDialogComponent,
    DemoDialogComponent,
    SvgCommandPipe,
    SubPathPairsPipe,
    LayerTreeComponent,
    PropertyInputComponent,
    ScrollGroupDirective,
    LayerTimelineComponent,
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpModule,
    FlexLayoutModule,
    MaterialModule,
    BrowserAnimationsModule,
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
  bootstrap: [AppComponent]
})
export class AppModule {

  constructor(
    private mdIconRegistry: MdIconRegistry,
    private sanitizer: DomSanitizer) {
    mdIconRegistry
      // Logo.
      .addSvgIcon('shapeshifter', sanitizer.bypassSecurityTrustResourceUrl('assets/shapeshifter.svg'))
      // Icons.
      .addSvgIcon('addpaths', sanitizer.bypassSecurityTrustResourceUrl('assets/icons/addpaths.svg'))
      .addSvgIcon('autofix', sanitizer.bypassSecurityTrustResourceUrl('assets/icons/autofix.svg'))
      .addSvgIcon('demos', sanitizer.bypassSecurityTrustResourceUrl('assets/icons/demos.svg'))
      .addSvgIcon('reverse', sanitizer.bypassSecurityTrustResourceUrl('assets/icons/reverse.svg'))
      // Models.
      .addSvgIcon('animation', sanitizer.bypassSecurityTrustResourceUrl('assets/models/animation.svg'))
      .addSvgIcon('animationblock', sanitizer.bypassSecurityTrustResourceUrl('assets/models/animationblock.svg'))
      .addSvgIcon('clippathlayer', sanitizer.bypassSecurityTrustResourceUrl('assets/models/clippathlayer.svg'))
      .addSvgIcon('grouplayer', sanitizer.bypassSecurityTrustResourceUrl('assets/models/grouplayer.svg'))
      .addSvgIcon('pathlayer', sanitizer.bypassSecurityTrustResourceUrl('assets/models/pathlayer.svg'))
      .addSvgIcon('vectorlayer', sanitizer.bypassSecurityTrustResourceUrl('assets/models/vectorlayer.svg'))
      // Cursors.
      .addSvgIcon('selectioncursor', sanitizer.bypassSecurityTrustResourceUrl('assets/cursorsselectioncursor.svg'));
  }
}
