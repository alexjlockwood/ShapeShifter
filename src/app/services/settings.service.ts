import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { VectorLayer } from '../scripts/layers';
import { Observable } from 'rxjs/Observable';

/**
 * A simple service that broadcasts changes to the application's settings.
 */
@Injectable()
export class SettingsService {
  private readonly source = new BehaviorSubject<Settings>({shouldLabelPoints: false});

  getSettingsObservable() {
    return this.source.asObservable();
  }

  setShouldLabelPoints(shouldLabelPoints: boolean) {
    const currentSettings = Object.assign({}, this.source.getValue());
    currentSettings.shouldLabelPoints = shouldLabelPoints;
    this.source.next(currentSettings);
  }

  shouldLabelPoints() {
    return this.source.getValue().shouldLabelPoints;
  }
}

export interface Settings {
  shouldLabelPoints: boolean;
}
