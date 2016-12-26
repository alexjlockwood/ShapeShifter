/* tslint:disable:no-unused-variable */

import { TestBed, async, inject } from '@angular/core/testing';
import { StateService } from './state.service';

describe('StateService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [StateService]
    });
  });

  it('should ...', inject([StateService], (service: StateService) => {
    expect(service).toBeTruthy();
  }));
});
