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
import { ActionModeService } from 'app/services/actionmode/actionmode.service';
import { AnimatorService } from 'app/services/animator/animator.service';
import { DemoService } from 'app/services/demos/demo.service';
import { DialogService } from 'app/services/dialogs/dialog.service';
import { FileExportService } from 'app/services/export/fileexport.service';
import { FileImportService } from 'app/services/import/fileimport.service';
import { PlaybackService } from 'app/services/playback/playback.service';
import { ShortcutService } from 'app/services/shortcut/shortcut.service';
import { SnackBarService } from 'app/services/snackbar/snackbar.service';
import { Store } from 'app/store';
import { MockStore } from 'test/store/MockStore.spec';

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
      { name: 'shapeshifter', path: 'assets/icons/shapeshifter.svg' },
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
