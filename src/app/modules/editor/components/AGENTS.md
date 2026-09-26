# Components

Paths are relative to `src/app/modules/editor/`.

- Components are React 19 function components in PascalCase `.tsx` files, each importing its own
  lowercase `.scss`. The imperative classes that draw and handle gestures are PascalCase `.ts` files
  next to them (e.g. `components/canvas/CanvasController.ts`).
- `components/root/App.tsx` renders `components/root/Root.tsx`, whose workspace holds the toolbar, the canvas (three
  of them in action mode: current, start, and end), playback controls, the property inspector
  (hidden in action mode), and the layer list and timeline. Mobile user agents get
  `components/splashscreen/` instead.

## State and actions

- `useAppSelector(selector)` re-renders when the value changes. Pass a memoized selector from the
  store (see `store/AGENTS.md`).
- `useServices()` returns the services, and components call their methods instead of dispatching.
  Nothing uses `useDispatch`.
- `useStoreEffect(selector, fn)` subscribes without re-rendering, for state that changes on every
  frame, like the current time. The selector is an effect dependency, so define it outside the
  component.
- `useEditorStore()` returns the store, e.g. to hand to an imperative controller.
- `hooks/` also has `requireRef`, `useElementSize`, `useMenu`, and `useScrollGroup`.

## Canvas and timeline drawing

The canvas and the timeline grid are drawn imperatively. The component renders the elements and
creates a controller in a layout effect, and the controller subscribes to the store and redraws,
so playback never re-renders React. Mouse gestures on the canvas go to
`components/canvas/CanvasOverlay.ts`, which calls `actionModeService` in action mode and
`layerTimelineService` otherwise.

## Styling

- Styles are SCSS. MUI components are themed in `styles/muiTheme.ts` and restyled with SCSS that
  targets their `.Mui*` classes (`components/root/App.tsx` puts the app's styles after MUI's). Nothing uses `sx`,
  `styled()`, or emotion directly.
- Theme colors are in `_<name>-theme.scss` partials with an `ss-<name>-theme` mixin. They're
  included in `styles/theme.scss`, which applies them for the light theme and under
  `.ss-dark-theme` (set on `body`, so portals get it too). A new themed component needs its partial
  added there.
- Class prefixes: `app-<component>` on component roots, `slt-` for the layer timeline, `spi-` for
  the property inspector, `splt-` for the splitter, and `ss-` for globals.

## Gotchas

- Clicking the workspace clears the selection, and clicks in portals bubble up to it, so panels
  stop propagation.
- StrictMode runs effects twice in dev. Service `init()` methods guard against it, and controllers
  are created without side effects and started in a layout effect.
- React's wheel listeners are passive, so the timeline adds a native listener to prevent
  scrolling.
- Each panel is wrapped in `components/root/PanelErrorBoundary.tsx`, so a render error only
  replaces that panel (with a "Try again" button) and is reported to Bugsnag.
- Dialogs (`components/dialogs/dialog.service.ts`) and the snackbar (`services/snackbar.service.ts`)
  have small stores of their own, outside Redux. Dialog methods return promises.
- `components/canvas/canvaspaper.directive.ts` and `components/toolpanel/` belong to the paper.js
  beta editor, which isn't compiled. Ignore them when looking for usages.

## Tests

There are no React render tests. Move logic out of components into plain functions or classes and
unit test those (e.g. `components/toolbar/ToolbarData.spec.ts` and
`components/propertyinput/buildPropertyInputModel.spec.ts`), and cover the UI with the end-to-end
tests in `e2e/`.
