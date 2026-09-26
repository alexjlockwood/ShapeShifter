# Path model bugs found by the 2026-09-25 sweep

- **Reversing a split-off piece of a command draws the wrong geometry.** Split a subpath in the
  middle of a segment, reverse one half, and split that half again: the new segments jump onto
  other parts of the original command. `reverse()` maps split times with `lerp(maxT, minT, t)`,
  which is only right for an unsliced command. Map each t to `1 - t` and flip the range instead
  (`model/paths/CommandState.ts`, `reverse`). (PATH-1, high, confirmed by a test)
- **Splitting a subpath reorders the other subpaths.** Once pairing subpaths or auto fix has
  reordered a path's subpaths, splitting one of them moves the others, so the morph silently pairs
  the wrong shapes. The new subpath's index is appended to the ordering, but the subpath is inserted
  right after the one that was split. Increment every entry above the split subpath's index, then
  insert the new index next to its entry (`model/paths/Path.ts`, `splitStrokedSubPath` and
  `splitFilledSubPath`). (PATH-2, high, confirmed by a test)
- **"Split in half" on an already split curve splits in the wrong place.** On a curve that already
  has a split point, "Split in half" and its hover preview add the point off center, sometimes on
  the neighboring segment. It passes the midpoint in t to `findTimeByDistance`, which expects a
  fraction of the arc length, so it should average the ends' arc length fractions instead
  (`model/paths/CommandState.ts`, `splitInHalfAtIndex`). (PATH-4, medium, confirmed by a test)
- **Splitting a stroked subpath at its first or last point makes an empty subpath.** In split
  subpaths mode, clicking the start or end point of a stroked subpath adds a subpath that's only a
  move, which draws nothing (auto fix grows the other path's subpath from it). `SegmentSplitter`
  should ignore those points, and `splitStrokedSubPath` should reject them with a warning
  (`components/canvas/SegmentSplitter.ts`, `model/paths/Path.ts`). (PATH-7, low, confirmed by a
  test)
- **Deleting the start point of a reversed, shifted subpath throws.** Split a segment of a closed
  subpath, make the new point the first point, reverse the subpath, and delete the point: it
  throws from the keydown handler and nothing changes. For a reversed subpath the removed index is
  `splitIdx - 1`, but the shift is still computed from `splitIdx` (`model/paths/Path.ts`,
  `unsplitCommand`). (PATH-8, low, confirmed by a test)
- **`CommandState.getPathLength` ignores `minT` and `maxT`.** A split piece of a command reports
  the length of the whole command. Trim paths use it, so a trimmed stroke on a morph with a split
  subpath gets the wrong dashes at the start and end of the block, in the preview and in SVG and
  spritesheet exports. Measure `calculator.split(minT, maxT)` instead
  (`model/paths/CommandState.ts`, `getPathLength`). (PATH-10, low, confirmed by a test)
- **`PathState.getPathLength` and `getPointAtLength` only see the tree roots.** Once a subpath is
  split, both give wrong answers, and `getPointAtLength` also ignores reversal and shifting. Only
  `model/paths/Path.spec.ts` and the uncompiled paper.js beta call them. Iterate the visible
  subpaths instead of the roots (`model/paths/PathState.ts`). (PATH-11, low, confirmed by a test)
- **`deleteStrokedSubPath` throws when the sibling was split again (latent).** Split a stroked
  subpath, split one half again, and delete the other half: `buildOrderedCommands` throws. It's
  unreachable while split subpaths can't be deleted (see "Open"). Remove the ordering entries of
  every leaf under the parent, as `calculateDeletedSubIdxs` does (`model/paths/Path.ts`,
  `deleteStrokedSubPath`). (PATH-12, low, confirmed by a test)
- **Arcs with zero or negative radii are misparsed.** An arc with a zero radius is dropped instead
  of drawn as a line, and a negative radius bulges the wrong way, so typed or pasted path data,
  VectorDrawables, and `.shapeshifter` files lose segments. Android's parser does the same, so
  only SVG exports differ from browsers. Use the radii's absolute values, and draw a line when
  either is 0 (`model/paths/PathParser.ts`, `drawArc`). (PATH-13, low, confirmed by a test)
- **Tabs, newlines, and `+` aren't treated as number separators.** Path data like `L 10\n10`, typed
  into the property panel or in a hand-edited file, parses to `NaN` coordinates, and `5+5` loses
  its second number. Treat all SVG whitespace as separators, and `+` too when it doesn't follow an
  `e` (`model/paths/PathParser.ts`, `extract`). (PATH-14, low, confirmed by a test)
- **A path with no subpaths crashes `autoAddCollapsingSubPaths`.** Path data with no leading `M`
  (typed into a morph block, or from `Path('L 10 10')`) has 0 subpaths, and reading the last
  command throws "reading 'end'" (`scripts/algorithms/AutoAwesome.ts`, `model/paths/Path.ts`).
  (PATH-15, confirmed by a test; a candidate fix exists on the unmerged
  `alex/fix-sweep-quick-wins` branch, needs a rebase before reuse)
- **Degenerate "spike" curves are treated as zero-length lines.** A curve that starts and ends at
  the same point but has other control points, like `M 0 0 C 10 10 10 10 0 0`, is treated as a
  point: the bounding box misses it, "Split in half" collapses it, and auto convert can flatten it.
  Only treat a curve as a point when all of its points coincide
  (`model/paths/calculators/Calculator.ts`, `newCalculator`, and `model/paths/Command.ts`,
  `canConvertTo`). (PATH-16, low, confirmed by a test)
- **Filled subpaths without a closing `Z` can't be clicked by their fill.** Fills close
  implicitly, but the shape hit test skips subpaths that aren't closed, so a click inside the fill
  misses the layer. Each subpath is also tested alone with the even-odd rule, ignoring the fill
  type and holes. Treat filled subpaths as closed and test the whole path with its fill rule
  (`model/paths/PathState.ts`, `hitTest`). (PATH-17, low, confirmed by reading)
- **`model/paths/SvgUtil.ts` is dead code.** Nothing imports it or `arcToBeziers`, including the
  uncompiled paper.js editor; `PathParser` converts arcs itself. (PATH-18, confirmed by reading; a
  candidate fix exists on the unmerged `alex/fix-sweep-quick-wins` branch, which deletes the file,
  needs a rebase before reuse)
- **Auto fix picks which subpaths grow from a point before it pairs them.** When one path has
  fewer subpaths, `autoAddCollapsingSubPaths` gives the other path's last subpaths collapsing
  partners by index, and only then does `orderSubPaths` pair them up. So a subpath can fly across
  the icon while a copy of it grows where it started: `autoFix` on the square
  `M 0 0 L 4 0 L 4 4 L 0 4 Z` and a target with a far square followed by that same square moves the
  square to the far one and grows a new one in its place. Pair the subpaths first, then add
  collapsing subpaths for the ones left over (`scripts/algorithms/AutoAwesome.ts`). (found after
  the sweep, medium, confirmed by a test)
- **Auto fix's alignment depends on the size of the paths.** `alignSubPath` scores a pair of
  commands `1 / max(1, distance)`, so when the points are less than a unit apart every pair scores
  the same and the alignment is arbitrary. A square and a heptagon shrunk 20 times get all three new
  points on one edge of the square, where at full size they get one per edge. Divide distances by
  the size of the paths instead of clamping them at 1 (`scripts/algorithms/AutoAwesome.ts`,
  `alignSubPath`). (found after the sweep, low, confirmed by a test)
