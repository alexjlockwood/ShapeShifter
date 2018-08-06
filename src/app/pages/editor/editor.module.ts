import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FlexLayoutModule } from '@angular/flex-layout';
import { FormsModule } from '@angular/forms';
import { MatIconRegistry } from '@angular/material';
import { DomSanitizer } from '@angular/platform-browser';
import { StoreModule } from '@ngrx/store';
import {
  CanvasComponent,
  CanvasContainerDirective,
  CanvasLayersDirective,
  CanvasOverlayDirective,
  CanvasPaperDirective,
  CanvasRulerDirective,
} from 'app/pages/editor/components/canvas';
import {
  ConfirmDialogComponent,
  DemoDialogComponent,
  DropFilesDialogComponent,
} from 'app/pages/editor/components/dialogs';
import {
  LayerListTreeComponent,
  LayerTimelineComponent,
  LayerTimelineGridDirective,
  TimelineAnimationRowComponent,
} from 'app/pages/editor/components/layertimeline';
import { PlaybackComponent } from 'app/pages/editor/components/playback';
import { PropertyInputComponent } from 'app/pages/editor/components/propertyinput';
import { DropTargetDirective } from 'app/pages/editor/components/root/droptarget.directive';
import { RootComponent } from 'app/pages/editor/components/root/root.component';
import { ScrollGroupDirective } from 'app/pages/editor/components/scrollgroup/scrollgroup.directive';
import { SplashScreenComponent } from 'app/pages/editor/components/splashscreen/splashscreen.component';
import { SplitterComponent } from 'app/pages/editor/components/splitter/splitter.component';
import { ToolbarComponent } from 'app/pages/editor/components/toolbar/toolbar.component';
import { ToolPanelComponent } from 'app/pages/editor/components/toolpanel/toolpanel.component';
import { EditorRoutingModule } from 'app/pages/editor/editor.routes';
import { ProjectResolver } from 'app/pages/editor/project.resolver';
import { reducer } from 'app/pages/editor/store';
import { MaterialModule } from 'app/shared';

@NgModule({
  declarations: [
    CanvasComponent,
    CanvasContainerDirective,
    CanvasLayersDirective,
    CanvasOverlayDirective,
    CanvasPaperDirective,
    CanvasRulerDirective,
    ConfirmDialogComponent,
    DemoDialogComponent,
    DropFilesDialogComponent,
    DropTargetDirective,
    LayerListTreeComponent,
    LayerTimelineComponent,
    LayerTimelineGridDirective,
    PlaybackComponent,
    PropertyInputComponent,
    RootComponent,
    ScrollGroupDirective,
    SplashScreenComponent,
    SplitterComponent,
    TimelineAnimationRowComponent,
    ToolbarComponent,
    ToolPanelComponent,
  ],
  imports: [
    CommonModule,
    EditorRoutingModule,
    FlexLayoutModule,
    FormsModule,
    HttpClientModule,
    MaterialModule,
    StoreModule.forFeature('editor', reducer),
  ],
  providers: [ProjectResolver],
  entryComponents: [ConfirmDialogComponent, DemoDialogComponent, DropFilesDialogComponent],
  bootstrap: [RootComponent],
})
export class EditorModule {
  // TODO: figure out if this stuff should be declared in the app/core module?
  constructor(matIconRegistry: MatIconRegistry, private readonly sanitizer: DomSanitizer) {
    matIconRegistry
      // Logo.
      .addSvgIcon('shapeshifter', this.trustUrl('assets/shapeshifter.svg'))
      // Icons.
      .addSvgIcon('addlayer', this.trustUrl('assets/icons/addlayer.svg'))
      .addSvgIcon('autofix', this.trustUrl('assets/icons/autofix.svg'))
      .addSvgIcon('contribute', this.trustUrl('assets/icons/contribute.svg'))
      .addSvgIcon('reverse', this.trustUrl('assets/icons/reverse.svg'))
      .addSvgIcon('animation', this.trustUrl('assets/icons/animation.svg'))
      .addSvgIcon('collection', this.trustUrl('assets/icons/collection.svg'))
      .addSvgIcon('animationblock', this.trustUrl('assets/icons/animationblock.svg'))
      .addSvgIcon('mask', this.trustUrl('assets/icons/clippathlayer.svg'))
      .addSvgIcon('group', this.trustUrl('assets/icons/grouplayer.svg'))
      .addSvgIcon('path', this.trustUrl('assets/icons/pathlayer.svg'))
      .addSvgIcon('vector', this.trustUrl('assets/icons/vectorlayer.svg'))
      // Tools.
      .addSvgIcon('tool_select', this.trustUrl('assets/tools/tool_select.svg'))
      .addSvgIcon('tool_pencil', this.trustUrl('assets/tools/tool_pencil.svg'))
      .addSvgIcon('tool_vector', this.trustUrl('assets/tools/tool_vector.svg'))
      .addSvgIcon('tool_ellipse', this.trustUrl('assets/tools/tool_ellipse.svg'))
      .addSvgIcon('tool_rectangle', this.trustUrl('assets/tools/tool_rectangle.svg'))
      .addSvgIcon('tool_zoompan', this.trustUrl('assets/tools/tool_zoompan.svg'));
  }

  private trustUrl(url: string) {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
