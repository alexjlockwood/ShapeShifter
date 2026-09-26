# Shape Shifter

Shape Shifter is a web app for creating icon animations, path morphing in particular, and exporting
them as Android `AnimatedVectorDrawable`s, SVGs, and spritesheets. The live site is
https://shapeshifter.design. It's built with React 19, TypeScript, and Vite. Version 2.0.0 was a
port from Angular and ngrx, and some names and patterns still come from there (e.g. `*.service.ts`
classes and the ngrx-style store).

## Commands

Use Node 24 (`.nvmrc`).

- `npm start` runs the dev server with hot reloading. To run and drive the app in a browser, use
  the `run-app` skill (`.claude/skills/run-app/SKILL.md`).
- `npm run typecheck`, `npm run lint` (oxlint), and `npm run format` (Prettier).
- `npm run test:run` runs the unit tests with Vitest. `npx vitest run <file or directory>` runs some
  of them, and `-t "<name>"` runs one test. Specs named `*.browser.spec.ts` run in headless
  Chromium, for SVG DOM APIs that jsdom doesn't have. The rest run in jsdom.
- `npm run e2e` runs the Playwright end-to-end tests. Read `e2e/AGENTS.md` before running them.
- Never run `npm run deploy`. It publishes the live site.

## Before you finish

CI runs `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm run test:run`,
`npm run build`, and `npm run e2e`, in that order. Run the first four for every change, plus the
end-to-end tests that cover what you changed. Format the files you touched with
`npx prettier --write <files>`.

## Where things are

Editor code is in `src/app/modules/editor/`. Paths below are relative to it (as in `BUGS.md`),
unless they start with `src/`, `e2e/`, or `public/`.

- `src/main.tsx` creates the store and the services once, outside React, and renders
  `components/root/App.tsx`.
- `store/`: the Redux state, actions, and selectors. See `store/AGENTS.md`.
- `services/`: plain classes holding the app's commands (selecting, grouping, deleting, importing,
  exporting, playback, shortcuts, and the clipboard). `services/createEditorServices.ts` builds
  them, and components call them through `useServices()`.
- `components/`: React components, plus the imperative canvas and timeline drawing. See
  `components/AGENTS.md`.
- `model/`: layers, properties, animations, interpolators, and paths. `model/README.md` describes
  each layer type and property, and `model/paths/AGENTS.md` the path model.
- `scripts/`: everything else, e.g. import, export, svgo, auto fix, and playback rendering.
- `public/demos/`: the demo projects, listed in `scripts/demos/index.ts`.

Where to start for common changes:

- **A layer property:** `model/layers/Layer.ts`, then drawing (`components/canvas/CanvasLayers.ts`),
  export (`scripts/export/AvdSerializer.ts` and `scripts/export/SvgSerializer.ts`), and import
  (`scripts/import/SvgLoader.ts` and `scripts/import/VectorDrawableLoader.ts`). The property
  inspector finds it on its own.
- **An export format:** a serializer in `scripts/export/`, a method in
  `services/fileexport.service.ts`, and the Export menu in
  `components/layertimeline/LayerTimeline.tsx`.
- **Importing SVGs and VectorDrawables:** `services/fileimport.service.ts`, `scripts/import/`, and
  `scripts/svgo/`.
- **Morphing and action mode:** `services/actionmode.service.ts`, `model/paths/`, and
  `scripts/algorithms/AutoAwesome.ts`.
- **Playback:** `services/playback.service.ts` and `scripts/animator/AnimationRenderer.ts`.
- **The layer list and timeline:** `components/layertimeline/LayerTimelineController.ts` and
  `services/layertimeline.service.ts`.
- **Keyboard shortcuts:** `services/shortcut.service.ts`.
- **Copy and paste:** `services/clipboard.service.ts`.
- **Undo:** `store/undoredo/metareducer.ts`.
- **Error reports and analytics:** `scripts/bugsnag/` and `scripts/analytics/`. Google Analytics
  event names may only contain letters, numbers, and underscores, and a new event parameter only
  shows up in reports once it's registered as a custom dimension in Google Analytics.

## Conventions

- Match the surrounding code. Comments explain why, in full sentences.
- Non-relative imports start at `src/` (`app/...`, `environments/...`, and `test/...`).
- TypeScript is strict, and non-null assertions (`!`) are a lint error outside tests. Check the
  value and throw a descriptive error instead, like `src/main.tsx` does.
- Tests sit next to the code as `*.spec.ts`. There are no React render tests: move logic into
  plain functions or classes and unit test them, and cover the UI in `e2e/`.
- Model objects in the store are frozen in dev builds and tests, so clone them before changing
  them (see `store/AGENTS.md`).
- Layers, animations, and animation blocks have ids from `_.uniqueId()`, and blocks point at their
  layer's id. A copy needs new ids with its blocks remapped, like `regenerateModelIds` in
  `scripts/common/ModelUtil.ts` does for a whole project. Layer names must be unique too, since the
  `AnimatedVectorDrawable` export targets layers by name (`LayerUtil.getUniqueLayerName` picks
  one).
- Imported files, pasted SVGs, and old projects aren't validated up front. Property setters coerce
  or replace bad values, and new code should handle bad input without crashing.

## Code to leave alone

The paper.js beta editor hasn't been ported, so it isn't compiled, typechecked, or linted:
`components/canvas/canvaspaper.directive.ts`, `components/toolpanel/`, `scripts/paper/`,
`services/paper.service.ts`, and `src/typings/paper/`. Don't edit it unless the task is to port
it (see `IMPROVEMENTS.md`), and ignore it when looking for usages. `model/paper/` and `store/paper/`
are compiled.

## Debugging

- Dev builds expose `window.shapeshifter` (the `store` and `services`), log every action to the
  console, and skip the unsaved-changes prompts.
- `/?project=demos/playtopause.shapeshifter` opens a demo. It works with any URL the page can
  fetch.
- Bugsnag and Google Analytics only report from shapeshifter.design (`src/environments/site.ts`),
  never from local builds or forks.

## Bugs and improvements

- `BUGS.md` lists known bugs. Add the bugs you find but don't fix, and remove a bug's entry when
  you fix it (the commit says what fixed it). Don't add to "Fixed during the migration", which
  records the port from Angular.
- `IMPROVEMENTS.md` surveys possible improvements, with rough estimates.

## Commits and pull requests

- Commit subjects are short imperative sentences without a prefix or period, e.g. "Fix SVG import
  bugs". The body explains what changed and why, in prose or bullets wrapped at 100 columns.
- Branch from `origin/master` and open pull requests against it.
- `.npmrc` only installs package versions that are at least 5 days old. Don't work around it.

## Keeping these instructions current

Claude Code and Cursor both read this file at the start of every task, and the nested `AGENTS.md`
files when a task touches their directory. Skills are in `.claude/skills/`, which both read too.

- When you learn something about the repo that would have saved you time, or find something here
  that's wrong, fix the nearest `AGENTS.md` in the same change. Keep this file under 200 lines and
  put details in the nested files.
- `src/test/agentDocs.spec.ts` fails if these files name a path that doesn't exist.
- Don't add a `CLAUDE.md` anywhere in the repo. Claude Code skips `AGENTS.md` files when there's a
  `CLAUDE.md`.
