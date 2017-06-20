import { ToolbarComponent } from './toolbar.component';
import {
  ComponentFixture,
  TestBed,
  async,
  inject,
} from '@angular/core/testing';
import { FlexLayoutModule } from '@angular/flex-layout';
import { HttpModule } from '@angular/http';
import {
  MdButtonModule,
  MdIconModule,
  MdIconRegistry,
  MdMenuModule,
  MdTooltipModule,
} from '@angular/material';
import { DomSanitizer } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { SplitterComponent } from 'app/components/splitter/splitter.component';
import {
  ActionModeService,
  AnimatorService,
  DemoService,
  DialogService,
  FileExportService,
  FileImportService,
  PlaybackService,
  ShortcutService,
  SnackBarService,
} from 'app/services';
import { Store } from 'app/store';
import { MockStore } from 'test/MockStore';

describe('ToolbarComponent', () => {
  let component: ToolbarComponent;
  let fixture: ComponentFixture<ToolbarComponent>;

  beforeEach(async(() => {
    TestBed
      .configureTestingModule({
        declarations: [ToolbarComponent],
        imports: [
          BrowserAnimationsModule,
          HttpModule,
          FlexLayoutModule,
          MdButtonModule,
          MdIconModule,
          MdMenuModule,
          MdTooltipModule,
        ],
        providers: [
          { provide: Store, useValue: new MockStore() },
          ActionModeService,
        ],
      })
      .compileComponents();
    loadSvgIcons([
      { name: 'autofix', path: 'assets/icons/autofix.svg' },
      { name: 'contribute', path: 'assets/icons/contribute.svg' },
      { name: 'shapeshifter', path: 'assets/shapeshifter.svg' },
      { name: 'reverse', path: 'assets/icons/reverse.svg' },
    ]);
  }));

  beforeEach(inject([Store], (store: MockStore) => {
    fixture = TestBed.createComponent(ToolbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});

function loadSvgIcons(svgIcons: Array<{ name: string, path: string }>) {
  const mdIconRegistry = TestBed.get(MdIconRegistry);
  const sanitizer = TestBed.get(DomSanitizer);
  for (const { name, path } of svgIcons) {
    mdIconRegistry.addSvgIcon(name, sanitizer.bypassSecurityTrustResourceUrl(path));
  }
}
