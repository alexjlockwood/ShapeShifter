// TODO: can this be removed?
import 'core-js/es7/reflect';

import { HttpClientModule } from '@angular/common/http';
import { ComponentFixture, TestBed, async, inject } from '@angular/core/testing';
import { FlexLayoutModule } from '@angular/flex-layout';
import {
  MatButtonModule,
  MatDialogModule,
  MatIconModule,
  MatIconRegistry,
  MatMenuModule,
  MatSnackBarModule,
  MatTooltipModule,
} from '@angular/material';
import { DomSanitizer } from '@angular/platform-browser';
import { DialogService } from 'app/components/dialogs';
import { ProjectService } from 'app/components/project';
import { ScrollGroupDirective } from 'app/components/scrollgroup/scrollgroup.directive';
import { SplitterComponent } from 'app/components/splitter/splitter.component';
import {
  ActionModeService,
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

  beforeEach(async(() => {
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
        HttpClientModule,
        FlexLayoutModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatTooltipModule,
        MatSnackBarModule,
        MatDialogModule,
      ],
      providers: [
        { provide: Store, useValue: new MockStore() },
        ActionModeService,
        ProjectService,
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
  }));

  beforeEach(inject([Store], (store: MockStore) => {
    fixture = TestBed.createComponent(LayerTimelineComponent);
    component = fixture.componentInstance;
    component.ngOnInit();
    fixture.detectChanges();
  }));

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});

function loadSvgIcons(svgIcons: Array<{ name: string; path: string }>) {
  const mdIconRegistry = TestBed.get(MatIconRegistry);
  const sanitizer = TestBed.get(DomSanitizer);
  for (const { name, path } of svgIcons) {
    mdIconRegistry.addSvgIcon(name, sanitizer.bypassSecurityTrustResourceUrl(path));
  }
}
