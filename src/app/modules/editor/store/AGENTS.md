# Store

Paths are relative to `src/app/modules/editor/`.

The app's state is one Redux store behind an ngrx-style wrapper (`store/Store.ts`), since the app
was ported from ngrx. `store/createEditorStore.ts` builds it.

## Shape

- `store.getState()` returns redux-undo's history: `{ past, present, future, timestamp }`. The
  editor state is `present`, with one slice per directory: `layers`, `timeline`, `playback`,
  `actionmode`, `reset`, `theme`, and `paper` (`store/reducer.ts`).
- `paper` is written by the paper.js beta editor, which isn't compiled, and by
  `services/StoreUtil.ts` and `services/layertimeline.service.ts` only when `environment.beta` is
  true, which it never is. So it doesn't change in the shipped app, but it's still used by compiled
  code, so don't delete it.
- `store.select(selector)` returns an rxjs observable that emits the current value right away and
  then each change (by reference). Services and imperative controllers subscribe with it. There's
  no `store.subscribe`.

## Actions

- Actions are classes in `store/<slice>/actions.ts`, with `readonly type = XActionTypes.Y` (strings
  like `'__layers__SET_VECTOR_LAYER'`) and a `readonly payload` set in the constructor. Add new
  ones to the slice's union type. The paper slice's actions put their fields on the action itself.
- A middleware in `store/createEditorStore.ts` spreads each action into a plain object, because
  Redux rejects class instances. Reducers can't use `instanceof` or getters on the action.
- Components don't dispatch. They call a service (`services/`), which reads the state with
  `queryStore(selector)` and dispatches. The few direct dispatches (e.g. `ResetWorkspace` in
  `components/root/Root.tsx`) aren't a pattern to copy.

## Meta reducers

From the outside in: the action logger (dev only), freeze (dev and tests), undo, batch, reset.

- **Undo** (`store/undoredo/metareducer.ts`) keeps 30 states. An action less than 1 second after
  the previous recorded one joins its undo step. Actions in `UNDO_EXCLUDED_ACTIONS` (the playback
  actions, `SetActionMode`, `SetActionModeHover`, and `SetTheme`) update the state without
  recording a step. Everything else is recorded, including selections, hidden and collapsed layers,
  and action mode selections and pairings. Undo and redo keep the current theme.
- **Batch:** `new BatchAction(a, b)` applies several actions as one undo step. Only one level is
  unpacked, so don't nest batches.
- **Reset:** `ResetWorkspace` rebuilds every slice's initial state, then loads its payload. It's an
  ordinary undo step.
- **Freeze:** dev builds and tests deep-freeze the state, so mutating a model object taken from the
  store throws. Clone it first (e.g. `animation.clone()`). Production doesn't freeze, so the same
  mutation silently succeeds there. Freezing doesn't cover Sets: copy them (`new Set(...)`) before
  changing them.

## Dispatching from a subscriber

`queueNestedDispatches` (`store/createEditorStore.ts`) holds back an action dispatched while
subscribers are being notified until all of them have seen the current state, like ngrx did.
Inside a subscriber, `getState()` right after `dispatch()` doesn't include the action yet. The
queue is dropped if a reducer or subscriber throws.

## Selectors

- Use `createSelector` and `createDeepEqualSelector` from `store/selectors.ts`, not reselect's.
  They memoize with `lruMemoize`, so playback doesn't retain a vector layer for every frame. Use
  the deep-equal one when the result is a Set or an object that's rebuilt on each change.
- Selectors take the root state and go through `getEditorState` (`state.present`). Name them `getX`
  for values and `isX` for booleans. Structured selectors for a whole panel (e.g.
  `getToolbarState`) live in `store/common/selectors.ts` or the slice's `selectors.ts`.
- `store.select` and `useAppSelector` compare by reference, so a selector that isn't memoized
  emits on every dispatch.

## Adding an action

Following `SetCollapsedLayers`:

1. `store/<slice>/actions.ts`: an enum member, the class, and the union type.
2. `store/<slice>/reducer.ts`: the state field, its initial value, and a `case` that returns a new
   object (with copied Sets).
3. `store/<slice>/selectors.ts`: a selector.
4. If it's UI-only state, add it to `UNDO_EXCLUDED_ACTIONS`.
5. A service method that computes the new value and dispatches, with `BatchAction` for several
   actions (`services/layertimeline.service.ts` has many examples).
6. A new slice also goes in `EditorState` and `reducers` in `store/reducer.ts`.

## Tests

- Create `store = createEditorStore()` and `services = createEditorServices(store)` in `beforeEach`,
  and call `services.dispose()` in `afterEach`. Load a project with
  `store.dispatch(new ResetWorkspace(vectorLayer, animation))`.
- To test undo, use fake timers to get past the 1 second grouping (`vi.advanceTimersByTime(2000)`),
  then dispatch `ActionCreators.undo()` from redux-undo. See `store/createEditorStore.spec.ts` and
  `services/createEditorServices.spec.ts`.
