import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';
import { FlexLayoutModule } from '@angular/flex-layout';
import { MaterialModule } from '@angular/material';
import { DragulaModule } from 'ng2-dragula';

import { AppComponent } from './app.component';
import { CanvasComponent } from './canvas/canvas.component';
import { PointListComponent } from './pointlist/pointlist.component';
import { StateService } from './state.service';
import { RulerComponent } from './canvas/ruler/ruler.component';
import { TimelineComponent } from './timeline/timeline.component';

import "hammerjs";

@NgModule({
  declarations: [
    AppComponent,
    CanvasComponent,
    RulerComponent,
    TimelineComponent,
    PointListComponent
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
