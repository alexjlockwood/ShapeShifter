import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';
import { FlexLayoutModule } from '@angular/flex-layout';
import { MaterialModule } from '@angular/material';

import { AppComponent } from './app.component';
import { CanvasComponent } from './canvas/canvas.component';
import { TimelineComponent } from './timeline/timeline.component';
import { SplitterDirective } from './splitter/splitter.directive';
import { InspectorComponent } from './inspector/inspector.component';
import { PathComponent } from './inspector/path/path.component';
import { SubPathComponent } from './inspector/subpath/subpath.component';
import { CommandComponent } from './inspector/command/command.component';
import { TimelineService } from './timeline/timeline.service';
import { LayerStateService } from './services/layerstate.service';
import { SelectionStateService } from './services/selectionstate.service';
import { HoverStateService } from './services/hoverstate.service';
import { CanvasResizeService } from './services/canvasresize.service';
import { DropTargetComponent } from './droptarget/droptarget.component';
import { DropZoneDirective } from './droptarget/dropzone.directive';
import { CanvasRulerDirective } from './canvas/ruler.directive';

import 'hammerjs';

@NgModule({
  declarations: [
    AppComponent,
    CanvasComponent,
    TimelineComponent,
    DropTargetComponent,
    DropZoneDirective,
    SplitterDirective,
    InspectorComponent,
    PathComponent,
    SubPathComponent,
    CommandComponent,
    CanvasRulerDirective,
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpModule,
    FlexLayoutModule.forRoot(),
    MaterialModule.forRoot(),
  ],
  providers: [
    TimelineService,
    LayerStateService,
    SelectionStateService,
    HoverStateService,
    CanvasResizeService,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
