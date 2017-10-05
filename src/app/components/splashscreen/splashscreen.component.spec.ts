import { ComponentFixture, TestBed, async } from '@angular/core/testing';
import { HttpModule } from '@angular/http';
import { MatIconModule, MatIconRegistry } from '@angular/material';
import { MATERIAL_COMPATIBILITY_MODE } from '@angular/material/core';
import { DomSanitizer } from '@angular/platform-browser';

import { SplashScreenComponent } from './splashscreen.component';

describe('SplashScreenComponent', () => {
  let component: SplashScreenComponent;
  let fixture: ComponentFixture<SplashScreenComponent>;

  beforeEach(
    async(() => {
      TestBed.configureTestingModule({
        declarations: [SplashScreenComponent],
        imports: [HttpModule, MatIconModule],
        providers: [{ provide: MATERIAL_COMPATIBILITY_MODE, useValue: true }],
      }).compileComponents();
      loadSvgIcons([{ name: 'shapeshifter', path: 'assets/shapeshifter.svg' }]);
    }),
  );

  beforeEach(() => {
    fixture = TestBed.createComponent(SplashScreenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

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
