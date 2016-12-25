import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';
import { FlexLayoutModule } from '@angular/flex-layout';

import { AppComponent } from './app.component';
import { CanvasComponent } from './canvas/canvas.component';

import { StudioStateService } from './studiostate.service';
import { RulerComponent } from './canvas/ruler/ruler.component';

@NgModule({
  declarations: [
    AppComponent,
    CanvasComponent,
    RulerComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpModule,
    FlexLayoutModule.forRoot()
  ],
  providers: [
    StudioStateService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
