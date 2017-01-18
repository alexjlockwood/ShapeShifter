import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { VectorLayer } from '../scripts/model';
import { Observable } from 'rxjs/Observable';
import { EditorType } from '../scripts/model';
import { BaseService } from './base.service';

@Injectable()
export class LayerStateService extends BaseService<VectorLayer> {

  constructor() {
    super(undefined);
  }
}
