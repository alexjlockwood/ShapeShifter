import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';
import { FlexLayoutModule } from '@angular/flex-layout';
import { MaterialModule } from '@angular/material';
import { DragulaModule } from 'ng2-dragula';

import { AppComponent } from './app.component';
import { CanvasComponent } from './canvas/canvas.component';
import { StateService } from './state.service';
import { TimelineComponent } from './timeline/timeline.component';

import "hammerjs";
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
    DragulaModule,
    FlexLayoutModule.forRoot(),
    MaterialModule.forRoot()
  ],
  providers: [
    StateService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
