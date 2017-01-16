import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';
import { FlexLayoutModule } from '@angular/flex-layout';
import { MaterialModule } from '@angular/material';

import { AppComponent } from './app.component';
import { CanvasComponent } from './canvas/canvas.component';
import { GlobalStateService } from './globalstate.service';
import { TimelineComponent } from './timeline/timeline.component';

import 'hammerjs';
import { DropSvgComponent } from './dropsvg/dropsvg.component';
import { SplitterDirective } from './splitter/splitter.directive';
import { InspectorComponent } from './inspector/inspector.component';
import { PathComponent } from './inspector/path/path.component';
import { SubPathComponent } from './inspector/subpath/subpath.component';
import { CommandComponent } from './inspector/command/command.component';

@NgModule({
  declarations: [
    AppComponent,
    CanvasComponent,
    TimelineComponent,
    DropSvgComponent,
    SplitterDirective,
    InspectorComponent,
    PathComponent,
    SubPathComponent,
    CommandComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpModule,
    FlexLayoutModule.forRoot(),
    MaterialModule.forRoot()
  ],
  providers: [GlobalStateService],
  bootstrap: [AppComponent]
})
export class AppModule { }
