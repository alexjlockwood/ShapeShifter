import { ComponentFixture, TestBed, async, inject } from '@angular/core/testing';
import { FlexLayoutModule } from '@angular/flex-layout';
import { FormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';
import {
  MatButtonModule,
  MatIconModule,
  MatIconRegistry,
  MatMenuModule,
  MatSlideToggleModule,
  MatTooltipModule,
} from '@angular/material';
import { MATERIAL_COMPATIBILITY_MODE } from '@angular/material/core';
import { DomSanitizer } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActionModeService, LayerTimelineService, ThemeService } from 'app/services';
import { Store } from 'app/store';
import { MockStore } from 'test/MockStore';

import { ToolbarComponent } from './toolbar.component';

describe('ToolbarComponent', () => {
  let component: ToolbarComponent;
  let fixture: ComponentFixture<ToolbarComponent>;

  beforeEach(
    async(() => {
      TestBed.configureTestingModule({
        declarations: [ToolbarComponent],
        imports: [
          HttpModule,
          FlexLayoutModule,
          FormsModule,
          MatButtonModule,
          MatIconModule,
          MatMenuModule,
          MatTooltipModule,
          MatSlideToggleModule,
          NoopAnimationsModule,
        ],
        providers: [
          { provide: Store, useValue: new MockStore() },
          ActionModeService,
          LayerTimelineService,
          ThemeService,
          { provide: MATERIAL_COMPATIBILITY_MODE, useValue: true },
        ],
      }).compileComponents();
      loadSvgIcons([
        { name: 'autofix', path: 'assets/icons/autofix.svg' },
        { name: 'contribute', path: 'assets/icons/contribute.svg' },
        { name: 'reverse', path: 'assets/icons/reverse.svg' },
        { name: 'shapeshifter', path: 'assets/shapeshifter.svg' },
      ]);
    }),
  );

  beforeEach(
    inject([Store], (store: MockStore) => {
      fixture = TestBed.createComponent(ToolbarComponent);
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
  const matIconRegistry = TestBed.get(MatIconRegistry);
  const sanitizer = TestBed.get(DomSanitizer);
  for (const { name, path } of svgIcons) {
    matIconRegistry.addSvgIcon(name, sanitizer.bypassSecurityTrustResourceUrl(path));
  }
}
