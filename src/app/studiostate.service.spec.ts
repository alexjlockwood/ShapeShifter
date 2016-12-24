/* tslint:disable:no-unused-variable */

import { TestBed, async, inject } from '@angular/core/testing';
import { StudioStateService } from './studiostate.service';

describe('StudioStateService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [StudioStateService]
    });
  });

  it('should ...', inject([StudioStateService], (service: StudioStateService) => {
    expect(service).toBeTruthy();
  }));
});
