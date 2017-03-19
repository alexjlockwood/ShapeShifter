import { BrowserModule, DomSanitizer } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';
import { FlexLayoutModule } from '@angular/flex-layout';
import { MaterialModule, MdIconRegistry } from '@angular/material';

// Components & directives.
import { AppComponent } from './app.component';
import { CanvasComponent } from './canvas/canvas.component';
import { CanvasRulerDirective } from './canvas/canvasruler.directive';
import { InspectorComponent } from './inspector/inspector.component';
import { InspectorItemComponent } from './inspector/inspectoritem.component';
import { PathSelectorComponent } from './pathselector/pathselector.component';
import { SettingsComponent } from './settings/settings.component';
import { SplitterComponent } from './splitter/splitter.component';
import { TimelineComponent } from './timeline/timeline.component';
import { ToolbarComponent } from './toolbar/toolbar.component';

// Services.
import {
  AnimatorService,
  CanvasResizeService,
  HoverStateService,
  LayerStateService,
  SelectionStateService,
  SettingsService,
  CanvasModeService,
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
import { PathLayerListPipe } from './pathselector/pathselector.component';
import { SubPathItemsPipe } from './inspector/inspector.component';
import { SvgCommandPipe } from './inspector/inspectoritem.component';

import 'hammerjs';

@NgModule({
  declarations: [
    AppComponent,
    CanvasComponent,
    TimelineComponent,
    SplitterComponent,
    InspectorComponent,
    InspectorItemComponent,
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
    PathLayerListPipe,
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpModule,
    FlexLayoutModule,
    MaterialModule,
  ],
  providers: [
    AnimatorService,
    LayerStateService,
    SelectionStateService,
    HoverStateService,
    CanvasResizeService,
    DialogService,
    SettingsService,
    CanvasModeService,
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
      .addSvgIcon('cursor_default', sanitizer.bypassSecurityTrustResourceUrl('assets/cursor-default.svg'))
      .addSvgIcon('demoicon', sanitizer.bypassSecurityTrustResourceUrl('assets/demoicon.svg'));
  }
}
