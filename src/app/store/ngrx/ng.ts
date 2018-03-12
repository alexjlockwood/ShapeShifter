import { InjectionToken, ModuleWithProviders, NgModule } from '@angular/core';

import { Dispatcher } from './dispatcher';
import { Reducer } from './reducer';
import { State } from './state';
import { Store } from './store';
import { combineReducers } from './utils';

const INITIAL_REDUCER = new InjectionToken<string>('Token ngrx/store/reducer');
const INITIAL_STATE = new InjectionToken<string>('Token ngrx/store/initial-state');

const _INITIAL_REDUCER = new InjectionToken<string>('Token _ngrx/store/reducer');
const _INITIAL_STATE = new InjectionToken<string>('Token _ngrx/store/initial-state');

function _initialReducerFactory(reducer) {
  return typeof reducer === 'function' ? reducer : combineReducers(reducer);
}

function _initialStateFactory(initialState, reducer) {
  return initialState || reducer(undefined, { type: Dispatcher.INIT });
}

function _storeFactory(dispatcher, reducer, state$) {
  return new Store(dispatcher, reducer, state$);
}

function _stateFactory(initialState: any, dispatcher: Dispatcher, reducer: Reducer) {
  return new State(initialState, dispatcher, reducer);
}

function _reducerFactory(dispatcher, reducer) {
  return new Reducer(dispatcher, reducer);
}

function provideStore(_reducer: any, _initialState?: any): any[] {
  return [
    Dispatcher,
    { provide: Store, useFactory: _storeFactory, deps: [Dispatcher, Reducer, State] },
    { provide: Reducer, useFactory: _reducerFactory, deps: [Dispatcher, INITIAL_REDUCER] },
    { provide: State, useFactory: _stateFactory, deps: [INITIAL_STATE, Dispatcher, Reducer] },
    { provide: INITIAL_REDUCER, useFactory: _initialReducerFactory, deps: [_INITIAL_REDUCER] },
    {
      provide: INITIAL_STATE,
      useFactory: _initialStateFactory,
      deps: [_INITIAL_STATE, INITIAL_REDUCER],
    },
    { provide: _INITIAL_STATE, useValue: _initialState },
    { provide: _INITIAL_REDUCER, useValue: _reducer },
  ];
}

@NgModule({})
export class StoreModule {
  static provideStore(_reducer: any, _initialState?: any): ModuleWithProviders {
    return {
      ngModule: StoreModule,
      providers: provideStore(_reducer, _initialState),
    };
  }
}
