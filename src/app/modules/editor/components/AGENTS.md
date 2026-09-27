# Components

Paths are relative to `src/app/modules/editor/`.

- Components are React 19 function components in PascalCase `.tsx` files, each importing its own
  lowercase `.scss`. The imperative classes that draw and handle gestures are PascalCase `.ts` files
  next to them (e.g. `components/canvas/CanvasController.ts`).
- `components/root/App.tsx` renders `components/root/Root.tsx`, whose workspace holds the toolbar,
  the canvas (three of them in action mode: current, start, and end), playback controls, the
  property inspector (hidden in action mode), and the layer list and timeline. Mobile user agents
  get `components/splashscreen/` instead.

## State and actions

- `useAppSelector(selector)` re-renders when the value changes. Pass a memoized selector from the
  store (see `store/AGENTS.md`).
- `useServices()` returns the services, and components call their methods instead of dispatching.
  Nothing uses `useDispatch`.
- `useStoreEffect(selector, fn)` subscribes without re-rendering, for state that changes on every
  frame, like the current time. The selector is an effect dependency, so define it outside the
  component.
- `useEditorStore()` returns the store, e.g. to hand to an imperative controller.
- `useServices()` and `useEditorStore()` are in `context/EditorContext.tsx`. The other hooks are in
  `hooks/`, which also has `requireRef`, `useMenu`, and `useScrollGroup`.

## Canvas and timeline drawing

The canvas and the timeline grid are drawn imperatively. The component renders the elements and
creates a controller in a layout effect, and the controller subscribes to the store and redraws,
so playback never re-renders React. `components/canvas/CanvasInput.ts` turns the canvas's pointer
events into gestures, capturing the pointer so that drags keep going outside of the canvas, and
canceling them on blur and Escape. The gestures go to `components/canvas/CanvasOverlay.ts`, which
calls `actionModeService` in action mode and `layerTimelineService` otherwise.

Each canvas covers its whole panel. `components/canvas/CanvasCamera.ts` maps between its three
coordinate spaces: viewport coordinates (the vector layer's units), panel coordinates (CSS pixels
from the panel's top left), and device coordinates (pixels in the backing store). Draw and hit test
through it rather than scaling by hand, and convert pixel sizes like tolerances with
`toViewportLength`. The view it shows, fit or a scale and a center, is in
`services/canvasviewport.service.ts`, outside the store so that undo leaves it alone, and the three
canvases in action mode share it. With the canvas editor on, `components/canvas/CanvasNavigation.ts`
zooms and pans with the wheel, pinches, and drags with the space bar or middle button held, and the
keyboard shortcuts in `services/shortcut.service.ts` zoom through the viewport service (holding the
space bar pans, and tapping it plays). The white artboard is a div under the canvases, which ignore
the mouse, so mouse events go to it and clicks around it reach the workspace. The rulers are inside
of it too, so hovering over it shows them.

The new canvas editor is in `components/canvaseditor/`. `docs/canvas-editor.md` has its design
and roadmap. It's only downloaded when its feature is on (`src/environments/features.ts`). `components/canvas/CanvasController.ts` loads it through
`components/canvas/loadCanvasEditor.ts` and talks to it through the types in
`components/canvas/CanvasEditorApi.ts`. Nothing else may import it, or it would be bundled with the
rest of the app (`src/test/lazyChunks.spec.ts` checks this). Its gestures show their edits through
`components/canvas/CanvasPreview.ts`, which the main canvas draws and hit tests, rather than
dispatching on every pointer move. A gesture sets a working copy of the whole document (the layers
and the animation), and commits it once, as its own undo step. Anything else that changes the
document or the time cancels it. Moving layers moves their animation blocks with them, and scaling
or rotating them transforms every path in them, in its own coordinates, since group transforms can't
express every matrix (`components/canvaseditor/transformLayers.ts`). A path that an animation block
sets at the current time can't be reshaped yet (`canEditPath`).

With the editor loaded, the main canvas takes the pointer anywhere in its panel and gives it to the
editor (`components/canvaseditor/CanvasEditor.ts`), except in action mode, and the panel's clicks
don't reach the workspace. The editor's tools, like `components/canvaseditor/SelectTool.ts`, are
state machines that take points in viewport coordinates, and
`components/canvaseditor/EditorRenderer.ts` draws their outlines, handles, and snap guides on a
canvas of their own. Snapping is in `components/canvaseditor/snapping.ts`. Hit testing and bounds
are in `components/canvas/LayerGeometry.ts`, which clicks on the canvas use with the editor off too.
Double-clicking a path, or Enter, switches from the select tool to
`components/canvaseditor/PathEditTool.ts`, which edits the path's points with the operations in
`model/paths/PathEdit.ts` until Enter or Escape, a press on another layer or on nothing, or
anything that makes the path uneditable (e.g. selecting something else, hiding it, or moving the
time into one of its path blocks). Its point selection is kept by anchor id, in the tool rather
than the store. Only the canvas editor imports `PathEdit`, so that it stays in the lazy chunk.

## Styling

- Styles are SCSS. MUI components are themed in `styles/muiTheme.ts` and restyled with SCSS that
  targets their `.Mui*` classes (`components/root/App.tsx` puts the app's styles after MUI's).
  Nothing uses `sx`, `styled()`, or emotion directly.
- Theme colors are in `_<name>-theme.scss` partials with an `ss-<name>-theme` mixin. They're
  included in `styles/theme.scss`, which applies them for the light theme and under
  `.ss-dark-theme` (set on `body`, so portals get it too). A new themed component needs its partial
  added there.
- Class prefixes: `app-<component>` on component roots, `slt-` for the layer timeline, `spi-` for
  the property inspector, `splt-` for the splitter, and `ss-` for globals.

## Gotchas

- Clicking the workspace background clears the selection. Clicks inside the panels bubble up to
  it too, so panels stop propagation. Clicks in menus and dialogs also bubble up through their
  React portals, but `components/root/Root.tsx` ignores those, since their targets are outside the
  workspace element. It also ignores clicks that didn't start where they ended, which the browser
  sends to the elements' common ancestor, past the panels.
- StrictMode runs effects twice in dev. Service `init()` methods guard against it, and controllers
  are created without side effects and started in a layout effect.
- React's wheel listeners are passive, so the timeline adds a native listener to prevent
  scrolling.
- Each panel is wrapped in `components/root/PanelErrorBoundary.tsx`, so a render error only
  replaces that panel (with a "Try again" button) and is reported to Bugsnag.
- Dialogs (`components/dialogs/dialog.service.ts`) and the snackbar (`services/snackbar.service.ts`)
  have small stores of their own, outside Redux. Dialog methods return promises.

## Tests

There are no React render tests. Move logic out of components into plain functions or classes and
unit test those (e.g. `components/toolbar/ToolbarData.spec.ts` and
`components/propertyinput/buildPropertyInputModel.spec.ts`), and cover the UI with the end-to-end
tests in `e2e/`.
