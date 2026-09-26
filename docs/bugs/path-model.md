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
- **`isClockwise` can't tell the direction of line segments, so auto fix twists polygons.** A
  square and its reversal are both reported as clockwise, so auto fix reverses polygons it
  shouldn't (or misses ones it should), and they turn inside out during the morph. Most icons are
  made of lines. For `L` and `Z`, `getArea` uses a term that doesn't change sign when the segment
  is reversed, and should use the shoelace term (`model/paths/PathState.ts`, `getArea`). (PATH-5,
  medium, confirmed by a test)
- **Auto fix reverses open subpaths.** Auto fix can reverse an open line or arc, so the stroke
  flips end over end during the morph. `permuteSubPath` compares orientation even for open
  subpaths, where `alignSubPath` has already chosen the direction, and should only compare it when
  both are closed (`scripts/algorithms/AutoAwesome.ts`). (PATH-6, medium, confirmed by a test)
- **Splitting a stroked subpath at its first or last point makes a degenerate subpath that later
  crashes.** In split subpaths mode, clicking the start or end point of a stroked subpath adds an
  empty subpath, and auto fix or the next action mode edit then throws. `SegmentSplitter` should
  ignore those points, and `splitStrokedSubPath` should reject them with a warning
  (`components/canvas/SegmentSplitter.ts`, `model/paths/Path.ts`). (PATH-7, medium, confirmed by a
  test)
- **Deleting the start point of a reversed, shifted subpath throws.** Split a segment of a closed
  subpath, make the new point the first point, reverse the subpath, and delete the point: it
  throws from the keydown handler and nothing changes. For a reversed subpath the removed index is
  `splitIdx - 1`, but the shift is still computed from `splitIdx` (`model/paths/Path.ts`,
  `unsplitCommand`). (PATH-8, low, confirmed by a test)
- **Auto fix throws on subpaths with a single command.** Aligning or permuting a lone `M` subpath
  against a longer one throws "Error retrieving command mutation", reachable from a path like
  `M 5 5` or the degenerate subpaths in PATH-7 (`scripts/algorithms/AutoAwesome.ts`,
  `alignSubPath`). (PATH-9, confirmed by a test; a candidate fix exists on the unmerged
  `alex/fix-sweep-quick-wins` branch, which skips these subpaths instead of throwing, so auto fix
  no longer crashes but the result can still be unmorphable; needs a rebase before reuse)
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
- **Reversing or shifting the first subpath drops a trailing lone `M`.** A path that ends with a
  subpath that's only an `M` loses it when the subpath before it is reversed or shifted, since
  that subpath is rebuilt ending in an `L` instead of a `Z`. Auto fix's `orderSubPaths` moves lone
  `M`s to the end, so `autoFix` on `M 5 5 M 0 0 L 10 0 L 10 10 Z` and a two-subpath target throws
  "Subpath index out of bounds". Parsing drops it too: `M 0 0 L 10 0 M 5 5` has one subpath.
  `createSubPaths` ends an open subpath at the next `M` but doesn't start the next subpath with it,
  and should (`model/paths/SubPath.ts`, `createSubPaths`, and `scripts/algorithms/AutoAwesome.ts`,
  `alignSubPath`). (found after the sweep, low, confirmed by a test)
