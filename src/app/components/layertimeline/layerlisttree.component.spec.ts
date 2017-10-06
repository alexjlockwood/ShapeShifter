import { ComponentFixture, TestBed, async, inject } from '@angular/core/testing';
import { FlexLayoutModule } from '@angular/flex-layout';
import { HttpModule } from '@angular/http';
import {
  MatButtonModule,
  MatIconModule,
  MatIconRegistry,
  MatMenuModule,
  MatTooltipModule,
} from '@angular/material';
import { MATERIAL_COMPATIBILITY_MODE } from '@angular/material/core';
import { By, DomSanitizer } from '@angular/platform-browser';
import { ActionModeService, LayerTimelineService } from 'app/services';
import { Store } from 'app/store';
import { State as LayerState } from 'app/store/layers/reducer';
import * as $ from 'jquery';
import { MockStore } from 'test/MockStore';

import { LayerListTreeComponent } from './layerlisttree.component';

describe('LayerListTreeComponent', () => {
  let component: LayerListTreeComponent;
  let fixture: ComponentFixture<LayerListTreeComponent>;
  let store: MockStore;

  beforeEach(
    async(() => {
      TestBed.configureTestingModule({
        declarations: [LayerListTreeComponent],
        imports: [
          HttpModule,
          FlexLayoutModule,
          MatButtonModule,
          MatIconModule,
          MatMenuModule,
          MatTooltipModule,
        ],
        providers: [
          { provide: Store, useValue: new MockStore() },
          ActionModeService,
          LayerTimelineService,
          { provide: MATERIAL_COMPATIBILITY_MODE, useValue: true },
        ],
      }).compileComponents();
      loadSvgIcons([
        { name: 'animationblock', path: 'assets/icons/animationblock.svg' },
        { name: 'vector', path: 'assets/icons/vectorlayer.svg' },
      ]);
    }),
  );

  beforeEach(
    inject([Store], (s: MockStore) => {
      fixture = TestBed.createComponent(LayerListTreeComponent);
      component = fixture.componentInstance;
      store = s;
    }),
  );

  function callNgOnInit(layers?: LayerState) {
    if (layers) {
      store.setLayerState(layers);
    }
    component.layer = store.getState().present.layers.vectorLayer;
    component.ngOnInit();
    fixture.detectChanges();
  }

  it('Initialize w/ default state', () => {
    callNgOnInit();
    const vectorLayerElem = fixture.debugElement.query(By.css('.slt-layer-id-text')).nativeElement;
    expect(
      $(vectorLayerElem)
        .text()
        .trim(),
    ).toBe('vector');
  });
});

function loadSvgIcons(svgIcons: Array<{ name: string; path: string }>) {
  const matIconRegistry = TestBed.get(MatIconRegistry);
  const sanitizer = TestBed.get(DomSanitizer);
  for (const { name, path } of svgIcons) {
    matIconRegistry.addSvgIcon(name, sanitizer.bypassSecurityTrustResourceUrl(path));
  }
}
