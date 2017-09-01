import { ComponentFixture, TestBed, async, inject } from '@angular/core/testing';
import { FlexLayoutModule } from '@angular/flex-layout';
import { HttpModule } from '@angular/http';
import {
  MdButtonModule,
  MdDialogModule,
  MdIconModule,
  MdIconRegistry,
  MdMenuModule,
  MdSnackBarModule,
  MdTooltipModule,
} from '@angular/material';
import { DomSanitizer } from '@angular/platform-browser';
import { ScrollGroupDirective } from 'app/components/scrollgroup/scrollgroup.directive';
import { SplitterComponent } from 'app/components/splitter/splitter.component';
import {
  ActionModeService,
  AnimatorService,
  DemoService,
  DialogService,
  FileExportService,
  FileImportService,
  LayerTimelineService,
  PlaybackService,
  ShortcutService,
  SnackBarService,
  ThemeService,
} from 'app/services';
import { Store } from 'app/store';
import { MockStore } from 'test/MockStore';

import { LayerListTreeComponent } from './layerlisttree.component';
import { LayerTimelineComponent } from './layertimeline.component';
import { LayerTimelineGridDirective } from './layertimelinegrid.directive';
import { TimelineAnimationRowComponent } from './timelineanimationrow.component';

describe('LayerTimelineComponent', () => {
  let component: LayerTimelineComponent;
  let fixture: ComponentFixture<LayerTimelineComponent>;

  beforeEach(
    async(() => {
      TestBed.configureTestingModule({
        declarations: [
          LayerListTreeComponent,
          LayerTimelineComponent,
          LayerTimelineGridDirective,
          ScrollGroupDirective,
          SplitterComponent,
          TimelineAnimationRowComponent,
        ],
        imports: [
          HttpModule,
          FlexLayoutModule,
          MdButtonModule,
          MdIconModule,
          MdMenuModule,
          MdTooltipModule,
          MdSnackBarModule,
          MdDialogModule,
        ],
        providers: [
          { provide: Store, useValue: new MockStore() },
          ActionModeService,
          AnimatorService,
          DemoService,
          DialogService,
          FileExportService,
          FileImportService,
          LayerTimelineService,
          PlaybackService,
          ShortcutService,
          SnackBarService,
          ThemeService,
        ],
      }).compileComponents();
      loadSvgIcons([
        { name: 'addlayer', path: 'assets/icons/addlayer.svg' },
        { name: 'animationblock', path: 'assets/icons/animationblock.svg' },
        { name: 'vector', path: 'assets/icons/vectorlayer.svg' },
      ]);
    }),
  );

  beforeEach(
    inject([Store], (store: MockStore) => {
      fixture = TestBed.createComponent(LayerTimelineComponent);
      component = fixture.componentInstance;
      component.ngOnInit();
      fixture.detectChanges();
    }),
  );

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});

function loadSvgIcons(svgIcons: Array<{ name: string; path: string }>) {
  const mdIconRegistry = TestBed.get(MdIconRegistry);
  const sanitizer = TestBed.get(DomSanitizer);
  for (const { name, path } of svgIcons) {
    mdIconRegistry.addSvgIcon(name, sanitizer.bypassSecurityTrustResourceUrl(path));
  }
}
