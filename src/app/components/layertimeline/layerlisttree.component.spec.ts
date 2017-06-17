import { LayerListTreeComponent } from './layerlisttree.component';
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
import { ActionModeService } from 'app/services/actionmode/actionmode.service';
import { Store } from 'app/store';
import { MockStore } from 'test/store/MockStore.spec';

describe('LayerListTreeComponent', () => {
  let component: LayerListTreeComponent;
  let fixture: ComponentFixture<LayerListTreeComponent>;

  beforeEach(async(() => {
    TestBed
      .configureTestingModule({
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
        ],
      })
      .compileComponents();
    loadSvgIcons([
      { name: 'animationblock', path: 'assets/icons/animationblock.svg' },
      { name: 'vectorlayer', path: 'assets/icons/vectorlayer.svg' },
    ]);
  }));

  beforeEach(inject([Store], (store: MockStore) => {
    fixture = TestBed.createComponent(LayerListTreeComponent);
    component = fixture.componentInstance;
    component.layer = store.getState().present.layers.vectorLayer;
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
