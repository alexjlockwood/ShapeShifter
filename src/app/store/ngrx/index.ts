import { Dispatcher } from './dispatcher';
export const INIT_ACTION = Dispatcher.INIT;

export { Action } from './dispatcher';
export { StoreModule } from './ng';
export { ActionReducer } from './reducer';
export { SelectSignature, select } from './select';
export { Store } from './store';
export { combineReducers, ComposeSignature, compose } from './utils';
