# Auto fix playground

A page that runs two versions of auto fix (`src/app/modules/editor/scripts/algorithms/AutoAwesome.ts`)
side by side on a few dozen morphs, so that you can see what a change to the algorithm does
before you commit to it.

## Running it

- `npm run playground` starts the dev server and opens the page, at `/src/playground/autofix/`.
  The first time, it also copies the baseline. If the dev server is already running, open that
  path on it instead.
- **Baseline** is a copy of `src/` from another commit, in `.playground-baseline/` (ignored by
  git). `npm run playground:baseline` copies the commit where this branch left `origin/master`,
  and `npm run playground:baseline -- <ref>` copies any other commit, e.g. `HEAD` to see only
  your uncommitted changes. The copy has its own path model too, so changes to
  `src/app/modules/editor/model/paths/` show up as well.
- **Current** is the working tree. Saving a change to the algorithm, or anything it imports,
  reloads the page and runs every scenario again.

The build doesn't include the page, and `vite.config.ts` only rewrites the copy's imports for the
dev server.

## Reading it

Each scenario shows its input, the baseline's result, and the current result, at the time on the
slider. Play (or the space bar) runs the morphs back and forth.

- **Points** are the commands' end points, colored from the start of each subpath (darkest, and
  ringed) to its end. Hover over one to see where it goes.
- **Travel lines** are the straight lines the points move along.
- **Onion skin** draws the morph at 0, ¼, ½, ¾, and 1.
- Paths that can't be morphed are drawn on top of each other instead: the start dashed, the end
  solid.

The measurements under each result are hints, not grades. A morph where the points travel less
usually looks better, but not always.

- **Time** is the median of up to seven runs, since a single run of a few milliseconds is mostly
  noise.
- **Points added** counts the commands auto fix added to each path.
- **Mean travel** and **max travel** are how far the points move, as a fraction of the size of
  the paths.
- **Smallest area** (for fills) is the smallest area at ¼, ½, or ¾ of the way through the morph,
  compared with the area expected there. A subpath that turns inside out gets close to 0.
- A result has a **problem** if auto fix threw, if the paths it returned can't be morphed, or if a
  subpath is drawn clockwise at one end and counterclockwise at the other. The playground finds
  directions with the shoelace formula, not `Path.isClockwise`.
- **Changed** means the current version returned different paths from the baseline. Filter to
  the changed scenarios, or to the ones with problems, at the top.

## Adding scenarios

Add them to `BUILT_IN_SCENARIOS` in `scenarios.ts`, or paste two paths into "Add a scenario" on
the page (those are kept in the browser's local storage). Every path morph in the demos in
`public/demos/` is a scenario too.

`geometry.ts` draws and measures the morphs. It doesn't use the editor's path model, so the
measurements don't change when the model does. `versions.ts` runs the two versions.
