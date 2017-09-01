import { ComponentFixture, TestBed, async, inject } from '@angular/core/testing';
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
import { By } from '@angular/platform-browser';
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
          MdButtonModule,
          MdIconModule,
          MdMenuModule,
          MdTooltipModule,
        ],
        providers: [
          { provide: Store, useValue: new MockStore() },
          ActionModeService,
          LayerTimelineService,
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
  const mdIconRegistry = TestBed.get(MdIconRegistry);
  const sanitizer = TestBed.get(DomSanitizer);
  for (const { name, path } of svgIcons) {
    mdIconRegistry.addSvgIcon(name, sanitizer.bypassSecurityTrustResourceUrl(path));
  }
}
