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
import { VectorListComponent } from './vectorlist/vectorlist.component';
import { SettingsComponent } from './settings/settings.component';
import { SplitterComponent } from './splitter/splitter.component';
import { PlaybackComponent } from './playback/playback.component';
import { ToolbarComponent } from './toolbar/toolbar.component';
import { LayerTreeComponent } from './vectorlist/layertree.component';

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
import { PropertyInputComponent } from './propertyinput/propertyinput.component';

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
    VectorListComponent,
    ConfirmDialogComponent,
    DemoDialogComponent,
    SvgCommandPipe,
    SubPathPairsPipe,
    LayerTreeComponent,
    PropertyInputComponent,
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
      .addSvgIcon('reverse', sanitizer.bypassSecurityTrustResourceUrl('assets/reverse.svg'))
      .addSvgIcon('autofix', sanitizer.bypassSecurityTrustResourceUrl('assets/autofix.svg'))
      .addSvgIcon('shapeshifter', sanitizer.bypassSecurityTrustResourceUrl('assets/shapeshifter.svg'))
      .addSvgIcon('addpaths', sanitizer.bypassSecurityTrustResourceUrl('assets/addpaths.svg'))
      .addSvgIcon('clippath', sanitizer.bypassSecurityTrustResourceUrl('assets/clippath.svg'))
      .addSvgIcon('group', sanitizer.bypassSecurityTrustResourceUrl('assets/group.svg'))
      .addSvgIcon('path', sanitizer.bypassSecurityTrustResourceUrl('assets/path.svg'))
      .addSvgIcon('vector', sanitizer.bypassSecurityTrustResourceUrl('assets/vector.svg'))
      .addSvgIcon('selectioncursor', sanitizer.bypassSecurityTrustResourceUrl('assets/selectioncursor.svg'))
      .addSvgIcon('demoicon', sanitizer.bypassSecurityTrustResourceUrl('assets/demoicon.svg'));
  }
}
