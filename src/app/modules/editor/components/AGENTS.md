# Components

Paths are relative to `src/app/modules/editor/`.

- Components are React 19 function components in PascalCase `.tsx` files, each importing its own
  lowercase `.scss`. The imperative classes that draw and handle gestures are PascalCase `.ts` files
  next to them (e.g. `components/canvas/CanvasController.ts`).
- `components/root/App.tsx` renders `components/root/Root.tsx`, whose workspace holds the toolbar,
  the canvas (three of them in action mode: current, start, and end), playback controls, the
  property inspector (hidden in action mode), and the layer list and timeline. Mobile user agents
  get `components/splashscreen/` instead.
- Action mode (the morph editor) is entered with `actionModeService.editMorph(blockId)`, from the
  inspector, a double-click on a path block, the canvas editor's keyframe badge, or the context
  menu, and it leaves on its own once undo takes the block away. `actionModeService.morphInto`
  starts a morph from two paths ("Morph into" in the context menu, and the snackbar after an
  import or paste), with its rules in `scripts/common/morphLayers.ts`. Its three panels are labeled and bordered, under a
  status strip that says whether the paths morph (`components/toolbar/ActionModeStatusStrip.tsx`,
  with its message from `components/toolbar/actionModeStatus.ts`), and its commands are in a
  floating bar over the bottom of the panels (`components/toolbar/ActionBar.tsx`). The app bar
  keeps the title and a Done button. `components/toolbar/ToolbarData.ts` decides which commands
  apply to the selection.

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
canceling them on pointercancel, context menus, blur, and Escape. A mouse move that shows the
button is already up ends the gesture like its release, where it last was, since a macOS trackpad
can send one right before the release. So does losing the capture, which Chrome does first for
that move. Safari's lostpointercapture never reports buttons, so it can't tell whether the button
is still down, and a mouse gesture is kept in every case. The gestures go to
`components/canvas/CanvasOverlay.ts`, which calls `actionModeService` in action mode and
`layerTimelineService` otherwise.

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
of it too, so hovering over it shows them. With the canvas editor on, the main canvas's rulers show
all the time instead, unless its settings hide them (`services/canvassettings.service.ts`).

The new canvas editor is in `components/canvaseditor/`. `docs/canvas-editor.md` has its design
and roadmap. It's on unless its feature is turned off (`src/environments/features.ts`), and its
code is a chunk of its own, so that it doesn't delay the first render.
`components/canvas/CanvasController.ts` loads it through
`components/canvas/loadCanvasEditor.ts` and talks to it through the types in
`components/canvas/CanvasEditorApi.ts`. Nothing else may import it, or it would be bundled with the
rest of the app (`src/test/lazyChunks.spec.ts` checks this). Its gestures show their edits through
`components/canvas/CanvasPreview.ts`, which the main canvas draws and hit tests, rather than
dispatching on every pointer move. A gesture sets a working copy of the whole document (the layers
and the animation), and commits it once, as its own undo step. Anything else that changes the
document or the time cancels it. Moving layers moves their animation blocks with them, and scaling
or rotating them transforms every path in them, in its own coordinates, since group transforms can't
express every matrix (`components/canvas/transformLayers.ts`, outside the editor so the rest of the
app can use it too). A path that an animation block sets at the current time is reshaped where its
keyframe is saved, and not at all while it's morphing (`components/canvas/pathKeyframes.ts`, and
`canEditPath` and `getBasePath` in the preview). `components/canvaseditor/KeyframeBadge.ts` says
whether the morph still works.

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
`components/canvaseditor/EditorToolbar.ts` adds the tools' buttons to the panel, as plain DOM. The
drawing tools (`components/canvaseditor/PenTool.ts`, `components/canvaseditor/PencilTool.ts`, and
`components/canvaseditor/ShapeTool.ts`) get the pointer before the others, and put new layers where
`components/canvaseditor/newLayers.ts` says. Presses on a ruler, and on a guide with the select
tool, go to `components/canvaseditor/GuideTool.ts` first. The guides are part of the document, in
the store (`store/guides/`, saved with the project), and the editor's settings (the rulers, the
pixel grid, and snapping to it) are preferences in `services/canvassettings.service.ts`. Alt
measures distances (`components/canvaseditor/measuring.ts`). Boolean operations and outline
stroke are in `components/canvaseditor/pathOps.ts` (which layers they apply to is in
`scripts/common/pathOpLayers.ts`, for the context menu), which loads Skia's PathKit (`pathkit-wasm`)
the first time it's used; `vite.config.ts` puts it with the editor's assets. The editor also
exports `components/canvaseditor/PathInspector.tsx`, which the property inspector shows while a
path's points are edited, once `components/canvas/useCanvasEditorModule.ts` has loaded it. Its
styles are in `components/propertyinput/propertyinput.scss`, since the editor's code can't import
CSS.

## Property inspector

`components/propertyinput/PropertyInput.tsx` shows the selection's properties in sections of
compact rows, like Figma's design panel. `components/propertyinput/buildPropertyInputModel.ts`
wraps each property in an `InspectedProperty`, and
`components/propertyinput/inspectorSections.ts` groups them with a static map from property name
to section, row, and field label, so a property with a known name lands in the same place
whatever model has it (the transform properties go in Transform for groups and paths alike). A
new property needs an entry there, or it shows in an "Other" section, and its spec fails. The
Layout section isn't made of properties: it's the layer's bounds on the canvas at the current
time, and typing a value moves or scales the layer through `components/canvas/transformLayers.ts`
as one undo step (`components/propertyinput/layoutValues.ts`), with the editor on or off. Its
selector (`createLayoutSelector`) keeps the layout while playback plays, since bounding a big group
on every frame made playback stutter. Rows of properties that can be animated end with a keyframe
button, which is filled once they are.

While a path's points are edited, the editor reports the path it edits and its selected points
to `services/canvaseditorbridge.service.ts`, which the inspector subscribes to with
`useSyncExternalStore`, and the editor's `PathInspector` takes the place of Layout and the path's
row. Its edits go back through the bridge (`editPoints`, `runPointCommand`), so they're saved where
the canvas saves its own, e.g. in a path block's value at a keyframe.

## Context menus

Right-clicking the main canvas (outside of action mode) or a layer row, or clicking a row's "more"
button, selects the layer under the pointer if it isn't selected, and opens
`components/contextmenu/ContextMenuHost.tsx` through `components/contextmenu/contextmenu.service.ts`
(`components/contextmenu/contextMenuSelection.ts` has the rule). Right-clicking a timeline block
selects it the same way, and right-clicking the canvas editor's keyframe badge opens a menu for
the badge's blocks without selecting them, since that would deselect the path the badge is about
(the request carries their ids). Its items come from
`components/contextmenu/buildContextMenu.ts`, a plain function of the saved document, the
selection, the blocks, the current time, what the canvas editor reports, and whether the canvas is
zoomed to fit, built as a list of sections. A new kind of item goes in a section builder of its own, added to
`CONTEXT_MENU_SECTIONS`, or `BLOCK_CONTEXT_MENU_SECTIONS` for blocks. Items that can't run say
why, rather than being left out, and those that only the canvas editor runs (Duplicate, the
boolean operations, and Outline stroke) are left out while it isn't loaded or is turned off.
They reach it through `services/canvaseditorbridge.service.ts`, which `CanvasController` attaches
the editor to once it's loaded, since the editor's code is in the lazy chunk. While a path's
points are edited, a right-click selects the point under the pointer, and the menu starts with the
selected points' commands (`buildPointSection`), from what the editor reports in `getMenuState`.
Combine and Break apart (`scripts/common/combineLayers.ts`) and the rules for which layers the path
operations apply to (`scripts/common/pathOpLayers.ts`) are outside of it, so they work with the
editor off. Everywhere else, `services/shortcut.service.ts` keeps the browser's menu from opening,
except over text fields and links (`shouldOpenBrowserContextMenu`), so the app's
own menus must stop the browser's themselves. MUI has
no submenus, so the host opens one in a `Popper` inside the menu's modal: hovering, ArrowRight,
Enter, or Space opens it, and ArrowLeft or Escape goes back.

## Styling

- Styles are SCSS. MUI components are themed in `styles/muiTheme.ts` and restyled with SCSS that
  targets their `.Mui*` classes (`components/root/App.tsx` puts the app's styles after MUI's).
  Nothing uses `sx`, `styled()`, or emotion directly.
- Theme colors are in `_<name>-theme.scss` partials with an `ss-<name>-theme` mixin. They're
  included in `styles/theme.scss`, which applies them for the light theme and under
  `.ss-dark-theme` (set on `body`, so portals get it too). A new themed component needs its partial
  added there.
- For accent colors, use the theme's `accent-fill` behind white text and icons, and `accent-text`
  for text and icons on the theme's background. Both pass WCAG AA in both themes, unlike the older
  `accent` palette.
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
- `services/shortcut.service.ts` listens on the window, so Delete and Backspace delete the
  selected layers or blocks unless a text field has the focus. A focusable widget that takes those
  keys stops their propagation, like the easing curve editor
  (`components/propertyinput/InterpolatorEditor.tsx`, whose editing rules are in
  `components/propertyinput/curveEditing.ts`). The canvas editor listens in the capture phase and
  sees keys first, but it only takes those two while the pen draws or a path's points are edited.
- Each panel is wrapped in `components/root/PanelErrorBoundary.tsx`, so a render error only
  replaces that panel (with a "Try again" button) and is reported to Bugsnag.
- Dialogs (`components/dialogs/dialog.service.ts`) and the snackbar (`services/snackbar.service.ts`)
  have small stores of their own, outside Redux. Dialog methods return promises, and the
  snackbar's button calls the `onAction` passed to `snackBarService.show`.

## Tests

There are no React render tests. Move logic out of components into plain functions or classes and
unit test those (e.g. `components/toolbar/ToolbarData.spec.ts` and
`components/propertyinput/buildPropertyInputModel.spec.ts`), and cover the UI with the end-to-end
tests in `e2e/`.
