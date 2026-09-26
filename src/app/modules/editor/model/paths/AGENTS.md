# Path model

Paths are relative to `src/app/modules/editor/`. The layer and animation model is described in
`model/README.md`.

This is the code behind path morphing, and the most bug-prone part of the app, especially the
splitting, deleting, and index mapping in `model/paths/Path.ts`. Read the tests before changing it.

## How it fits together

- `Path` is an immutable facade over a `PathState`, which holds a tree of `SubPathState`s (split
  subpaths are children of the subpath they came from). Each holds `CommandState`s, and each of
  those wraps one command from the parsed path string plus the edits made to it (split points, a
  conversion, a transform), which it builds into the commands that are drawn.
- `getSubPaths()` and `getCommands()` return what's drawn: the leaves of the tree, reversed,
  shifted, and ordered.
- `model/paths/PathParser.ts` parses path strings into absolute `M`, `L`, `Q`, `C`, and `Z`
  commands (it converts arcs, `H` and `V`, and `S` and `T`), and writes strings rounded to 3
  decimals.
- `model/paths/calculators/` does the geometry for each command: length, projection, splitting,
  bounding boxes, and conversion. `newCalculator` picks the calculator, and `Command.canConvertTo`
  decides which conversions are allowed (e.g. `L` to `Q` or `C`, and `Q` to `C`).

## Editing

- Every edit goes through `path.mutate()...build()`, which returns a new `Path`. Don't keep using
  a mutator after calling `build()`, since the new path shares its arrays.
- `path.clone()` goes through the path string, so it loses the edits and precision (3 decimals)
  and assigns new ids. `mutate().build()` keeps them.
- `services/actionmode.service.ts` and the helpers in `components/canvas/` (splitting, selecting,
  and hover previews) call the mutators. After each edit in action mode, `autoAddCollapsingSubPaths`
  and `autoConvert` run against the other path, so the two stay morphable.
- Two paths are morphable (`isMorphableWith`) when their commands match type for type.
- Auto fix (`scripts/algorithms/AutoAwesome.ts`) lines up the commands of two paths with the
  Needleman-Wunsch algorithm (`scripts/algorithms/NeedlemanWunsch.ts`), trying every reversal and
  shift of each subpath.

## Terms

- A **split point** is a point added inside a command. Only split points can be unsplit or deleted.
- **Splitting a subpath** gives it children. For a filled subpath, it also adds a pair of `L`
  "split segments" that share a `splitSegmentId`.
- `isUnsplittable()` is true for subpaths that came from a split. `isSplit()` is always false,
  since only the leaves are visible (see `BUGS.md`).
- **Collapsing subpaths** are added so that both paths have the same number of subpaths. They
  collapse to a point and always come last.
- **Reversing** and **shifting** are flags on a subpath, applied when it's built. Only closed
  subpaths can be shifted.

## Invariants and known problems

- The first command of the first subpath is an `M` without a start point (`points[0]` is
  `undefined`). Code that reverses, reorders, or interpolates commands has to keep it that way.
- Compact arc flags (`a10 10 0 100 20`) are misparsed (see `BUGS.md`).
- In dev builds and tests, the `Path` constructor also warns about duplicate command ids.
- Playback interpolates a whole new `Path` on every frame (`model/paths/PathUtil.ts`), so keep
  construction cheap.

## Tests

`model/paths/Path.spec.ts` has tables of mutation tests (`makeTest(path, ops, expected)`), plus
TODOs for combinations of edits that aren't covered yet. `fromPathOpString` in `src/test/PathUtil.ts`
applies edits written as ops, e.g. `RV 0` reverses subpath 0 and `SIH 0 1` splits command 1 of
subpath 0 in half (the file lists the rest):

```ts
import { Path } from 'app/modules/editor/model/paths';
import { fromPathOpString } from 'test/PathUtil';

it('reverses and then splits in half', () => {
  const path = fromPathOpString('M 0 0 L 10 10 L 20 20', 'RV 0 SIH 0 1');
  expect(path.getPathString()).toBe(new Path('M 20 20 L 15 15 L 10 10 L 0 0').getPathString());
});
```

Run them with `npx vitest run src/app/modules/editor/model/paths`.
