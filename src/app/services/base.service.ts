import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { VectorLayer } from '../scripts/model';
import { Observable } from 'rxjs/Observable';
import { EditorType } from '../scripts/model';

export abstract class BaseService<T> {
  private readonly dataMap = new Map<EditorType, T>();
  private readonly sources = new Map<EditorType, Subject<T>>();
  private readonly streams = new Map<EditorType, Observable<T>>();

  constructor(defaultValue: T | undefined) {
    [EditorType.Start, EditorType.Preview, EditorType.End]
      .forEach(type => {
        this.sources.set(type, new BehaviorSubject<T>(defaultValue));
        this.streams.set(type, this.sources.get(type).asObservable());
      });
  }

  /** Returns the data with the specified type. */
  getData(type: EditorType) {
    return this.dataMap.get(type);
  }

  /** Sets and broadcasts the data with the specified type. */
  setData(type: EditorType, data: T) {
    this.dataMap.set(type, data);
    this.notifyChange(type);
  }

  /** Broadcasts the data with the specified type. */
  notifyChange(type: EditorType) {
    this.sources.get(type).next(this.dataMap.get(type));
  }

  /**
   * Adds a listener to receivedata change events. The caller should
   * unsubscribe from the returned subscription object when it is destroyed.
   */
  addListener(type: EditorType, callback: (data: T) => void) {
    return this.streams.get(type).subscribe(callback);
  }
}
