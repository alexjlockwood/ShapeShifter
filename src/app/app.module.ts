import { BrowserModule, DomSanitizer } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';
import { FlexLayoutModule } from '@angular/flex-layout';
import { MaterialModule, MdIconRegistry } from '@angular/material';

import { AppComponent } from './app.component';
import { CanvasComponent } from './canvas/canvas.component';
import { TimelineComponent } from './timeline/timeline.component';
import { SplitterDirective } from './splitter/splitter.directive';
import { InspectorComponent } from './inspector/inspector.component';
import { InspectorItemComponent } from './inspector/inspectoritem.component';
import { SvgCommandPipe } from './inspector/svgcommand.pipe';
import { AnimatorService } from './services/animator.service';
import { LayerStateService } from './services/layerstate.service';
import { SelectionStateService } from './services/selectionstate.service';
import { HoverStateService } from './services/hoverstate.service';
import { CanvasResizeService } from './services/canvasresize.service';
import { CanvasRulerDirective } from './canvas/canvasruler.directive';
import { SettingsComponent } from './settings/settings.component';
import { ToolbarComponent } from './toolbar/toolbar.component';
import { DialogService, HelpDialogComponent, ConfirmDialogComponent, DemoDialogComponent } from './dialogs';
import { SettingsService } from './services/settings.service';
import { PathSelectorComponent } from './pathselector/pathselector.component';
import { IsEqualToPipe, IsNotEqualToPipe } from './pipes';

import 'hammerjs';

@NgModule({
  declarations: [
    AppComponent,
    CanvasComponent,
    TimelineComponent,
    SplitterDirective,
    InspectorComponent,
    InspectorItemComponent,
    CanvasRulerDirective,
    SettingsComponent,
    ToolbarComponent,
    PathSelectorComponent,
    ConfirmDialogComponent,
    HelpDialogComponent,
    DemoDialogComponent,
    SvgCommandPipe,
    IsEqualToPipe,
    IsNotEqualToPipe,
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
  ],
  entryComponents: [
    ConfirmDialogComponent,
    HelpDialogComponent,
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
      .addSvgIcon('demoicon', sanitizer.bypassSecurityTrustResourceUrl('assets/demoicon.svg'));
  }
}
