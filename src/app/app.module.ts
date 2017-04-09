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
import { CanvasRulerDirective } from './canvas/canvasruler.directive';
import { PathInspectorComponent } from './inspector/pathinspector.component';
import { CommandInspectorComponent } from './inspector/commandinspector.component';
import { SubpathInspectorComponent } from './inspector/subpathinspector.component';
import { PathSelectorComponent } from './pathselector/pathselector.component';
import { SettingsComponent } from './settings/settings.component';
import { SplitterComponent } from './splitter/splitter.component';
import { TimelineComponent } from './timeline/timeline.component';
import { ToolbarComponent } from './toolbar/toolbar.component';

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
} from './services';

// Dialogs.
import {
  ConfirmDialogComponent,
  DemoDialogComponent,
  DialogService,
} from './dialogs';

// Pipes.
import {
  IsEqualToPipe,
  IsNotEqualToPipe,
} from './pipes';
import { SubPathItemsPipe } from './inspector/pathinspector.component';
import { SvgCommandPipe } from './inspector/commandinspector.component';

import 'hammerjs';

@NgModule({
  declarations: [
    AppComponent,
    CanvasComponent,
    TimelineComponent,
    SplitterComponent,
    PathInspectorComponent,
    CommandInspectorComponent,
    SubpathInspectorComponent,
    CanvasRulerDirective,
    SettingsComponent,
    ToolbarComponent,
    PathSelectorComponent,
    ConfirmDialogComponent,
    DemoDialogComponent,
    SvgCommandPipe,
    IsEqualToPipe,
    IsNotEqualToPipe,
    SubPathItemsPipe,
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
      .addSvgIcon('contribute', sanitizer.bypassSecurityTrustResourceUrl('assets/contribute.svg'))
      .addSvgIcon('shapeshifter', sanitizer.bypassSecurityTrustResourceUrl('assets/shapeshifter.svg'))
      .addSvgIcon('addpaths', sanitizer.bypassSecurityTrustResourceUrl('assets/addpaths.svg'))
      .addSvgIcon('selectioncursor', sanitizer.bypassSecurityTrustResourceUrl('assets/selectioncursor.svg'))
      .addSvgIcon('demoicon', sanitizer.bypassSecurityTrustResourceUrl('assets/demoicon.svg'));
  }
}
