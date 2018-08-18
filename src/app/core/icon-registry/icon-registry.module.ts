import { NgModule } from '@angular/core';
import { MatIconRegistry } from '@angular/material';
import { DomSanitizer } from '@angular/platform-browser';

@NgModule()
export class IconRegistryModule {
  constructor(matIconRegistry: MatIconRegistry, sanitizer: DomSanitizer) {
    matIconRegistry.addSvgIcon(
      'shapeshifter',
      sanitizer.bypassSecurityTrustResourceUrl('assets/shapeshifter.svg'),
    );
  }
}
