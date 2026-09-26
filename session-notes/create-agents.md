# Session notes: create-agents

Flotilla agent `create-agents`, worktree `.flotilla/slots/2`, branch `alex/agent-setup`, PR
[#366](https://github.com/alexjlockwood/ShapeShifter/pull/366). Written 2026-09-26 so a fresh
session tomorrow can pick up where this one left off without re-deriving any of it. This file is
a snapshot: PR commit counts, CI results, and agent states are as of the time this was written,
and will be stale by the time it's read. Re-check them before acting on them.

Three sibling agents were also running in parallel (`fix-split-filled-subpath`, `list-sweep-bugs`,
`sweep-quick-wins`), each in its own Flotilla worktree and PR. Each is expected to write its own
session notes file; this one covers only what the `create-agents` session itself did and found,
plus what it knows about the other three from reviewing their PRs.

## What this session did, in order

1. Set up `AGENTS.md` (root + nested in `e2e/`, `components/`, `store/`, `model/paths/`), a
   `run-app` skill, and `.claude/settings.json`, so Claude Code and Cursor sessions stop
   re-deriving the repo's architecture from scratch. Along the way: formatted 44 drifted files
   with Prettier and added `format:check` to CI, added `min-release-age=5` to `.npmrc`, fixed
   stale links in `model/README.md`. All of this is PR #366.
2. Ran `/code-review` on #366. Got 15 findings. Fixed 14 of them directly (7 more commits on
   #366).
3. Spawned two parallel general-purpose agents to sweep the whole codebase for bugs (independent
   of the review; the user asked for this separately). They found **100 issues: 3 high, 31
   medium, 66 low**. Full report inlined below as an appendix.
4. Investigated one bug by hand first (`PATH-3`, a suspected typo), confirmed and fixed it with a
   verified commit, then handed it to a new agent (`fix-split-filled-subpath`, PR #368) to push
   and open as a PR.
5. Split the 100 bugs into: 21 "tier 1" bugs (test-confirmed, one or two line fixes, low risk of
   breaking anything else) bundled into one PR by a new agent (`sweep-quick-wins`, PR #370); the
   other 78 (everything except tier 1 and PATH-3) listed in `BUGS.md` by another new agent
   (`list-sweep-bugs`, PR #369) for later triage, not fixed.
6. Ran `/code-review` again, this time on #366 (post-fixes) and #368 together. Found more
   issues, detailed below. Not yet acted on except for routing two bugs the `sweep-quick-wins`
   agent found in its own code review to the right places.
7. User asked to pause and have every parallel session write up its findings as a markdown file
   instead of continuing to iterate, so that a fresh session tomorrow can read all of them and
   decide what to do next. This file is that write-up for the `create-agents` session.

## PR #366: Add instructions for coding agents

Status as of writing: **open, CI passing**.

11 commits. The first 4 are the original work (formatting, CI check, `.npmrc`, the AGENTS.md/skill
setup). The next 7 are round-1 review fixes:

- Ignore `.claude/worktrees/`, `.flotilla/`, and `.claude/settings.local.json` in git, so `git add
-A` in the main checkout can't pick up other sessions' worktrees.
- Exclude the paper.js beta code (already excluded from tsc and oxlint) from the Prettier check.
- Move `format:check`, `typecheck`, and `lint` before the Playwright browser install in CI, so they
  fail fast.
- Broaden the deploy-script deny rules in `.claude/settings.json` to match more command forms.
- Fix several factual mistakes in the AGENTS.md files (which undo actions are excluded, that the
  `paper` store slice is written by compiled code when `environment.beta` is true, why panels stop
  click propagation, where `useServices`/`useEditorStore` live, that `BUGS.md` has no "Fixed"
  section to move things to).
- Make `agentDocs.spec.ts` (the spec that checks AGENTS.md files don't reference dead paths) also
  fail if a `CLAUDE.md` is added anywhere, and fix it to always check directory names ending in
  `/` (it previously could miss a deleted directory).
- Remove `.git-blame-ignore-revs` for now, since its SHA only survives a merge commit; a follow-up
  will add it back once the formatting commit's final SHA on `master` is known (tracked in a
  memory file, see below).

### Round 2 review findings on #366 (not yet fixed)

A second review pass (see below) found more issues, all still open:

- `store/AGENTS.md` still cites a `BUGS.md` "known bug" for undo/hidden-layer interaction that
  doesn't exist as its own entry.
- The `run-app` skill and `e2e/AGENTS.md` say shortcuts are ignored while a text field has focus,
  which isn't fully true (some modifier shortcuts fire first) until `STORE-6` (in #370) lands.
- `.claude/settings.json`'s deploy deny rules can still be bypassed with npm aliases/flags, e.g.
  `npm run -s deploy`, `npm rum deploy` (typo), `npm --prefix . run deploy`.
- `.npmrc`'s `min-release-age=5` is silently ignored by the npm that ships with Node 22, which
  `engines` and the README still allow, so a Node-22 contributor could lock a version too young
  for CI's Node 24 npm to install.
- The `run-app` skill's sample script hardcodes port 5173, right after telling agents not to
  assume that port.
- `e2e/AGENTS.md` documents a workaround (check `lsof` before running e2e) for a root problem
  (fixed ports 4280/4281, shared across every worktree) instead of fixing the root problem
  (per-worktree ports in `playwright.config.ts`).
- `agentDocs.spec.ts` walks the working tree, not tracked files, so an untracked personal
  `CLAUDE.local.md` fails `npm run test:run` locally for whoever has one.
- `agentDocs.spec.ts`'s path-reference detection has gaps: it skips any code span containing
  spaces (so commands like `npx playwright test e2e/foo.spec.ts` are never checked), doesn't
  recognize `.shapeshifter` as a file extension, and fails on spans starting with `/?` (so
  `/?project=demos/playtopause.shapeshifter` is never checked). Also, a path passes if it exists
  under any of 4 candidate bases, which is looser than it should be, and Markdown links aren't
  resolved the way GitHub/Cursor actually resolve them (relative to the doc).
- `agentDocs.spec.ts` fails any doc that happens to reference zero paths, which is too strict for
  a hypothetical prose-only skill.
- The new wildcard deny rules (`*deploy-stable.sh*`, `*gh-pages*`) also block harmless read-only
  commands that merely mention those strings, e.g. `cat scripts/deploy-stable.sh` or `git log
origin/gh-pages`. Worth documenting as a known tradeoff, or narrowing.
- CI runs `npm run typecheck` and then `npm run build` (which is `npm run typecheck && vite
build`), so it typechecks twice; the e2e preview server then runs its own `vite build` too, so
  it builds twice more than necessary.
- The formatting commit (first commit on this branch) reformatted about a dozen paper.js beta
  files that a later commit in the same branch then excludes from Prettier. Ideally the formatting
  commit itself would never have touched them; fixing this needs rewriting that commit (and thus a
  force push), which wasn't done pending user approval.
- The paper.js "leave alone" path list is now duplicated across 5 places (`tsconfig.json`,
  `.oxlintrc.json`, `.prettierignore`, and two `AGENTS.md` files) with nothing checking they agree.

None of these are large; all were left for a coordinated pass rather than fixed ad hoc mid-review.

## The bug sweep

Two general-purpose agents independently swept the whole compiled codebase (excluding the
uncompiled paper.js beta editor) for bugs, each splitting the work into areas and reproducing what
they could with throwaway Vitest/Playwright specs (all deleted afterward; no source was changed).
The second, more thorough pass is authoritative: **100 issues total: 3 high, 31 medium, 66 low.**
85 were confirmed with a test, 14 by reading the code carefully, 1 is only plausible. No security
issues were found (checked for `innerHTML`/`dangerouslySetInnerHTML` reachable from user input, and
`?project=` URL handling).

Top 5 by severity/impact:

1. **IMP-1** (high): svgo deletes a `<use>` inside `<clipPath>`, so Illustrator's classic clipping
   mask export pattern imports as fully invisible artwork.
2. **PATH-1** (high): reversing a split-off piece of a path command, then splitting it again,
   draws the wrong geometry.
3. **PATH-2** (high): splitting a subpath reorders the other subpaths after pairing or auto-fix,
   so the morph silently pairs the wrong shapes.
4. **CANVAS-1** (medium, affects every layer with both a fill and a stroke): the canvas draws the
   stroke before the fill, so strokes render at half the width Android would draw them at.
5. **STORE-2** (medium, affects almost every drag and typing burst): the first action after the
   undo-grouping window expires becomes its own step, so most drags/edits need two undos to fully
   revert.

The full report, with every finding's location, trigger, impact, and suggested fix, is appended
verbatim at the end of this file.

### What happened to the 100

- **PATH-3** (medium): investigated by hand before the sweep even finished (it matched a bug
  suspected from reading `Path.ts` earlier). Confirmed real and bigger than the original typo
  suspicion: splitting a filled subpath between two points on the _same_ command was fully broken,
  and is also the reproducible cause of the long-standing "Deleting a split segment can find it
  without a parent command" bug in `BUGS.md`. Fixed and verified (6 new tests fail without the
  fix, pass with it; full unit suite, typecheck, lint all pass). Pushed to PR #368 by the
  `fix-split-filled-subpath` agent.
- **21 "tier 1" bugs**: chosen because each was test-confirmed, had a fix of a line or two in one
  isolated spot, and looked unlikely to interact with the others. Bundled into PR #370 by the
  `sweep-quick-wins` agent, one commit per fix with its failing test. List: CANVAS-1, STORE-4,
  STORE-8, STORE-9 (one commit), STORE-6, UI-5, UI-3 + UI-12 (one commit), EXP-2, EXP-3, EXP-4,
  IMP-7, IMP-10, PATH-9, PATH-15, CANVAS-8, CANVAS-9, CANVAS-10, UI-15, PATH-18 (deleted dead
  code), EXP-6. (EXP-3's fix was later extended, see below.)
- **The other 78** (everything not in tier 1 and not PATH-3): listed in a new `BUGS.md` section
  by the `list-sweep-bugs` agent, grouped by area, sorted by severity, in PR #369. Not fixed, just
  recorded for later triage.
- **2 more bugs**, found by the `sweep-quick-wins` agent while working on its own PR (not part of
  the original 100):
  1. While fixing PATH-9: reversing or shifting subpath 0 can drop a trailing single-command
     subpath (e.g. a lone `M x y` after other subpaths), because re-parsing a path string silently
     drops a trailing lone `M`. Throws "Subpath index out of bounds" in `AutoAwesome.autoFix`.
     Routed to `list-sweep-bugs` to add to `BUGS.md` (area: path model, low, confirmed by a test).
  2. While reviewing its own branch: SVG export's clip path ids (`clip_<name>`) can collide with a
     layer's own element id (a clipped layer named `path` and a layer named `clip_path` both get
     `id="clip_path"`). This is the same class of bug as **EXP-3** (which was already in tier 1,
     fixing clip-path-to-clip-path id collisions with a hyphen separator), so instead of a new
     `BUGS.md` entry, it was folded into EXP-3's fix: use `clip-` instead of `clip_` as the prefix,
     since layer names can't contain hyphens, so no clip path id can ever equal a layer id either.
     Pushed as its own commit on top of #370, `d6929774`, "Keep clip path ids in SVG exports from
     matching layer ids" (no force push needed; it was originally folded into the EXP-3 commit,
     which would have needed one, so it was redone as a separate commit instead).

## PR #368: Fix splitting a filled subpath between two points on one command

Status: **open**.

This is the PATH-3 fix. A thorough adversarial review (fuzzer-based, 20,000 random split/delete
sequences checking that total signed area is conserved) found that **the fix itself has a real,
reachable bug** in code it touches:

- **Confirmed by test**: in `deleteFilledSubPathSegmentInternal`, one branch pushes `cs` but then
  resumes the search loop one index too late, silently dropping the rest of a curve. Concretely:
  split a filled subpath at two points on the same curve, then delete the first split line, and a
  quarter of the shape vanishes. The reviewer verified a one-line fix (also push `splitCss1[i]` in
  that branch) against the fuzzer with zero failures and all 182 existing path tests still green.
- **Plausible, not independently verified**: two more merge-logic bugs in the same function found
  by the fuzzer (wrong parent selection when a second split ends where the first started; the
  subpath's shift offset not being adjusted when both split points in one command are removed).
- The PR removes the `BUGS.md` entry for the "parentless split segment" crash as if fully fixed,
  but the reviewer found an input sequence that still reaches that code path. The entry should
  stay (updated with what's now understood about the cause), not disappear.
- `IMPROVEMENTS.md` cites line numbers in `Path.spec.ts` that the PR's new tests shifted by 32
  lines, and cites the bug that this PR is removing from `BUGS.md`.
- Simplification: after a defensive `if (!cs) cs = newCss.pop()` was added, two `if (cs)` checks
  right after it can never be false anymore and should be removed or the type narrowed.
- Test coverage gap: the new tests only exercise deleting through the _first_ split path's
  segment; deleting through the second, or on a reversed/shifted subpath, isn't covered, and the
  data-loss repro above would have caught it if it had been.
- Design observation (not a specific bug): the merge-after-delete logic is a chain of
  position-based special cases, and each new split shape needs another one. A general rule (join
  the three relevant ranges, then merge neighbors sharing a backing id) would likely subsume all
  of the above findings at once, rather than patching each case as it's found.

Not yet forwarded to the `fix-split-filled-subpath` agent as of this writing.

## PR #369: List the bugs found by the bug sweep

Status: **open**. A **docs-only change** (`BUGS.md` only). Not reviewed in detail (low risk), but
its own description says its internal review caught a few cases where the sweep's suggested fix
direction would have been wrong if followed literally (e.g. one would have duplicated ordering
entries, another wouldn't actually run because of how redux-undo skips reducers on undo) and
corrected the prose against the code before listing them. Final count: 80 entries (78 from the
original sweep, plus the 2 found afterward), grouped by area, sorted by severity, in a new "Found by
the bug sweep" section after "Open".

## PR #370: Fix 21 small bugs found by the bug sweep

Status: **open**. 24 commits, one per bug (some bugs share a commit where they're in the same
function), plus the clip-id follow-up commit. Not yet given a full adversarial code review pass
(only #366 and #368 got one in the second round); worth doing before merging, given that #368's
similarly-scoped "small, tested" fix still had a real bug in it.

## Cross-cutting facts and gotchas discovered this session

- **Flotilla mechanics**: `git worktree add` is blocked inside a Flotilla agent (each agent owns
  exactly one worktree/branch). To start work on a different branch/PR, use `flotilla new <name>
--worktree new --no-open --prompt "..."` from a session that isn't itself inside a worktree-add
  restriction. `--branch` only accepts a branch that already exists on `origin`; for a brand new
  branch, omit it and have the agent's prompt do `git reset --keep origin/master` then `git branch
-m <name>`.
- **New Flotilla worktrees don't inherit `.claude/settings.local.json`**, so each new slot needs
  the `claudeMdExcludes` entry for the main checkout's stale `AGENTS.md` added by hand (or the
  session will double-load instructions, once from its own branch and once from the parent
  checkout).
- **The e2e ports (4280/4281) are shared across every worktree**, and Playwright reuses whatever
  is already listening on them rather than erroring, so two agents running `npm run e2e`
  concurrently can silently test each other's code. Every parallel-agent prompt this session
  included a shared lock file (`/tmp/shapeshifter-e2e.lock`) as a workaround; the real fix is
  per-worktree ports (see the #366 round-2 finding above).
- **Permission classifier blocked a force push** to a PR branch (`sweep-quick-wins` tried to fold
  a fix into an already-pushed commit). Worked around by resetting the local branch back to the
  pushed tip and re-committing the change as a new commit on top instead. No force push happened
  this session.
- **Possible Safari bug, unverified**: `shortcut.service.ts` ignores keys whose target is inside
  `.MuiModal-root`. MUI menus stay mounted (with `aria-hidden="true"`) until their close transition
  ends, and Safari leaves the focus inside them, so keyboard shortcuts may do nothing until a
  closing menu finishes animating out. A possible fix is to skip closing modals, e.g.
  `closest('.MuiModal-root:not([aria-hidden="true"])')`.
- Four memory files were written to the user's persistent memory during this session (indexed in
  `MEMORY.md`), covering: Flotilla worktree slot setup and the `AGENTS.md` exclude, a false
  negative when testing `AGENTS.md` autoloading headlessly (`--setting-sources project,local`
  disables it), how to start parallel work under Flotilla, and a reminder to add
  `.git-blame-ignore-revs` back once #366's formatting commit lands on `master` with a final SHA.

## Open questions for tomorrow's session (nobody has answered these yet)

1. Should the round-2 review findings on #366 be fixed before merging it, or is it acceptable to
   merge now and follow up? (Nothing here is a functional bug; it's all docs/config accuracy and
   robustness.)
2. Should #368's review findings be acted on by its agent? (Recommended: yes for its confirmed
   data-loss bug at minimum, before merging it.)
3. Should the minimum supported Node version be raised to 24 (matching `.nvmrc`) to close the
   `min-release-age` loophole on Node 22, or just documented as a known gap?
4. Is a force push to #366 acceptable, to rewrite the formatting commit so it never touches the
   paper.js files in the first place? (Currently worked around by excluding those files from the
   Prettier _check_ instead, which is functionally fine but leaves one-time blame churn on them.)
5. Should PR #370 get a full adversarial review pass before merging, given what that kind of
   review found in the similarly-scoped #368?
6. What order should these 4 PRs merge in, given the dependencies? (#366 has no code dependency on
   the others; #368 and #370 both touch `model/paths/Path.ts`'s neighborhood and might be easier to
   review/merge sequentially rather than in parallel now that both have been shown to have real
   bugs.)

---

# Appendix: full bug sweep report (100 issues)

The following is the complete, unedited output of the bug sweep described above.

# Shape Shifter bug sweep

- **Commit:** `744d62e8` ("Add instructions for coding agents", the tip of `alex/agent-setup`). All line numbers are against this commit. The sweep worktree was created at `15586e7f`, which predates the Prettier reformat and the `AGENTS.md` files, so it was moved to `744d62e8` to match the branch in use.
- **Scope:** all compiled code under `src/` and `e2e/`, plus `vite.config.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`, and `public/`. The paper.js beta editor (`components/canvas/canvaspaper.directive.ts`, `components/toolpanel/`, `scripts/paper/`, `services/paper.service.ts`, `src/typings/paper/`) was skipped.
- **Paths:** editor paths are relative to `src/app/modules/editor/`, as in `BUGS.md`, unless they start with `src/`, `e2e/`, `public/`, or `.github/`, or are top-level config files.
- **Known bugs:** nothing in `BUGS.md` is re-reported. Where a finding is related to a known bug, it says so.
- **Method:** the code was split into seven areas and read in full. Findings marked "confirmed by a test" were reproduced with throwaway Vitest specs (jsdom, or headless Chromium for SVG DOM APIs), and a few UI findings with Playwright against a dev server. The path model also got a seeded fuzz of about 3,000 random edit sequences, and the parser was compared against Chromium's `SVGPathElement`. The three high-severity findings were reproduced a second time independently. All throwaway specs have been deleted, and no source files were changed.

## Verdicts on the suspected bugs

| Suspected                                                                         | Verdict                                                                                                   | Entry   |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------- |
| `Path.ts`, `splitFilledSubPath` compares `s.splitIdx > e.csIdx`                   | Real typo (should be `e.splitIdx`), and the same-command case it guards is broken regardless of the order | PATH-3  |
| `PathState.ts`, `getPathLength` and `getPointAtLength` loop over top-level states | Real, but only `Path.spec.ts` calls them                                                                  | PATH-11 |
| `CommandState.ts`, `getPathLength` and `getBoundingBox` ignore `minT` and `maxT`  | Real for length, which reaches trim path rendering and export. The bounding box has no visible effect.    | PATH-10 |
| `SvgUtil.ts` has no callers                                                       | Confirmed dead code                                                                                       | PATH-18 |

## Summary

100 issues: 3 high, 31 medium, and 66 low. 85 are confirmed by a test, 14 by reading, and 1 is plausible.

| ID        | Title                                                                                                | Area                  | Severity | Confidence           |
| --------- | ---------------------------------------------------------------------------------------------------- | --------------------- | -------- | -------------------- |
| PATH-1    | Reversing a split-off piece of a command draws the wrong geometry                                    | Path model            | high     | confirmed by a test  |
| PATH-2    | Splitting a subpath reorders the other subpaths                                                      | Path model            | high     | confirmed by a test  |
| PATH-3    | `splitFilledSubPath` mishandles two split points on the same command                                 | Path model            | medium   | confirmed by a test  |
| PATH-4    | "Split in half" on an already split curve splits in the wrong place                                  | Path model            | medium   | confirmed by a test  |
| PATH-5    | `isClockwise` can't tell the direction of line segments, so auto fix twists polygons                 | Path model            | medium   | confirmed by a test  |
| PATH-6    | Auto fix reverses open subpaths                                                                      | Path model            | medium   | confirmed by a test  |
| PATH-7    | Splitting a stroked subpath at its first or last point makes a degenerate subpath that later crashes | Path model, canvas    | medium   | confirmed by a test  |
| PATH-8    | Deleting the start point of a reversed, shifted subpath throws                                       | Path model            | low      | confirmed by a test  |
| PATH-9    | Auto fix throws on single-command subpaths                                                           | Path model            | low      | confirmed by a test  |
| PATH-10   | `CommandState.getPathLength` ignores `minT` and `maxT`                                               | Path model            | low      | confirmed by a test  |
| PATH-11   | `PathState.getPathLength` and `getPointAtLength` only see the tree roots                             | Path model            | low      | confirmed by a test  |
| PATH-12   | `deleteStrokedSubPath` throws when the sibling was split again (latent)                              | Path model            | low      | confirmed by a test  |
| PATH-13   | Arcs with zero or negative radii are misparsed                                                       | Path model            | low      | confirmed by a test  |
| PATH-14   | Tabs, newlines, and `+` aren't treated as number separators                                          | Path model            | low      | confirmed by a test  |
| PATH-15   | A path with no subpaths crashes `autoAddCollapsingSubPaths`                                          | Path model            | low      | confirmed by a test  |
| PATH-16   | Degenerate "spike" curves are treated as zero-length lines                                           | Path model            | low      | confirmed by a test  |
| PATH-17   | Filled subpaths without a closing `Z` can't be clicked by their fill                                 | Path model            | low      | confirmed by reading |
| PATH-18   | `SvgUtil.ts` is dead code                                                                            | Path model            | low      | confirmed by reading |
| STORE-1   | Undo and redo overwrite playback and action mode state                                               | Store and services    | medium   | confirmed by a test  |
| STORE-2   | The first action of a burst becomes its own undo step                                                | Store and services    | medium   | confirmed by a test  |
| STORE-3   | Cut in action mode deletes the block being edited, then every edit throws                            | Store and services    | medium   | confirmed by a test  |
| STORE-4   | Resuming playback in slow motion jumps to a fifth of the current time                                | Store and services    | medium   | confirmed by a test  |
| STORE-5   | Ungroup drops the group's transform and leaves its blocks and hidden state behind                    | Store and services    | medium   | confirmed by a test  |
| STORE-6   | Cmd+Z and Cmd+G fire inside focused text fields                                                      | Store and services    | medium   | confirmed by a test  |
| STORE-7   | Clipboard handlers ignore open menus and dialogs, and block native copy                              | Store and services    | low      | confirmed by a test  |
| STORE-8   | Repeat restarts from where playback was resumed, not from 0                                          | Store and services    | low      | confirmed by a test  |
| STORE-9   | Play with the current time past the end only jumps to the end                                        | Store and services    | low      | confirmed by a test  |
| STORE-10  | Pasting JSON with a malformed `blocks` field throws                                                  | Store and services    | low      | confirmed by a test  |
| STORE-11  | Pairing subpaths gets the paired set and the selection wrong                                         | Store and services    | low      | confirmed by a test  |
| STORE-12  | No-op commands record empty undo steps                                                               | Store and services    | low      | confirmed by a test  |
| STORE-13  | Undoing the first edit after loading a project resets the timeline zoom                              | Store and services    | low      | confirmed by a test  |
| STORE-14  | Flattening a group doesn't scale stroke width blocks                                                 | Store and services    | low      | confirmed by reading |
| STORE-15  | Converting to or from a clip path, and importing into an empty workspace, lose per-layer state       | Store and services    | low      | confirmed by reading |
| STORE-16  | A zero-length path block shows its from path on the end canvas                                       | Store and services    | low      | confirmed by a test  |
| STORE-17  | `createDeepEqualSelector` deep-compares inputs, not results                                          | Store and services    | low      | confirmed by a test  |
| MODEL-1   | Flattening a group mis-decomposes mirrored or rotated nested groups                                  | Layers and properties | medium   | confirmed by a test  |
| MODEL-2   | Merging viewports of different sizes misplaces the content                                           | Layers and properties | medium   | confirmed by a test  |
| MODEL-3   | Importing a larger SVG into an animated project breaks the existing animation                        | Layers and properties | medium   | confirmed by a test  |
| MODEL-4   | Before a delayed block starts, the preview shows the static value, unlike Android 7.1+               | Layers and properties | medium   | confirmed by reading |
| MODEL-5   | Invalid and partial colors become black, and garbage hex is accepted                                 | Layers and properties | low      | confirmed by a test  |
| MODEL-6   | Color interpolation doesn't use Android's linear color space                                         | Layers and properties | low      | confirmed by a test  |
| MODEL-7   | An end time of 0 turns into 100, and inverted times flip on the next clone                           | Layers and properties | low      | confirmed by a test  |
| MODEL-8   | Overshooting fraction animations are clamped in the preview but wrap on Android                      | Layers and properties | low      | confirmed by reading |
| MODEL-9   | The selection box of rotated or mirrored groups is wrong                                             | Layers and properties | low      | confirmed by a test  |
| MODEL-10  | Decimal commas are silently truncated in number fields                                               | Layers and properties | low      | confirmed by a test  |
| IMP-1     | A `<use>` inside `<clipPath>` is deleted by svgo, so Illustrator clip groups import invisible        | Import                | high     | confirmed by a test  |
| IMP-2     | SVG `opacity` on paths and groups is ignored                                                         | Import                | medium   | confirmed by a test  |
| IMP-3     | VectorDrawable color references are dropped, so Android Studio icons import with no fill             | Import                | medium   | confirmed by a test  |
| IMP-4     | Unrendered SVG elements outside `<defs>` become layers                                               | Import                | medium   | confirmed by a test  |
| IMP-5     | Fractional viewBox sizes are truncated, cropping the content                                         | Import                | low      | confirmed by a test  |
| IMP-6     | SVGs without `xmlns` import as empty groups and report success                                       | Import                | low      | confirmed by a test  |
| IMP-7     | clipPath transforms are composed in the wrong order                                                  | Import                | low      | confirmed by a test  |
| IMP-8     | Bad `clip-path` references hide the element or fail the whole import                                 | Import                | low      | confirmed by a test  |
| IMP-9     | `<use>` outside `<defs>`, `<symbol>`, and nested `<svg>` positioning are mishandled                  | Import                | low      | confirmed by a test  |
| IMP-10    | Non-ASCII ids give empty layer names                                                                 | Import                | low      | confirmed by a test  |
| IMP-11    | Percentage values import as NaN                                                                      | Import                | low      | confirmed by a test  |
| IMP-12    | `.shapeshifter` import keeps duplicate layer ids                                                     | Import                | low      | confirmed by a test  |
| IMP-13    | Some files in a multi-file import silently stall the batch                                           | Import                | low      | confirmed by reading |
| IMP-14    | A slow `?project=` fetch can overwrite work done in the meantime                                     | Import                | low      | plausible            |
| EXP-1     | VD and AVD export write empty or unmorphable path data, which crashes Android at inflate time        | Export                | medium   | confirmed by a test  |
| EXP-2     | SVG export trims paths wrongly inside scaled groups                                                  | Export                | medium   | confirmed by a test  |
| EXP-3     | SVG export can give two clip paths the same id                                                       | Export                | medium   | confirmed by a test  |
| EXP-4     | SVG export omits `stroke-width` when it's 0, so a 1-unit stroke appears                              | Export                | low      | confirmed by a test  |
| EXP-5     | Spritesheet frames aren't clipped to their cells                                                     | Export                | low      | confirmed by a test  |
| EXP-6     | Frame file names in the SVG zip are padded one digit short                                           | Export                | low      | confirmed by reading |
| EXP-7     | The spritesheet CSS never rests on the last frame                                                    | Export                | low      | confirmed by reading |
| CANVAS-1  | The canvas paints the fill over the stroke                                                           | Canvas                | medium   | confirmed by a test  |
| CANVAS-2  | Split segments of fill-only paths can't be hovered or selected                                       | Canvas                | medium   | confirmed by a test  |
| CANVAS-3  | Hit and snap tolerances ignore the group transform                                                   | Canvas                | medium   | confirmed by a test  |
| CANVAS-4  | The trim path dash length uses the inverse matrix in scaled groups                                   | Canvas                | medium   | confirmed by a test  |
| CANVAS-5  | Rulers show wrong coordinates when the viewport is bigger than the canvas                            | Canvas                | medium   | confirmed by a test  |
| CANVAS-6  | Canvases ignore devicePixelRatio changes                                                             | Canvas                | low      | confirmed by a test  |
| CANVAS-7  | The trim path preview doesn't follow Android's rules for fills and later subpaths                    | Canvas                | low      | confirmed by a test  |
| CANVAS-8  | A selected clip path clips the highlights of later selected layers                                   | Canvas                | low      | confirmed by a test  |
| CANVAS-9  | Dragging a split point near another subpath is silently undone                                       | Canvas                | low      | confirmed by a test  |
| CANVAS-10 | The shape splitter's hover highlight sticks after the mouse leaves                                   | Canvas                | low      | confirmed by a test  |
| CANVAS-11 | Right and middle clicks start gestures                                                               | Canvas                | low      | confirmed by reading |
| UI-1      | A click that ends a drag reaches the workspace and clears the selection or exits action mode         | Timeline and UI       | medium   | confirmed by a test  |
| UI-2      | The inspector's typed text outlives undo and selection changes, and is applied to the wrong layer    | Timeline and UI       | medium   | confirmed by a test  |
| UI-3      | Renaming a layer to a name that sanitizes to its current name adds `_1`                              | Timeline and UI       | medium   | confirmed by a test  |
| UI-4      | A single wheel zoom step doesn't keep the time cursor in place                                       | Timeline and UI       | medium   | confirmed by a test  |
| UI-5      | "Convert to clip path" is hidden if any layer has a non-path animation                               | Timeline and UI       | medium   | confirmed by a test  |
| UI-6      | Shift-scaling several blocks of one property can make them overlap                                   | Timeline and UI       | low      | confirmed by a test  |
| UI-7      | Shift-dragging a block's start edge moves its fixed end                                              | Timeline and UI       | low      | confirmed by a test  |
| UI-8      | Snapping after clamping lets a multi-block move leave the animation                                  | Timeline and UI       | low      | confirmed by a test  |
| UI-9      | Up and Down arrows in name and color fields throw or change the value                                | Timeline and UI       | low      | confirmed by a test  |
| UI-10     | Modifier+Up does nothing on integer times, while modifier+Down subtracts 1                           | Timeline and UI       | low      | confirmed by a test  |
| UI-11     | Recursive collapse leaves child paths stuck collapsed                                                | Timeline and UI       | low      | confirmed by a test  |
| UI-12     | Empty layer and animation names are accepted                                                         | Timeline and UI       | low      | confirmed by a test  |
| UI-13     | The inspector accepts block times that the timeline would reject                                     | Timeline and UI       | low      | confirmed by reading |
| UI-14     | The wheel zoom can start from a stale zoom level                                                     | Timeline and UI       | low      | confirmed by a test  |
| UI-15     | The timeline header draws time labels past the end of the animation                                  | Timeline and UI       | low      | confirmed by a test  |
| UI-16     | File > Open and the demos replace the workspace without the prompt that New shows                    | Timeline and UI       | low      | confirmed by reading |
| CFG-1     | Unhashed files in `public/assets/` are precached without a revision and never update                 | Build and PWA         | low      | confirmed by a test  |
| CFG-2     | `navigateFallback` serves the app for every uncached navigation                                      | Build and PWA         | low      | confirmed by a test  |
| CFG-3     | The "doesn't reload open pages" test passes even without `onNeedReload`                              | E2E tests             | low      | confirmed by a test  |
| CFG-4     | The zoom test's "page doesn't scroll or zoom" check can't fail                                       | E2E tests             | low      | confirmed by a test  |
| CFG-5     | The Space-in-dialog check races the 300 ms demo                                                      | E2E tests             | low      | confirmed by reading |
| CFG-6     | Screenshots from the three browsers overwrite each other                                             | E2E tests             | low      | confirmed by reading |
| CFG-7     | Prettier and oxlint scan `.claude/worktrees/`                                                        | Dev tooling           | low      | confirmed by a test  |

## Path model

### PATH-1. Reversing a split-off piece of a command draws the wrong geometry

- **Location:** `model/paths/CommandState.ts:224-237` (`reverse`), called from `model/paths/Path.ts:1154-1167` (`reverseCommandStates`).
- **Severity:** high
- **Confidence:** confirmed by a test
- **Trigger:** Split a subpath in the middle of a segment, reverse one of the halves, then split that half again. For example `fromPathOpString('M 0 0 L 10 0 L 20 0', 'SIH 0 1 SSSP 0 1 RV 1 SSSP 1 1')` returns `M 0 0 L 5 0 M 20 0 L 10 0 M 10 0 L 0 0`. The last subpath should end at (5, 0), not (0, 0). A filled square with `SIH 0 1 SIH 0 4 SFSP 0 1 4 RV 1 SFSP 1 1 3` loses its corner at (10, 10) and gains a segment to (0, 0).
- **Impact:** After a reverse, a later split in action mode visibly changes the shape: segments jump onto other parts of the original command. The morph then animates the corrupted shape.
- **Fix direction:** `reverse()` keeps `minT` and `maxT` and maps split times with `lerp(maxT, minT, t)`, which is only right for an unsliced command. Map each t to `1 - t`, set the range to `[1 - maxT, 1 - minT]`, set the last mutation's t to `1 - minT`, and keep each `svgChar` attached to the segment it belongs to. The transform matrix is also dropped there (latent).

### PATH-2. Splitting a subpath reorders the other subpaths

- **Location:** `model/paths/Path.ts:512` (`splitStrokedSubPath`) and `model/paths/Path.ts:693` (`splitFilledSubPath`).
- **Severity:** high
- **Confidence:** confirmed by a test
- **Trigger:** Give a path a non-identity subpath order, which pair subpaths mode (`moveSubPath(i, 0)`) and auto fix (`orderSubPaths`) both do, then split a subpath. With `M 0 0 L 5 0 L 10 0 M 0 10 L 5 10 L 10 10 M 0 20 L 5 20 L 10 20`, `moveSubPath(2, 0)` gives the order y=20, y=0, y=10. `splitStrokedSubPath(2, 1)` then gives [second half of y=10, y=0, first half of y=10, y=20]: the y=20 line moves from first to last.
- **Impact:** The from and to subpath pairing silently changes after pairing or auto fix, so the morph pairs the wrong shapes, and the paired subpath indices kept by action mode go stale.
- **Fix direction:** Both methods push `subPathOrdering.length`, but the new leaf is inserted at flattened position `spsIdx + 1`. Increment every ordering entry greater than `spsIdx`, then insert `spsIdx + 1` next to the split subpath's entry.

### PATH-3. `splitFilledSubPath` mishandles two split points on the same command

- **Location:** `model/paths/Path.ts:578` (the typo), and the loops at `model/paths/Path.ts:616-626` and `:628-650`.
- **Severity:** medium
- **Confidence:** confirmed by a test
- **Trigger:** Split a filled subpath between two points that were both added to the same original command. For example `M 0 0 C 0 -10 10 -10 10 0 L 10 10 L 0 10 Z`, split command 1 at t = 0.333 and 0.667 (`S 0 1 0.333 0.667`), then `splitFilledSubPath(0, 1, 2)`.
- **Impact:** Subpath 0 loses the part of the curve from t = 2/3 to 1, and subpath 1 is left open with no split line. The typo (`s.splitIdx > e.csIdx`, meant to be `e.splitIdx`) only matters when both ends are in the same command state, and it can also swap wrongly (for example split indices 2 and 3 in command state 1). Fixing it alone isn't enough: when `startCsIdx === endCsIdx`, the first loop never pushes `secondRight`, and the second loop pushes all of `firstRight` and never pushes `endLine`. Another agent is investigating this in depth.
- **Fix direction:** Compare `s.splitIdx > e.splitIdx`, and add a same-command-state branch to both loops.

### PATH-4. "Split in half" on an already split curve splits in the wrong place

- **Location:** `model/paths/CommandState.ts:255-261`
- **Severity:** medium
- **Confidence:** confirmed by a test
- **Trigger:** `M 0 0 C 0 0 0 10 10 10` split at t = 0.25, then "Split in half" on segment 1 (length 1.57). Segment 2 is split instead (14.29 becomes 0.41 and 13.88). After a split at t = 0.5, the halves come out 3.97 and 1.23 instead of 2.6 and 2.6. Lines are unaffected.
- **Impact:** The toolbar's "Split in half" (`splitSelectedPointInHalf`) and its hover preview add the point off-center on curves, sometimes on the neighboring segment.
- **Fix direction:** The code passes `lerp(startSplit, endSplit, 0.5)`, a midpoint in t, to `findTimeByDistance`, which expects a fraction of the whole curve's arc length. Convert both ends to arc-length fractions (for example `calculator.split(0, t).getPathLength() / total`), average them, then call `findTimeByDistance`.

### PATH-5. `isClockwise` can't tell the direction of line segments, so auto fix twists polygons

- **Location:** `model/paths/PathState.ts:399-402` (`getArea`), used by `scripts/algorithms/AutoAwesome.ts:342-345`.
- **Severity:** medium
- **Confidence:** confirmed by a test
- **Trigger:** `autoFix('M 0 0 L 10 0 L 10 10 L 0 10 Z', 'M 0 0 L 10 0 L 0 10 Z')`. Both inputs have the same orientation, but the output's shoelace areas are +100 and -50. A square and its reversal are both reported clockwise, and a triangle and its reversal are both reported counterclockwise. A square drawn with cubics flips correctly.
- **Impact:** Auto fix reverses polygon targets it shouldn't (or fails to reverse ones it should), undoing `alignSubPath`, so shapes turn inside out during the morph. Most icons are made of line segments.
- **Fix direction:** For `L` and `Z`, `(x3 - x0) * (y3 - y0)` doesn't change sign when the segment is reversed. Use the shoelace term `(x0 * y3 - x3 * y0) / 2`, or `(x3 - x0) * (y3 + y0) / 2`.

### PATH-6. Auto fix reverses open subpaths

- **Location:** `scripts/algorithms/AutoAwesome.ts:342-345`
- **Severity:** medium
- **Confidence:** confirmed by a test
- **Trigger:** `autoFix('M 0 0 L 10 10 L 20 10', 'M 0 0 L 10 -10 L 20 -10')` returns the target as `M 20 -10 L 10 -10 L 0 0`. Mirrored arcs (`M 0 0 C 0 10 10 10 10 0` and `C 0 -10 10 -10 10 0`) are reversed too.
- **Impact:** A stroke's endpoints swap during the morph, so the line appears to flip end over end.
- **Fix direction:** `permuteSubPath` compares orientation even for open subpaths, where it's meaningless and `alignSubPath` has already chosen the direction. Only compare orientation when both subpaths are closed.

### PATH-7. Splitting a stroked subpath at its first or last point makes a degenerate subpath that later crashes

- **Location:** `model/paths/Path.ts:477-514` (no guard), reached from `components/canvas/SegmentSplitter.ts:43-47`, whose endpoint hits include command 0 and the last command.
- **Severity:** medium
- **Confidence:** confirmed by a test
- **Trigger:** In action mode's split subpaths mode, click the start point (or the end point) of a stroked subpath.
- **Impact:**
  - At command 0 it adds a lone-`M` subpath: `M 2 5 L 10 5 L 20 5` becomes `M 2 5 M 2 5 L 10 5 L 20 5`, which forces a collapsing subpath onto the other path. For a closed subpath the `Z` also becomes an `L`, so the start corner loses its line join. Auto fix then throws "Error retrieving command mutation".
  - At the last command it creates a leaf whose trailing `M` is dropped by `createSubPaths`, so there are two leaves but one visible subpath. The path looks unchanged, but `autoAddCollapsingSubPaths`, which the service runs after every action mode edit, then throws against a path with two subpaths.
- **Fix direction:** Ignore endpoint hits on the first point, and on the last point of open subpaths, in `SegmentSplitter`, and have `splitStrokedSubPath` reject them with a `console.warn` like other no-op edits.

### PATH-8. Deleting the start point of a reversed, shifted subpath throws

- **Location:** `model/paths/Path.ts:394-410` (`unsplitCommand`), crashing in `shiftCommands` at `model/paths/Path.ts:1338`.
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** Square, split command 4 in half, "Set as first point" on the new point (shift forward 4), reverse, then delete the point (`unsplitCommand(0, 5)`). It throws "Cannot read properties of undefined (reading 'start')". Without the reversal it works. The fuzz found the same crash with `SB RV SIH 0 4 SB US 0 5`.
- **Impact:** Delete on that point throws from the keydown handler (a Bugsnag report), and nothing changes.
- **Fix direction:** For reversed subpaths the removed internal index is `splitIdx - 1`, but the shift position is computed from `splitIdx`. Use the reversed index, or clamp the offset to `[0, n - 2]`.

### PATH-9. Auto fix throws on single-command subpaths

- **Location:** `scripts/algorithms/AutoAwesome.ts:282`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** `autoFix(new Path('M 5 5'), new Path('M 0 0 L 10 10 L 20 0'))`, or a path starting with `M a b M ...`, or the subpaths PATH-7 creates.
- **Impact:** Auto fix throws instead of fixing the paths. `_.clamp(x, 1, numPaths - 1)` returns 1 when there's one command, and `splitCommand` then throws at `model/paths/Path.ts:1058`.
- **Fix direction:** Skip or special-case subpaths with one command.

### PATH-10. `CommandState.getPathLength` ignores `minT` and `maxT`

- **Location:** `model/paths/CommandState.ts:54-56` (length) and `:66-72` (bounding box).
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** `M 0 0 L 10 0 L 20 0` with `SIH 0 1 SSSP 0 1`: `getSubPathLength(0)` is 10 (the drawn length is 5) and subpath 1 is 20 (the drawn length is 15).
- **Impact:** Trim paths measure the first subpath with this length (`components/canvas/CanvasLayers.ts:187-194` and `scripts/export/SvgSerializer.ts:175-181`). `interpolateValue` returns the stateful from and to paths at fractions 0 and 1 and after the block ends, so a trimmed stroke on a morph with a split subpath gets the wrong dashes on those frames, in the preview and in SVG and spritesheet exports. The bounding box has no visible effect: `PathState.getBoundingBox` only sees top-level states, which are never sliced, and the hit test only uses it as a prefilter.
- **Fix direction:** Measure `calculator.split(minT, maxT)`.

### PATH-11. `PathState.getPathLength` and `getPointAtLength` only see the tree roots

- **Location:** `model/paths/PathState.ts:63-69` and `:76-89`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** After `SIH 0 1 SSSP 0 1` on `M 0 0 L 10 0 L 20 0`, `getPathLength()` is 10 (should be 20) and `getPointAtLength(12)` is undefined. After `RV 0` on `M 0 0 L 0 100`, `getPointAtLength(10)` gives (0, 10) instead of (0, 90).
- **Impact:** None today: only `model/paths/Path.spec.ts` calls them. `subPathStateMap` holds tree roots, but the loop index is passed on as a visible subpath index, so only the first N visible subpaths are summed (N being the number of roots). `getPointAtLength` also ignores reversal and shifting.
- **Fix direction:** Iterate the visible subpaths (`getSubPaths()`), or delete the methods.

### PATH-12. `deleteStrokedSubPath` throws when the sibling was split again (latent)

- **Location:** `model/paths/Path.ts:520-536`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** `M 0 0 L 10 0 L 20 5 L 30 0` with `SSSP 0 1 SSSP 1 1 DSSP 0` throws in `buildOrderedCommands` (`model/paths/Path.ts:992`).
- **Impact:** Unreachable today, because the service only deletes subpaths whose `isSplit()` is true, which never happens (the known "Split subpaths can't be deleted" bug). It will surface as soon as that bug is fixed.
- **Fix direction:** Remove the ordering entries for every leaf under the parent, like `calculateDeletedSubIdxs` does.

### PATH-13. Arcs with zero or negative radii are misparsed

- **Location:** `model/paths/PathParser.ts:375-436`, with `:346-362` advancing the current point anyway.
- **Severity:** low
- **Confidence:** confirmed by a test (compared with Chromium)
- **Trigger:** `M 0 0 a 0 0 0 0 1 20 0 l 10 10` becomes `M 0 0 L 10 10` instead of `L 20 0 L 30 10`. `A 0 10 ...` is dropped entirely, and `A -10 10 ...` bulges the wrong way.
- **Impact:** Typed or pasted path data, VectorDrawables, and `.shapeshifter` files with such arcs lose segments. svgo repairs zero radii on SVG import. Android's own parser has the same behavior, so the AVD output matches the device, but the SVG export doesn't match browsers.
- **Fix direction:** Use `Math.abs` on the radii and emit a line when either radius is 0, as the SVG spec requires.

### PATH-14. Tabs, newlines, and `+` aren't treated as number separators

- **Location:** `model/paths/PathParser.ts:104-107`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** `M 0 0 L\t10\t10` or `L\n10\n10` parses to `L 10 undefined`, and the path string becomes `M 0 0 L NaN NaN`. By reading, `5+5` loses the second number, and an odd number of arguments also produces NaN.
- **Impact:** Typing or pasting such data into the property panel, or loading a hand-edited file, gives NaN geometry.
- **Fix direction:** Treat all SVG whitespace as separators, and `+` too when it doesn't follow an `e`.

### PATH-15. A path with no subpaths crashes `autoAddCollapsingSubPaths`

- **Location:** `model/paths/Path.ts:917-918`, reached from `scripts/algorithms/AutoAwesome.ts:93-98`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** `new Path('L 10 10')`, `'   '`, or `'Z'` has 0 subpaths, and `autoAddCollapsingSubPaths` throws "reading 'end'" in either order. Reachable by typing path data without a leading `M` into a morph block.
- **Impact:** The action mode edit or auto fix throws.
- **Fix direction:** Return early when either path has no subpaths.

### PATH-16. Degenerate "spike" curves are treated as zero-length lines

- **Location:** `model/paths/calculators/Calculator.ts:37` and `model/paths/Command.ts:97-100`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** A `C` or `Q` whose start equals its end but whose control points differ, for example `M 0 0 C 10 10 10 10 0 0 L 0 -10`.
- **Impact:** The bounding box misses the spike, "Split in half" collapses it into two `C 0 0 0 0 0 0`, and `canConvertTo('L')` is true, so auto convert can flatten it.
- **Fix direction:** Only treat a curve as a point when all of its points coincide.

### PATH-17. Filled subpaths without a closing `Z` can't be clicked by their fill

- **Location:** `model/paths/PathState.ts:215-219`, used by `components/canvas/CanvasOverlay.ts:975-979`
- **Severity:** low
- **Confidence:** confirmed by reading
- **Trigger:** A filled path whose data doesn't end in `Z` (valid SVG, since fills close implicitly). Click inside the fill on the main canvas.
- **Impact:** Shape hits skip subpaths that aren't closed, so the click misses the layer unless it lands on the outline. Each subpath is also tested on its own with the even-odd rule, which ignores `fillType` and holes made by other subpaths.
- **Fix direction:** Treat every filled subpath as implicitly closed for shape hits, and test the whole path with its fill rule.

### PATH-18. `SvgUtil.ts` is dead code

- **Location:** `model/paths/SvgUtil.ts:14`
- **Severity:** low
- **Confidence:** confirmed by reading
- **Trigger:** None. Nothing imports `SvgUtil` or `arcToBeziers`, not even the paper.js editor, and `model/paths/index.ts` doesn't export it.
- **Impact:** None beyond maintenance.
- **Fix direction:** Delete it.

## Store and services

### STORE-1. Undo and redo overwrite playback and action mode state

- **Location:** `store/undoredo/metareducer.ts:63-69` (only the theme is carried over), and `services/playback.service.ts:41-50`.
- **Severity:** medium
- **Confidence:** confirmed by a test
- **Trigger:** The actions in `UNDO_EXCLUDED_ACTIONS` aren't recorded as steps, but their slices are inside every snapshot, so undo restores them as they were. For example:
  - Play, click a layer while it plays, let it finish, click another layer, and press Cmd+Z. Playback starts again from the time of the first click (the test saw the time advance from 272 to 464).
  - Turn on repeat and slow motion, make an edit, and undo. Both turn off.
  - Undoing the first change after entering action mode leaves action mode, and undoing an edit made after leaving it goes back in.
  - The time cursor jumps on every undo.
- **Impact:** Undo has side effects the user didn't ask for, including starting playback. This is the same class as the theme bug that was fixed, and distinct from the known bug about paper slice actions being recorded. Plausibly, when undo restores pair mode, `CanvasOverlay` dispatches `SetUnpairedSubPath` from a subscriber, which is recorded and would wipe the redo stack.
- **Fix direction:** Carry the playback slice over from the current state on undo and redo, the way the theme is. For action mode, keep the current mode only if the restored state has the same single selected path block, and otherwise exit. `IMPROVEMENTS.md` item 7 is the longer-term fix.

### STORE-2. The first action of a burst becomes its own undo step

- **Location:** `store/undoredo/metareducer.ts:54-61`
- **Severity:** medium
- **Confidence:** confirmed by a test (and in the browser)
- **Trigger:** Drag a block (each drag event dispatches `updateBlocks`) and press Cmd+Z: the block goes back to where the first drag event put it, and a second undo is needed. Typing "xyz" quickly into a name field and pressing Cmd+Z once gives "pathx", not "path".
- **Impact:** Almost every drag and typing burst takes two undos, and the first leaves a confusing intermediate state. When the window has expired, `groupBy` increments the counter and returns `undefined`, so the entry is stored with group `undefined`. The next action within a second returns `groupCounter`, which doesn't match, so it starts a second step. Only the third action onward is merged. `store/AGENTS.md` describes the intended behavior, but `store/createEditorStore.spec.ts:43` asserts the current one.
- **Fix direction:** `if (Date.now() - timestamp >= UNDO_DEBOUNCE_MILLIS) groupCounter++; return groupCounter;`, and update the spec.

### STORE-3. Cut in action mode deletes the block being edited, then every edit throws

- **Location:** `services/clipboard.service.ts:36`, with the crash at `services/actionmode.service.ts:499`.
- **Severity:** medium
- **Confidence:** confirmed by a test
- **Trigger:** Select a path block, enter action mode, click a subpath, press Cmd+X, then press R, B, F, A, or Backspace.
- **Impact:** The cut handler doesn't check for action mode, so `deleteSelectedModels()` deletes the active path block while the mode stays Selection. Every path operation then calls `getActivePathBlock()`, gets undefined, and throws "Cannot read properties of undefined (reading 'fromValue')" from the keydown handler. The rest of the UI prevents this state (the timeline and layer list are disabled in action mode).
- **Fix direction:** In action mode, copy without cutting, or ignore the event. Also make `getActivePathBlock()` return undefined safely and have its callers bail out.

### STORE-4. Resuming playback in slow motion jumps to a fifth of the current time

- **Location:** `services/playback.service.ts:170`
- **Severity:** medium
- **Confidence:** confirmed by a test
- **Trigger:** Pause mid-animation (or scrub), turn on slow motion (S), and play. With the time at 500, the first frame shows 100.
- **Impact:** Slow motion always resumes at `currentTime / 5`, so it can't be used to inspect the second half of an animation.
- **Fix direction:** `progress = elapsed + startTime` compares an animation time with wall-clock time scaled by `playbackSpeed`. Use `elapsed + startTime * playbackSpeed`.

### STORE-5. Ungroup drops the group's transform and leaves its blocks and hidden state behind

- **Location:** `services/layertimeline.service.ts:465-489`
- **Severity:** medium
- **Confidence:** confirmed by a test
- **Trigger:** Select a group with a translate, rotation, or scale and press Cmd+Shift+G.
- **Impact:** The children move into the parent without the group's transform, so the artwork jumps (`flattenGroupLayer` does apply it). The group's animation blocks stay behind as orphans, and its id stays in the hidden and collapsed sets, so ungrouping a hidden group makes its children visible. Grouping layers from parents with different transforms loses transforms the same way.
- **Fix direction:** Apply the transform as `flattenGroupLayer` does (or reuse it), run `buildCleanupLayerIdActions`, and move the hidden state onto the children.

### STORE-6. Cmd+Z and Cmd+G fire inside focused text fields

- **Location:** `services/shortcut.service.ts:60-73`, which runs before the text field check at line 78.
- **Severity:** medium
- **Confidence:** confirmed by a test
- **Trigger:** Type in a property field or a layer name and press Cmd+Z, or Cmd+G.
- **Impact:** Cmd+Z undoes an editor step and prevents the native text undo. The field keeps showing the typed text while the store has reverted, which leads to UI-2. Cmd+G groups the selected layers while you're typing. `TEXT_FIELD_SELECTOR` exists but is only used in the modal branch.
- **Fix direction:** Return early when `event.target` matches `TEXT_FIELD_SELECTOR`, before the modifier shortcuts.

### STORE-7. Clipboard handlers ignore open menus and dialogs, and block native copy

- **Location:** `services/clipboard.service.ts:24-33` and `:43-54`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** With a block selected, open a menu (for example Export) and press Cmd+X. Or press Cmd+C with no blocks selected while text is selected on the page.
- **Impact:** Cut deletes the block behind the menu, and paste works behind a dialog, even though `BUGS.md` lists shortcuts firing behind menus as fixed. Copy with no blocks selected returns false, which cancels the browser's copy, so page text can't be copied. In action mode every paste reports "Attempt to import files while in action mode" to Bugsnag.
- **Fix direction:** Add the `.MuiModal-root` and `TEXT_FIELD_SELECTOR` checks the shortcut service uses, and return true when there's nothing to copy.

### STORE-8. Repeat restarts from where playback was resumed, not from 0

- **Location:** `services/playback.service.ts:175`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** Scrub to 500 ms of a 1000 ms animation, turn on repeat, and play.
- **Impact:** Every loop restarts at 500 ms.
- **Fix direction:** Pass 0 as the start time in the repeat timeout.

### STORE-9. Play with the current time past the end only jumps to the end

- **Location:** `services/playback.service.ts:45`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** Scrub to 900 ms, shorten the animation to 300 ms, and press Space.
- **Impact:** Playback stops on its first frame at 300 ms, so play has to be pressed twice. The check is `duration === currentTime`, and nothing clamps the current time when the duration changes.
- **Fix direction:** Use `currentTime >= duration ? 0 : currentTime`.

### STORE-10. Pasting JSON with a malformed `blocks` field throws

- **Location:** `services/clipboard.service.ts:83-87`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** Paste `{"blocks": {"a": 1}}` or `{"blocks": [null]}`.
- **Impact:** An uncaught TypeError in the paste handler, reported to Bugsnag.
- **Fix direction:** Check `Array.isArray`, and wrap each `AnimationBlock.from` in a try/catch that drops failures.

### STORE-11. Pairing subpaths gets the paired set and the selection wrong

- **Location:** `services/actionmode.service.ts:318-326` (the paired set) and `:303-316` (the selection).
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** With 4 subpaths, pair (3, 3) twice (giving {0, 1}), then pair From 0 with To 3: the set becomes {1} instead of {0}. With 3 subpaths and From 0 selected, pairing To 2 with From 2 leaves the selection at index 0, which is now a different subpath.
- **Impact:** The wrong subpaths are drawn as paired, and R, B, and F then act on a stale selection.
- **Fix direction:** `add(pairedSubPaths.size)` assumes the paired subpaths are a prefix, and the selection remap ignores that `moveSubPath(i, 0)` shifts every index below i. Remap both: old index p becomes p + 1 if p < i.

### STORE-12. No-op commands record empty undo steps

- **Location:** `services/layertimeline.service.ts:495-496` (delete), `:488-492` (ungroup), and `:580-587` (`addBlocks`)
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** Backspace with nothing selected, Cmd+Shift+G with only paths selected (which also deselects them), or pasting blocks that can't be added.
- **Impact:** Each adds an entry to the undo history, so undo needs extra presses that do nothing visible. The reducers always build new Sets, so the dispatch counts as a change.
- **Fix direction:** Only dispatch when something changes.

### STORE-13. Undoing the first edit after loading a project resets the timeline zoom

- **Location:** `store/reset/reducer.ts:14-23`, with the effect at `components/layertimeline/LayerTimelineController.ts:121`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** Load a project, zoom the timeline, make an edit, and undo it.
- **Impact:** Undo restores `isBeingReset`, so the timeline zooms to fit again. Same class as STORE-1.
- **Fix direction:** Clear the flag on undo and redo, or drop it (there's a TODO).

### STORE-14. Flattening a group doesn't scale stroke width blocks

- **Location:** `services/layertimeline.service.ts:324-328`, compared with `:356-368`
- **Severity:** low
- **Confidence:** confirmed by reading
- **Trigger:** Flatten a scaled group whose child path has a `strokeWidth` animation.
- **Impact:** The static stroke width is scaled, but the blocks aren't, so the animated width changes after flattening.
- **Fix direction:** Scale `strokeWidth` block values by the same factor.

### STORE-15. Converting to or from a clip path, and importing into an empty workspace, lose per-layer state

- **Location:** `services/layertimeline.service.ts:267-270` (`swapLayers`) and `:195-201` (`importLayers`)
- **Severity:** low
- **Confidence:** confirmed by reading
- **Trigger:** Convert a hidden path to a clip path. Or animate the root's alpha in an empty workspace, then import an SVG.
- **Impact:** `swapLayers` gives the layer a new id without carrying over its hidden, collapsed, and selected state, so a hidden path becomes visible and deselected. `importLayers` replaces an empty root with the imported vector layer's id, orphaning blocks on the root.
- **Fix direction:** Carry the ids over to the new layer, or keep `vectorLayer.id`.

### STORE-16. A zero-length path block shows its from path on the end canvas

- **Location:** `store/actionmode/selectors.ts:78`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** Set a path block's end time equal to its start time in the property panel, then enter action mode.
- **Impact:** `timeMillis === block.startTime` decides between the from and to paths, so the end canvas shows the from path. Plausibly, edits there write from-path geometry into the to value.
- **Fix direction:** Pass an explicit from or to flag instead of comparing times.

### STORE-17. `createDeepEqualSelector` deep-compares inputs, not results

- **Location:** `store/selectors.ts:19-23`, as used by `store/timeline/selectors.ts:31`
- **Severity:** low (performance)
- **Confidence:** confirmed by a test
- **Trigger:** Any change to the animation or the layers slice.
- **Impact:** `getSelectedBlockLayerIds` returns a new Set whenever the animation changes, contrary to what `store/AGENTS.md` promises, and `getSelectedLayerIds`, `getHiddenLayerIds`, and `getCollapsedLayerIds` run `_.isEqual` over the whole layers slice, including the full vector layer tree, on every change.
- **Fix direction:** Use `memoizeOptions: { resultEqualityCheck: _.isEqual }` instead of an input equality check.

## Layers, properties, timeline, and rendering

### MODEL-1. Flattening a group mis-decomposes mirrored or rotated nested groups

- **Location:** `scripts/common/Matrix.ts:93` (`getScaling`) and `:102` (`getRotation`), whose only caller is `services/layertimeline.service.ts:310-312` (`flattenGroupLayer`).
- **Severity:** medium
- **Confidence:** confirmed by a test
- **Trigger:** "Flatten group" on a group whose child group is mirrored (scaleX -1), rotated by more than 90 degrees, or rotated with a non-uniform scale. The flattened group itself can be an identity group.
- **Impact:** The nested group's content moves or flips with no warning. A horizontal mirror becomes a vertical one, a 180 degree rotation comes out as rotation 180 with scale (-1, -1) (identity), and rotation 90 with scale (2, 1) comes out as scale (1, 2). With Android's T·R·S order the matrix is `a = cos·sx, b = sin·sx, c = -sin·sy, d = cos·sy`, but `getScaling` uses the row norms with the signs of `a` and `d`, and `getRotation` uses `atan2(-c, a)`, which is only right for uniform positive scales.
- **Fix direction:** `rotation = atan2(b, a)`, `sx = hypot(a, b)`, `sy = det / sx`. Detect skew (`a*c + b*d != 0`, from a non-uniform parent scale with a rotated child) and bake it into the descendants' paths, or refuse to flatten.

### MODEL-2. Merging viewports of different sizes misplaces the content

- **Location:** `model/layers/LayerUtil.ts:113` (`adjustViewports`), plus the recursion at `:114-134`
- **Severity:** medium
- **Confidence:** confirmed by a test
- **Trigger:** Import a 24x12 SVG into a non-empty 48x48 project. `mergeVectorLayers` puts the imported `M 0 0 L 24 12` at (0, 24) to (48, 48), bottom-aligned, instead of (0, 12) to (48, 36).
- **Impact:** Imported content lands in the wrong place whenever one side is both scaled and centered. `Matrix.flatten([scaling, translation])` computes `s * (p + t)`, but the offsets were computed in already-scaled units. The offset is also applied to every path's local coordinates, so inside rotated or scaled groups it's rotated or scaled too: content in a 90 degree rotated group moves sideways instead of down. By reading, a non-integer merged viewport is also floored by the integer width and height setters, which crops slightly.
- **Fix direction:** Use translation times scaling, and apply the offset once at the top level (to top-level paths, and as `translate' = s * translate + t` on top-level groups). Nested content should only be scaled.

### MODEL-3. Importing a larger SVG into an animated project breaks the existing animation

- **Location:** `model/layers/LayerUtil.ts:137` and `:149-150`, called from `services/layertimeline.service.ts:203-206`
- **Severity:** medium
- **Confidence:** confirmed by a test
- **Trigger:** A 24x24 project with a path morph (or translate, pivot, or stroke width blocks). Import a 48x48 SVG.
- **Impact:** `adjustViewports` rescales and offsets the existing layers, but the animation blocks keep the old coordinates, so during playback the animated values jump back to the old scale and position. In the test the layer became `M 0 0 L 48 48`, but the block's `fromValue` stayed `M 0 0 L 24 24`.
- **Fix direction:** Return the transform applied to each tree so `importLayers` can apply it to the existing blocks' values, or keep the existing viewport and only fit the imported tree into it.

### MODEL-4. Before a delayed block starts, the preview shows the static value, unlike Android 7.1+

- **Location:** `scripts/animator/AnimationRenderer.ts:62-66`
- **Severity:** medium (a fidelity mismatch, and changing it is a judgment call)
- **Confidence:** confirmed by reading (AOSP)
- **Trigger:** A block with a start time after 0 whose `fromValue` differs from the layer's static value, for example `fillAlpha` 0 to 1 from 200 to 400 ms.
- **Impact:** Shape Shifter shows the static value until the block starts and then jumps. The preview, SVG frames, and spritesheets all do this. RenderThread AVDs (API 25 and later) reset every animator to fraction 0 at play time 0 (`libs/hwui/PropertyValuesAnimatorSet.cpp:70-78`, where the earliest-ending animator is applied last, and `Animator.cpp:207-253`), so on the device the path in the example is hidden from 0 to 200 ms. UI-thread playback before API 25 matches the current preview.
- **Fix direction:** For times before a property's first block, render the `fromValue` of the block that ends first, or at least document the difference.

### MODEL-5. Invalid and partial colors become black, and garbage hex is accepted

- **Location:** `scripts/common/ColorUtil.ts:56-64` (`svgToAndroidColor` never checks tinycolor's `isValid()`) and `:14-38` (`parseInt` accepts a valid prefix), and `model/properties/ColorProperty.ts:22-25` and `:57-65`.
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** The property panel commits on every keystroke (`components/propertyinput/PropertyInput.tsx:158-160`), so typing `#00ff00` sets the fill to `#000000` three times, then `#0000ff`, `#0000ffff`, `#000000`, and finally `#00ff00`. A typo like `#12345` replaces the color with black. From files, `#1z1z1z` passes as rgb(1, 1, 1) and `#-1-1-1` gives negative channels, and both are stored and exported verbatim (aapt rejects `#1z1z1z`). SVG `currentColor` and paint servers like `url(#gradient)` also import as opaque black.
- **Impact:** The canvas flashes black while you type a color, a mistyped color is lost, and invalid colors can reach the exported XML.
- **Fix direction:** Return undefined from `svgToAndroidColor` when tinycolor says the color is invalid, have `setEditableValue` ignore unparseable input as `NumberProperty` does, and validate each hex pair with a regex.

### MODEL-6. Color interpolation doesn't use Android's linear color space

- **Location:** `model/properties/ColorProperty.ts:37-42`
- **Severity:** low
- **Confidence:** confirmed by a test (the Android formula is from AOSP)
- **Trigger:** Any color block, for example `#ff0000` to `#0000ff`.
- **Impact:** At the midpoint Shape Shifter renders `#800080`, while Android renders `#ba00ba`, because `ArgbEvaluator` (`core/java/android/animation/ArgbEvaluator.java:70-79`) and hwui's `PropertyValuesHolder.cpp:34-46` interpolate RGB in linear space. The preview and the SVG and sprite exports are darker mid-animation than the device.
- **Fix direction:** Convert to linear, interpolate, and convert back. Alpha stays linear.

### MODEL-7. An end time of 0 turns into 100, and inverted times flip on the next clone

- **Location:** `model/timeline/AnimationBlock.ts:36-43`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** Set a block's end time to 0 in the property panel (it allows a minimum of 0), or set its start time above its end time.
- **Impact:** `obj.endTime || 100` turns 0 into 100 the next time the block or the animation is cloned (`Animation.clone()` rebuilds every block) and on reload. An inverted range is stored as entered (for example 200 to 100), then silently swapped by the next unrelated edit.
- **Fix direction:** Use `??` for the defaults, and normalize or reject inverted ranges when they're set (see also UI-13).

### MODEL-8. Overshooting fraction animations are clamped in the preview but wrap on Android

- **Location:** `model/properties/FractionProperty.ts:5-10` and `model/properties/NumberProperty.ts:40`, applied by `scripts/animator/AnimationRenderer.ts:81`, with no range on block values (`model/timeline/AnimationBlock.ts:120-123`).
- **Severity:** low
- **Confidence:** confirmed by reading (AOSP)
- **Trigger:** Animate `trimPathEnd` from 0 to 1 with the overshoot or anticipate overshoot interpolator, or type a block value outside [0, 1] for a fraction property.
- **Impact:** The preview clamps to 1 and shows the whole path. Android doesn't clamp (`VectorDrawable.h:262-276`), and `applyTrim` computes `fmod(1.05, 1)`, drawing only 5% of the path. By reading, fill and stroke alpha above 1 also overflow `SkColorSetA`. The preview hides a glitch the device shows.
- **Fix direction:** Model Android's wrapping when rendering, or at least warn about overshooting interpolators on fraction properties.

### MODEL-9. The selection box of rotated or mirrored groups is wrong

- **Location:** `model/layers/Layer.ts:280-292` (`GroupLayer.bounds`), only used for the selection highlight at `components/canvas/CanvasOverlay.ts:377`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** Select a group rotated 45 degrees, or a group containing a mirrored subgroup.
- **Impact:** A 45 degree group around a 10x10 square gets `{l: 0, t: 0, r: 0, b: 14.14}`, so the outline collapses to a line. A mirrored subgroup's content is missed (l = 0 instead of -10).
- **Fix direction:** Transform all four corners and take the min and max.

### MODEL-10. Decimal commas are silently truncated in number fields

- **Location:** `model/properties/NumberProperty.ts:19`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** Type `1,5` into a number field, as users in comma-decimal locales do.
- **Impact:** `parseFloat` stops at the comma and stores 1.
- **Fix direction:** Replace a single comma with a period before parsing, or reject input that isn't fully numeric.

## Import

### IMP-1. A `<use>` inside `<clipPath>` is deleted by svgo, so Illustrator clip groups import invisible

- **Location:** `scripts/svgo/plugins/replaceUseElems.ts:83` (turns the `<use>` into a `<g>`) together with `scripts/svgo/index.ts:30` (`removeUnknownsAndDefaults`). The symptom shows up at `scripts/import/SvgLoader.ts:120-123`.
- **Severity:** high
- **Confidence:** confirmed by a test (reproduced twice)
- **Trigger:** Illustrator's classic "Save As SVG" clipping mask: `<defs><rect id="SVGID_1_" .../></defs><clipPath id="SVGID_2_"><use xlink:href="#SVGID_1_"/></clipPath><path clip-path="url(#SVGID_2_)" .../>`. `optimizeSvg` returns `<clipPath id="SVGID_2_"/>`.
- **Impact:** A `<g>` isn't a valid child of `<clipPath>`, so `removeUnknownsAndDefaults` deletes it and the clip path is left empty. The loader treats an empty clip path as "clip everything" (`M 0 0 Z`), so all the clipped artwork disappears. Illustrator writes this pattern for every clipping mask, so these files import blank, and a stray empty group named `svgid_2_` is added too (see IMP-4).
- **Fix direction:** When the `<use>` is inside a `<clipPath>`, splice in the referenced shape itself and fold `x`, `y`, and `transform` into its `transform` attribute, without a `<g>`. Alternatively, configure `removeUnknownsAndDefaults` with `unknownContent: false`.

### IMP-2. SVG `opacity` on paths and groups is ignored

- **Location:** `scripts/import/SvgLoader.ts:22-32` (`opacity` isn't read) and `:229` (only the root's opacity is read)
- **Severity:** medium
- **Confidence:** confirmed by a test
- **Trigger:** `<path opacity=".3" d="..."/>`, which Material two-tone icons use, or `<g opacity="0.5">` with several children (common in Figma and Sketch exports). svgo leaves `opacity` in place.
- **Impact:** These shapes import fully opaque, so two-tone icons turn into solid blobs.
- **Fix direction:** Multiply the element's and its ancestors' opacity into `fillAlpha` and `strokeAlpha`. That's exact for one path and an approximation for groups whose children overlap.

### IMP-3. VectorDrawable color references are dropped, so Android Studio icons import with no fill

- **Location:** `scripts/import/VectorDrawableLoader.ts:57`, `:59`, and `:250-254`
- **Severity:** medium
- **Confidence:** confirmed by a test
- **Trigger:** Any Vector Asset Studio material icon: `android:tint="?attr/colorControlNormal"` on the vector and `android:fillColor="@android:color/white"` on the path. `@color/...` and `?attr/...` behave the same.
- **Impact:** `getColor` returns `''` for anything that isn't a hex color, so the path has no fill. The icon imports invisible, and a success snackbar is shown.
- **Fix direction:** Map `@android:color/white`, `black`, and `transparent`, and fall back to an opaque color (for example `#000`) for other references and for `tint`, instead of no fill.

### IMP-4. Unrendered SVG elements outside `<defs>` become layers

- **Location:** `scripts/import/SvgLoader.ts:86-94` (only `<defs>` and `<use>` are skipped) and `:205-222` (every element's children are walked, with a TODO)
- **Severity:** medium
- **Confidence:** confirmed by a test
- **Trigger:** Any of these outside `<defs>`, which is valid SVG and what Illustrator writes: `<clipPath>`, a `<mask>`, a `<symbol>`, an inline `<linearGradient>`, or `<text>`.
- **Impact:** Clip path, mask, and symbol content is imported as extra visible black or white paths. A gradient and its `<stop>`s become three empty groups, and `<text>` becomes an empty group.
- **Fix direction:** Return undefined for `clipPath`, `mask`, `symbol`, gradients, `pattern`, `marker`, `text`, and any other element that isn't a group or a shape.

### IMP-5. Fractional viewBox sizes are truncated, cropping the content

- **Location:** `scripts/import/SvgLoader.ts:233-235` with `model/layers/Layer.ts:212-213` (width and height are integers), and `scripts/import/VectorDrawableLoader.ts:107-108`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** `viewBox="0 0 16.933333 16.933333"`, as Inkscape writes for millimeter documents.
- **Impact:** The viewport becomes 16x16 while the content spans 16.93, so about 6% is cut off at the right and bottom, and the VD export carries the cropped viewport.
- **Fix direction:** Round up and keep the content where it is, or scale the content to an integer viewport.

### IMP-6. SVGs without `xmlns` import as empty groups and report success

- **Location:** `scripts/import/SvgLoader.ts:69-72` and `:139` (there's a TODO at `:53`)
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** Paste or import inline SVG copied from HTML (for example DevTools "Copy element" on an icon): `<svg viewBox="0 0 48 48"><path .../></svg>`.
- **Impact:** The elements are in the null namespace, so `instanceof SVGPathElement` fails. The path becomes an empty group, the viewBox is ignored (the viewport is 24 instead of 48), and the import reports success.
- **Fix direction:** Add the SVG namespace before parsing when it's missing.

### IMP-7. clipPath transforms are composed in the wrong order

- **Location:** `scripts/import/SvgLoader.ts:356` and `:369-370`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** `<clipPath transform="translate(10 0)"><path id="cp" transform="scale(2)" d="M0 0h5v5H0z"/></clipPath>` (the id stops svgo from baking the transform in), or a clip path whose own transform list has several entries.
- **Impact:** Both lists are reversed and concatenated path first, giving `P·C` instead of `C·P`, so the clip lands at x 20 to 30 instead of 10 to 20. The existing fixture only uses translations, which commute.
- **Fix direction:** Use `Matrix.flatten([...clipPathTransforms, ...pathTransforms])` without reversing.

### IMP-8. Bad `clip-path` references hide the element or fail the whole import

- **Location:** `scripts/import/SvgLoader.ts:117-123`, `:307-317`, and `:393-407`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** `clip-path="url(#missing)"`; a clip path whose own `clip-path` points at a missing id; clip paths that reference each other in a cycle; or a quoted `url('#c')`.
- **Impact:** A missing reference clips the element away entirely (`M 0 0 Z`), while browsers ignore the reference and draw it. The missing nested reference throws "Cannot destructure property 'pathInfos'", and the cycle throws "Maximum call stack size exceeded", failing the whole import with the generic snackbar. The quoted form isn't recognized, so the element imports unclipped.
- **Fix direction:** Ignore unresolved references, guard against cycles, and accept quoted URLs.

### IMP-9. `<use>` outside `<defs>`, `<symbol>`, and nested `<svg>` positioning are mishandled

- **Location:** `scripts/svgo/plugins/replaceUseElems.ts:23-25` and `:48-51`, and `scripts/import/SvgLoader.ts:205-221`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** `<path id="a"/><use href="#a" x="10"/>`; a `<symbol>` used by a `<use>`; a nested `<svg x="24" y="24" viewBox="0 0 12 12" width="24">`.
- **Impact:** The second copy of the path is lost, the symbol imports nothing, and the nested SVG is imported as a plain group at the wrong position and scale.
- **Fix direction:** Resolve `<use>` against every element with an id, and treat symbols and nested SVGs as a viewport transform (x and y plus viewBox scaling).

### IMP-10. Non-ASCII ids give empty layer names

- **Location:** `scripts/import/SvgLoader.ts:59-66` and `scripts/import/VectorDrawableLoader.ts:37-44`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** `id="图层"`, as Chinese, Japanese, and Russian Illustrator and Sketch exports write.
- **Impact:** `sanitize` strips every character and the prefix fallback isn't used, so layers are named `''`, `_1`, `_2`, and the exports write `android:name=""` and `id=""`. Related to UI-12.
- **Fix direction:** Fall back to the prefix when the sanitized value is empty.

### IMP-11. Percentage values import as NaN

- **Location:** `scripts/import/SvgLoader.ts:160` and `:163-171` (`Number()` isn't validated)
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** `fill-opacity="50%"` or `stroke-width="5%"`.
- **Impact:** `fillAlpha` and `strokeWidth` become NaN, which the setter keeps and the export writes as `"NaN"`.
- **Fix direction:** Parse percentages, and fall back to the default for values that aren't finite.

### IMP-12. `.shapeshifter` import keeps duplicate layer ids

- **Location:** `scripts/common/ModelUtil.ts:68-75`, called from `services/fileimport.service.ts:103` and `components/project/project.service.ts:25`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** A file with two layers that share an id. Files saved on the live site before the Cmd+G fix listed in `BUGS.md` can contain them.
- **Impact:** `layerIdMap[layer.id]` is overwritten, so both layers get the same new id (4 layers, 3 distinct ids in the test). The duplicates are never repaired, so selection, deletion, and block targeting stay ambiguous.
- **Fix direction:** Assign new ids per node while walking the tree, and rename or drop duplicates.

### IMP-13. Some files in a multi-file import silently stall the batch

- **Location:** `services/fileimport.service.ts:76-113` (no `else` branch, and the JSON branch never calls `maybeAddVectorLayersFn`), and `scripts/import/VectorDrawableLoader.ts:24-35` and `:104-117`
- **Severity:** low
- **Confidence:** confirmed by reading (the XML cases by a test)
- **Trigger:** Drop or pick several files where one is a type none of the branches match (for example a `.png` confirmed in the drop dialog, or "All files" in the picker), or where one is a `.shapeshifter` file next to SVGs.
- **Impact:** `numCallbacks` never reaches `files.length`, so the SVGs and VectorDrawables in the batch are silently not imported (with a `.shapeshifter` file in the batch, the workspace is reset to it instead). Separately, the VectorDrawable loader accepts any XML root: an AVD file imports wrapped in two extra groups with a 24x24 viewport, and a layout XML gives an empty vector layer, both reported as "Imported 1 layer".
- **Fix direction:** Count unsupported files as errors, don't mix `.shapeshifter` files into a layer import, require a `<vector>` root, and check for `parsererror`.

### IMP-14. A slow `?project=` fetch can overwrite work done in the meantime

- **Location:** `components/root/Root.tsx:91-113`
- **Severity:** low
- **Confidence:** plausible
- **Trigger:** On a slow connection, open `/?project=...`, then import or open a file (or a demo) before the fetch finishes.
- **Impact:** The late `ResetWorkspace` replaces the user's work without a prompt. The fetch is only aborted on unmount.
- **Fix direction:** Abort the fetch, or ignore its result, once any other import or reset happens.

## Export

### EXP-1. VD and AVD export write empty or unmorphable path data, which crashes Android at inflate time

- **Location:** `scripts/export/AvdSerializer.ts:133` (path `android:pathData`), `:152` (clip path), `:88-89` (path block `valueFrom` and `valueTo`), and `:85-94` (no `isAnimatable()` check)
- **Severity:** medium
- **Confidence:** confirmed by a test (the output), and by reading AOSP (the crash)
- **Trigger:** Add a path or clip path layer (`components/layertimeline/LayerTimelineController.ts:262-280` creates it with no path data) and export without giving it a path. Or animate the path of such a layer, or keep a path block whose from and to paths aren't morphable, and export the AVD.
- **Impact:** `conditionalAttrFn` only skips nil values, so `android:pathData=""`, `android:valueFrom=""`, and `android:valueTo=""` are written. The platform throws `IllegalArgumentException: Path string cannot be empty` for the drawable (`VectorDrawable.java:2026-2029` and `:1730-1733`, `libs/hwui/PathParser.cpp:228-230`) and for the animator (`AnimatorInflater.java:298-304`), and `InflateException("Can't morph ...")` for unmorphable paths (`AnimatorInflater.java:310-312`). The consuming app crashes when it inflates the drawable. The SVG exporter already skips empty paths.
- **Fix direction:** Skip layers without path data (or leave the attribute out), skip path blocks that aren't animatable, and warn before exporting.

### EXP-2. SVG export trims paths wrongly inside scaled groups

- **Location:** `scripts/export/SvgSerializer.ts:168-182`
- **Severity:** medium
- **Confidence:** confirmed by a test (including a render)
- **Trigger:** A trimmed path (for example `trimPathEnd` 0.5) inside a group whose scale isn't ±1, including frames of a scale animation.
- **Impact:** The length is measured after the canvas transform, but `stroke-dasharray` is interpreted in the path's local units under the `<g transform>`. A 10-unit line in `scale(2)` at 50% gets `stroke-dasharray="10,10"` instead of `5,5`, so the whole line shows. This affects SVG exports, SVG frames, and spritesheets. CANVAS-4 is the preview's version of the same mix-up, in the other direction.
- **Fix direction:** Always use the untransformed `pathData.getSubPathLength(0)`.

### EXP-3. SVG export can give two clip paths the same id

- **Location:** `scripts/export/SvgSerializer.ts:98-103`, `:112`, and `:117`
- **Severity:** medium
- **Confidence:** confirmed by a test (including a render)
- **Trigger:** A group with two clip path layers followed by layers named `path` and `path_1`, which are exactly the names `getUniqueName` generates.
- **Impact:** The chained ids `clip_<name>_<i>` collide with the base id of a layer named `<name>_<i>`, giving `clip_path`, `clip_path_1`, `clip_path_1`, and `clip_path_1_1`. Browsers resolve `url(#clip_path_1)` to the first match, so `path_1` is clipped by the wrong clip path. Sprite frames (`clip_frame<N>_...`) have the same problem.
- **Fix direction:** Use a separator that can't appear in names, or generate ids from a counter.

### EXP-4. SVG export omits `stroke-width` when it's 0, so a 1-unit stroke appears

- **Location:** `scripts/export/SvgSerializer.ts:165`
- **Severity:** low
- **Confidence:** confirmed by a test (including a render)
- **Trigger:** A path with a stroke color and a stroke width of 0, for example after animating the width down to 0, or a VD with `strokeColor` and no `strokeWidth`.
- **Impact:** The editor draws no stroke (`components/canvas/CanvasLayers.ts:215` requires a width), but the exported SVGs, frames, and sprites draw one with the SVG default width of 1.
- **Fix direction:** Write `stroke-width="0"`, or leave out `stroke` when the width is 0.

### EXP-5. Spritesheet frames aren't clipped to their cells

- **Location:** `scripts/export/SvgSerializer.ts:35-46` and `scripts/export/SpriteSerializer.ts:60-77`
- **Severity:** low
- **Confidence:** confirmed by a test (including a render)
- **Trigger:** Content that extends past the viewport, such as a slide-in, a rotation, or a stroke touching the edge.
- **Impact:** Each frame is only a `<g transform="translate(w*i, 0)">`, so overflow draws into the neighboring frames. Android and standalone SVGs clip at the viewport.
- **Fix direction:** Wrap each frame in a nested `<svg>` with `x`, `width`, `height`, and `viewBox`, or give each a rectangular clip path.

### EXP-6. Frame file names in the SVG zip are padded one digit short

- **Location:** `services/fileexport.service.ts:66`
- **Severity:** low
- **Confidence:** confirmed by reading
- **Trigger:** A duration whose frame count is a power of 10, for example 301 to 333 ms at 30 fps (`numSteps` 10).
- **Impact:** `createSvgFrames` returns frames 0 through `numSteps`, but the padding uses the length of `numSteps - 1`, so the files are `frame0` to `frame9` and then `frame10`, which sort out of order.
- **Fix direction:** Use `numSteps.toString().length`.

### EXP-7. The spritesheet CSS never rests on the last frame

- **Location:** `scripts/export/SpriteSerializer.ts:20-36`
- **Severity:** low
- **Confidence:** confirmed by reading
- **Trigger:** Play the generated HTML.
- **Impact:** The sprite has `numSteps + 1` frames, and `steps(numSteps)` shows frames 0 to `numSteps - 1` during the animation. Without `animation-fill-mode: forwards` the element snaps back to frame 0 when it ends, so a one-shot play-to-pause icon ends on the play icon.
- **Fix direction:** Add `animation-fill-mode: forwards`.

## Canvas

### CANVAS-1. The canvas paints the fill over the stroke

- **Location:** `components/canvas/CanvasLayers.ts:215-225`
- **Severity:** medium
- **Confidence:** confirmed by a test and by reading AOSP
- **Trigger:** Any path with both a fill and a stroke.
- **Impact:** `ctx.stroke()` runs before `ctx.fill()`, so the fill covers the inner half of the stroke. Android draws the fill first and the stroke on top (`libs/hwui/VectorDrawable.cpp`, `FullPath::draw`, lines 152-194), and so does SVG, so the exports are right. The preview shows strokes half as thick as on the device, and translucent fills blend wrongly.
- **Fix direction:** Fill first, then stroke.

### CANVAS-2. Split segments of fill-only paths can't be hovered or selected

- **Location:** `components/canvas/CanvasOverlay.ts:1016`, and `components/canvas/SelectionHelper.ts:38`, `:52`, `:212`, and `:227` (which call `performHitTest` without options)
- **Severity:** medium
- **Confidence:** confirmed by a test
- **Trigger:** Split a filled subpath that has no stroke, then click the orange split segment in selection mode.
- **Impact:** Without `withExtraSegmentPadding` the segment tolerance is 0 (plus half the stroke width, only if the path is stroked), so a fill-only path's split segment only registers at a distance of exactly 0. The click selects the subpath instead, and "Delete segment" is effectively unreachable for most icons, which are fill-only.
- **Fix direction:** Give segment hits in `SelectionHelper` a tolerance in viewport units, such as `withExtraSegmentPadding`, or one that matches the drawn highlight's width.

### CANVAS-3. Hit and snap tolerances ignore the group transform

- **Location:** `components/canvas/CanvasOverlay.ts:1005-1021` (`performHitTest`) and `:967-973` (`hitTestForLayer`), and wherever `projection.d` is compared with `minSnapThreshold` (lines 468, 546, 721, 752, and 811)
- **Severity:** medium
- **Confidence:** confirmed by a test
- **Trigger:** Enter action mode on a path inside a group scaled by something other than 1, which imported VectorDrawables often are.
- **Impact:** The mouse point is converted to layer coordinates, but the radii and thresholds are in viewport units and compared against layer-space distances. With scale 0.1, a click 3 CSS pixels from a point drawn with an 8 pixel radius misses it. With scale 10, a click 60 CSS pixels away hits it. Layer picking on the main canvas has the same problem.
- **Fix direction:** Divide the viewport-unit tolerances by `getCanvasTransformForLayer(...).getScaleFactor()`, or measure distances in viewport space.

### CANVAS-4. The trim path dash length uses the inverse matrix in scaled groups

- **Location:** `components/canvas/CanvasLayers.ts:182-192`
- **Severity:** medium
- **Confidence:** confirmed by a test
- **Trigger:** A trimmed path inside a scaled group, for example group scale 2, path `M 1 5 L 11 5`, and `trimPathEnd` 0.5.
- **Impact:** `executeCommands` draws the path in canvas units, but the length comes from the path transformed by `canvasToLayerMatrix`, so the dash period is off by the square of the scale. In the example `setLineDash` got `[2.5, 2.505]` instead of about `[10, 10.01]`, and four dashes were drawn instead of one run. Trim animations in scaled groups show repeating dashes (scale above 1) or don't trim (below 1). This is the same inverted matrix as the known stroke width bug in `BUGS.md`, but a separate symptom.
- **Fix direction:** Use `layerToCanvasMatrix`, and drop the `|a| !== 1 || |d| !== 1` shortcut, which misses rotations combined with a scale.

### CANVAS-5. Rulers show wrong coordinates when the viewport is bigger than the canvas

- **Location:** `components/canvas/CanvasRuler.ts:81-84` (`rulerZoom = Math.max(1, ...)`) and `components/canvas/CanvasController.ts:142-143` (`/ Math.max(1, this.cssScale)`)
- **Severity:** medium
- **Confidence:** confirmed by a test
- **Trigger:** Any viewport larger than its canvas in CSS pixels, for example a 512 or 1024 viewBox import, or almost anything in the three-canvas action mode.
- **Impact:** The tick labels and the mouse position label read CSS pixels as viewport units: the right edge of a 480-wide viewport in a 240 pixel canvas reads 240.
- **Fix direction:** Remove both clamps. Then also fix the loop condition at `components/canvas/CanvasRuler.ts:90` (`|| interval >= length` should be `&& interval < length`), which becomes an infinite loop once the clamp is gone and the zoom drops below 0.16.

### CANVAS-6. Canvases ignore devicePixelRatio changes

- **Location:** `components/canvas/CanvasLayoutMixin.ts:28-30` and `:48-54`, `components/canvas/CanvasLayers.ts:79-88`, and `components/canvas/CanvasOverlay.ts:327-334`
- **Severity:** low
- **Confidence:** confirmed by a test (with a simulated ratio change)
- **Trigger:** Drag the window between a Retina display and a 1x display. The CSS size doesn't change, so the ResizeObserver in `useElementSize` doesn't fire.
- **Impact:** `attrScale` reads the new ratio on every draw, but the backing store keeps the old size, so the drawing appears at half or double scale and clicks no longer line up, until something forces a resize.
- **Fix direction:** Listen for ratio changes with `matchMedia('(resolution: Ndppx)')`, or observe `device-pixel-content-box`, and rerun `onDimensionsChanged`.

### CANVAS-7. The trim path preview doesn't follow Android's rules for fills and later subpaths

- **Location:** `components/canvas/CanvasLayers.ts:181`, `:215`, and `:218`
- **Severity:** low
- **Confidence:** confirmed by a test (in part) and by reading hwui
- **Trigger:** A filled path with a trim, or a stroked path with several subpaths and a trim, for example `M 2 5 L 22 5 M 2 15 L 22 15` with `trimPathEnd` 0.5.
- **Impact:** Android trims the geometry itself and uses the trimmed path for the fill as well as the stroke, and `SkPathMeasure` only covers the first contour, so later subpaths aren't drawn (`VectorDrawable.cpp:84-138`). The editor only dashes the stroke, so the fill is never trimmed (and still appears when start equals end), and every subpath gets the same dash pattern: the example draws half of the second line, which Android doesn't draw at all.
- **Fix direction:** Build the trimmed path the way hwui does and use it for both, or document the difference.

### CANVAS-8. A selected clip path clips the highlights of later selected layers

- **Location:** `components/canvas/CanvasOverlay.ts:363-368` (`ctx.clip()` at line 367, with no save and restore around the recursion at line 389)
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** Select a clip path, then Cmd-click a layer later in the tree that lies outside the clip, even in another group.
- **Impact:** The clip leaks into the rest of the overlay traversal, so the other layer's selection outline disappears.
- **Fix direction:** Don't clip there, or wrap it in save and restore per group.

### CANVAS-9. Dragging a split point near another subpath is silently undone

- **Location:** `components/canvas/SelectionHelper.ts:125`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** `M 0 0 L 20 0 M 0 1 L 20 1` with a split point at (10, 0). Drag it to (5, 0.8), where the other subpath is closer.
- **Impact:** The preview snaps the point onto its own subpath at (5, 0), but on mouse up the re-projection isn't restricted to that subpath, so the point jumps back to where it started.
- **Fix direction:** Restrict the re-projection to `oldSubIdx`, as the drag preview at line 83 does.

### CANVAS-10. The shape splitter's hover highlight sticks after the mouse leaves

- **Location:** `components/canvas/ShapeSplitter.ts:183-192`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** In split subpaths mode on a filled path, move off the canvas while near a segment.
- **Impact:** `onMouseLeave` reruns the hit test instead of clearing `hitResult`, and returns without drawing when no drag is in progress, so the orange highlight and the preview point stay on screen.
- **Fix direction:** Clear `hitResult` and redraw, as `SegmentSplitter` does.

### CANVAS-11. Right and middle clicks start gestures

- **Location:** `components/canvas/Canvas.tsx:62-65`, `components/canvas/CanvasOverlay.ts:853`, `components/splitter/Splitter.tsx:52`, and `scripts/dragger/Dragger.ts:46-65`
- **Severity:** low
- **Confidence:** confirmed by reading (the stuck drag is plausible)
- **Trigger:** Right-click the canvas or a splitter. Nothing checks `event.button`.
- **Impact:** In add points mode a right-click adds a point and opens the context menu. In pair and split modes, right-clicking empty space leaves the mode. On the main canvas it selects a layer. If the context menu swallows the mouseup, a split point drag or a splitter resize keeps following the mouse until the next click, and the `Dragger` has no blur handling.
- **Fix direction:** Only handle `button === 0`, and cancel `Dragger` drags on blur.

## Layer timeline and UI

### UI-1. A click that ends a drag reaches the workspace and clears the selection or exits action mode

- **Location:** `components/root/Root.tsx:147`
- **Severity:** medium
- **Confidence:** confirmed by a test (Playwright)
- **Trigger:** Select a layer, then drag-select text in the inspector's name field and release over the canvas. Or in action mode, choose split subpaths and draw a line from the start canvas that ends over the middle canvas.
- **Impact:** When mousedown and mouseup land on different elements, the browser fires `click` on their nearest common ancestor, which is above the panels' `stopPropagation`, so `onClick` treats it as a click on empty workspace. The selection is cleared ("Select something to edit its properties"), or action mode drops back to Selection.
- **Fix direction:** Record the mousedown target and only clear when the press also started on the workspace background.

### UI-2. The inspector's typed text outlives undo and selection changes, and is applied to the wrong layer

- **Location:** `components/propertyinput/InspectedProperty.ts:43` (the entered value map is keyed only by property name), created at `components/propertyinput/PropertyInput.tsx:48`, with rows keyed by property name at `:131`
- **Severity:** medium
- **Confidence:** confirmed by a test and in the browser
- **Trigger:** Select a path, type "q" into its name field, press Cmd+Z twice (undoing the rename and then the selection; see STORE-6), then click the group layer.
- **Impact:** The group's name field shows "pathq", and typing in it renames the group based on the other layer's text. After one undo, the field keeps showing the undone text and the next keystroke silently reapplies it. Chromium doesn't fire blur when the focused input is removed, so the entry is never cleared.
- **Fix direction:** Key entered values by model id and property, and clear the map when the inspected model or the stored value changes.

### UI-3. Renaming a layer to a name that sanitizes to its current name adds `_1`

- **Location:** `components/propertyinput/buildPropertyInputModel.ts:150`
- **Severity:** medium
- **Confidence:** confirmed by a test
- **Trigger:** A layer named "path". Type "Path", "path " (trailing space), or "path!".
- **Impact:** `getUniqueLayerName([vl], ...)` finds the layer being renamed, so it becomes "path_1" while the field still shows what was typed. The new name shows up in AVD target names.
- **Fix direction:** Exclude the edited layer from the uniqueness check, or skip the update when the sanitized name equals the current one.

### UI-4. A single wheel zoom step doesn't keep the time cursor in place

- **Location:** `components/layertimeline/LayerTimelineController.ts:1000` and `:1011`
- **Severity:** medium
- **Confidence:** confirmed by a test (Playwright)
- **Trigger:** Zoom to fit a 300 ms animation, put the cursor at 240 ms, and Ctrl+wheel once (deltaY -100).
- **Impact:** The zoom goes from 3.64 to 9.85 but `scrollLeft` stays 0 (it should be 1489), so the time cursor jumps off screen. `performZoomFn` sets the zoom through React state, which renders later, and sets `scrollLeft` in the same frame, which the browser clamps to the old width. Trackpad pinches, made of many small events, work.
- **Fix direction:** Apply the scroll after the new width commits (for example with `flushSync` or a layout effect keyed on the zoom), or set the width imperatively first.

### UI-5. "Convert to clip path" is hidden if any layer has a non-path animation

- **Location:** `components/layertimeline/LayerListTree.tsx:48`
- **Severity:** medium
- **Confidence:** confirmed by a test (Playwright)
- **Trigger:** In the playtopause demo, the path only animates `pathData`, but the group animates `rotation`.
- **Impact:** The check looks at every block in the animation instead of this layer's blocks, so the path has no menu button at all. Deleting the group's rotation block brings it back. `swapLayers` already drops incompatible blocks. The Angular code had the same check.
- **Fix direction:** Only consider blocks with `b.layerId === layer.id`.

### UI-6. Shift-scaling several blocks of one property can make them overlap

- **Location:** `components/layertimeline/LayerTimelineController.ts:603` (and `:574` for the start edge)
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** Blocks [0, 100] and [100, 200] on the same property, both selected. Shift-drag the second block's end edge to 10 ms.
- **Impact:** The result is [0, 10] and [5, 15], two animations of one property at the same time, which is also exported that way. `MIN_BLOCK_DURATION` is enforced per block.
- **Fix direction:** Clamp the scale so every block keeps the minimum length, instead of pushing ends outward.

### UI-7. Shift-dragging a block's start edge moves its fixed end

- **Location:** `components/layertimeline/LayerTimelineController.ts:569`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** A block [100, 200]. Shift-drag its start edge to 199, or to 250.
- **Impact:** The block becomes [199, 209] or [250, 260], so the end that should stay fixed moves. Without Shift it clamps correctly to [190, 200]. The scale has no lower bound.
- **Fix direction:** Clamp the scale to at least `MIN_BLOCK_DURATION / (maxEndTime - minStartTime)`.

### UI-8. Snapping after clamping lets a multi-block move leave the animation

- **Location:** `components/layertimeline/LayerTimelineController.ts:457-478`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** Selected blocks A [250, 295] and B [100, 150], with A first in `animation.blocks`, and another layer's block ending at 108. Drag B right by 5 ms.
- **Impact:** A is clamped to +5, then B's snap raises the delta to +8, so A ends at 303 in a 300 ms animation. Near 0 the start clamps instead, and the blocks shift relative to each other.
- **Fix direction:** Snap first, then clamp against every block.

### UI-9. Up and Down arrows in name and color fields throw or change the value

- **Location:** `components/propertyinput/PropertyInput.tsx:86` and `:102`
- **Severity:** low
- **Confidence:** confirmed by a test and in the browser
- **Trigger:** Press ArrowUp in an empty or numeric name field, or in an empty color field (new paths have empty fill and stroke colors).
- **Impact:** `Number('')` is 0, so a number reaches `NameProperty.sanitize`, which throws "value.toLowerCase is not a function" (an uncaught error, reported to Bugsnag). A color field becomes `#000000`. The handler also skips the unique name transform.
- **Fix direction:** Only handle the arrows for number and fraction properties, and ignore empty input.

### UI-10. Modifier+Up does nothing on integer times, while modifier+Down subtracts 1

- **Location:** `components/propertyinput/PropertyInput.tsx:100`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** A block's start time of 50. Cmd+Up (Ctrl+Up elsewhere) leaves it at 50, and Cmd+Down gives 49.
- **Impact:** The ±0.1 step goes through `Math.floor` for integer properties, so only one direction moves.
- **Fix direction:** Round instead of flooring, or use a step of 1 for integer properties.

### UI-11. Recursive collapse leaves child paths stuck collapsed

- **Location:** `components/layertimeline/LayerListTree.tsx:66` and `components/layertimeline/TimelineAnimationRow.tsx:29`, with the ids added at `services/layertimeline.service.ts:157`
- **Severity:** low
- **Confidence:** confirmed by a test and in the browser
- **Trigger:** In playtopause, Shift-click the group's chevron, then click it again without Shift.
- **Impact:** The path row comes back, but its `pathData` row and block stay hidden, and paths have no chevron, so they can't be expanded on their own.
- **Fix direction:** Only collapse groups and the vector layer, or treat layers that can't expand as always expanded.

### UI-12. Empty layer and animation names are accepted

- **Location:** `components/propertyinput/buildPropertyInputModel.ts:150` (and `:238` for the animation)
- **Severity:** low
- **Confidence:** confirmed by a test and in the browser
- **Trigger:** Clear the name field and blur.
- **Impact:** The name is stored as `""`, the layer list shows a blank row, and the AVD export writes `android:name=""`.
- **Fix direction:** Keep the previous name when the sanitized value is empty.

### UI-13. The inspector accepts block times that the timeline would reject

- **Location:** `components/propertyinput/buildPropertyInputModel.ts:206` (there's a TODO at `components/propertyinput/PropertyInput.tsx:42`)
- **Severity:** low
- **Confidence:** confirmed by reading
- **Trigger:** Set a block's end time below its start time, past the animation's duration, or overlapping another block of the same property.
- **Impact:** The values are stored as typed. An end before the start exports a negative `android:duration` (`scripts/export/AvdSerializer.ts:84`), until MODEL-7 silently swaps it on the next clone.
- **Fix direction:** Validate or clamp against the block's neighbors and the duration when committing.

### UI-14. The wheel zoom can start from a stale zoom level

- **Location:** `components/layertimeline/LayerTimelineController.ts:1024` and `:1036`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** Zoom in to the maximum, pause, scroll one more notch, then zoom to fit (or load a project), then zoom out slightly.
- **Impact:** The zoom jumps to about 9.05 instead of about 3.3. The clamped extra notch leaves `targetHorizZoom` at the maximum, and the timer that resets it only runs when the zoom changes. The same happens at the minimum.
- **Fix direction:** Reset `targetHorizZoom` when the clamped value equals the current zoom, and in `autoZoomToAnimation`.

### UI-15. The timeline header draws time labels past the end of the animation

- **Location:** `components/layertimeline/TimelineGridRenderer.ts:121`
- **Severity:** low
- **Confidence:** confirmed by a test
- **Trigger:** A 320 ms animation at zoom 2.
- **Impact:** A "0.325s" label is drawn in the right padding. The label loop runs to the canvas width, while the grid lines stop at `width - 2 * padding`.
- **Fix direction:** Bound the loop by `width - 2 * TIMELINE_ANIMATION_PADDING`.

### UI-16. File > Open and the demos replace the workspace without the prompt that New shows

- **Location:** `components/layertimeline/LayerTimelineController.ts:199` and `:1075`
- **Severity:** low
- **Confidence:** confirmed by reading
- **Trigger:** Edit the workspace, then open a file or a demo.
- **Impact:** The workspace is replaced without the "Start over?" confirmation. It can be undone with Cmd+Z, and the Angular code behaved the same way.
- **Fix direction:** Reuse the dirty-workspace confirmation.

## Build, PWA, e2e tests, and tooling

### CFG-1. Unhashed files in `public/assets/` are precached without a revision and never update

- **Location:** `vite.config.ts:24` (the workbox options don't set `dontCacheBustURLsMatching`). The affected files are `public/assets/shapeshifter.png`, `public/assets/icons/*.png`, and `public/assets/cursor/*.png`.
- **Severity:** low (latent)
- **Confidence:** confirmed by a test (a build with the service worker installed in Chromium)
- **Trigger:** Change one of those files (for example the manifest icon, or the play and pause sprites that `playback.scss` uses) and deploy.
- **Impact:** vite-plugin-pwa defaults `dontCacheBustURLsMatching` to `^assets/`, assuming everything in `dist/assets/` has a hash in its name, but `public/assets/` is copied there unhashed. The generated `sw.js` lists them with `revision: null`, and Workbox keeps an entry that's already cached, so users with the service worker keep the old file indefinitely. In the test, a replaced `assets/shapeshifter.png` was still served at its old size after the new worker took control, while a changed demo was updated.
- **Fix direction:** Move the images out of `public/assets/` (for example to `public/images/`, updating `root.scss`, `playback.scss`, and `manifest.json`), set `dontCacheBustURLsMatching` to a pattern that matches Vite's hashes, or import the images so Vite hashes them.

### CFG-2. `navigateFallback` serves the app for every uncached navigation

- **Location:** `vite.config.ts:33`
- **Severity:** low
- **Confidence:** confirmed by a test (a build with the service worker installed in Chromium)
- **Trigger:** With the service worker installed, navigate to `/assets/screencap.jpg` (the `og:image`), a `.js.map` file, `/ngsw-worker.js`, a file in `/assets/paper/`, or a mistyped path such as `/foo/bar`.
- **Impact:** Each returns the app (200, `text/html`, from the service worker) instead of the file or a 404. On a nested path the app loads, but relative fetches such as `demos/x.shapeshifter` resolve under that path and fail.
- **Fix direction:** Add `navigateFallbackAllowlist: [/^\/(index\.html)?(\?|$)/]`. Workbox matches these against the pathname plus the search string, so an extension-based denylist such as `/\.\w+$/` would also match `/?project=demos/playtopause.shapeshifter` and break offline project links.

### CFG-3. The "doesn't reload open pages" test passes even without `onNeedReload`

- **Location:** `e2e/offline.preview.spec.ts:114-134`, which guards `src/main.tsx:44`
- **Severity:** low
- **Confidence:** confirmed by a test (patched builds with `onNeedReload` counting its calls, and with it removed)
- **Trigger:** Delete `onNeedReload` from `src/main.tsx` and run the test. It still passes.
- **Impact:** The test registers the new worker on the first visit, when the page isn't controlled yet, so workbox-window reports `isUpdate` false and vite-plugin-pwa's reload branch never runs. The only test guarding "don't reload open pages" can't catch a regression. With one reload first, a removed `onNeedReload` did reload the page.
- **Fix direction:** After "Ready to work offline", reload the page and wait for the toolbar, then set the marker and register `/sw.js?v=2`.

### CFG-4. The zoom test's "page doesn't scroll or zoom" check can't fail

- **Location:** `e2e/interactions.spec.ts:38-39`
- **Severity:** low
- **Confidence:** confirmed by a test (in Chromium, Firefox, and WebKit)
- **Trigger:** Remove the timeline's `preventDefault` on wheel events. The assertion still passes.
- **Impact:** `html` and `body` have `overflow: hidden` (`styles/root.scss:1-8`), the wheel scrolls up from `scrollY` 0, and `scrollY` can't see browser zoom. A Ctrl+wheel over an element with no handler left `scrollY` at 0 and `visualViewport.scale` at 1 in every browser.
- **Fix direction:** Record the wheel event in a capture-phase window listener and assert `defaultPrevented`, or assert on the timeline's scroll position.

### CFG-5. The Space-in-dialog check races the 300 ms demo

- **Location:** `e2e/interactions.spec.ts:153-174`
- **Severity:** low
- **Confidence:** confirmed by reading
- **Trigger:** A regression where Space isn't ignored in dialogs, on a slow runner.
- **Impact:** The snapshot records `isPlaying` but not the current time. The playtopause demo would play and finish within 300 ms, setting `isPlaying` back to false, so the snapshot matches again and the regression slips through. `e2e/AGENTS.md` itself advises turning on repeat for this.
- **Fix direction:** Add the current time to the snapshot, or turn on repeat first.

### CFG-6. Screenshots from the three browsers overwrite each other

- **Location:** `e2e/canvas.spec.ts:33` and `:72`, `e2e/timeline.spec.ts:18`, and `e2e/panels.spec.ts:77` and `:84`
- **Severity:** low
- **Confidence:** confirmed by reading
- **Trigger:** Any run with more than one browser project, as CI does.
- **Impact:** The tests write to fixed `test-results/*.png` paths, so parallel Chromium, Firefox, and WebKit runs overwrite each other and a CI failure artifact shows an arbitrary browser.
- **Fix direction:** Use `test.info().outputPath('canvas-playing.png')`.

### CFG-7. Prettier and oxlint scan `.claude/worktrees/`

- **Location:** `.gitignore` (no entry) and `.prettierignore:1`
- **Severity:** low (dev tooling)
- **Confidence:** confirmed by a test (probe directories under `.claude/`)
- **Trigger:** Run `npm run format:check`, `npm run lint`, or `npm run format` in the main checkout while Claude Code worktrees exist.
- **Impact:** `format:check` checks every worktree, including their `dist/` bundles, and fails. `lint` lints other sessions' in-progress code. `npm run format`, which the repo's Claude Code settings pre-approve, rewrites files in other sessions' worktrees.
- **Fix direction:** Add `.claude/worktrees/` to `.gitignore`, which both tools honor.

## Checked and ruled out

### Path model

- Index mapping between drawn and internal commands held up in the fuzz for reverse, shift, split, unsplit, convert, and the project-then-split and hit-test-then-split flows, apart from PATH-8.
- `PathState.findCommandStateInfo` wraps ids with `-= n` while the mutator uses `n - 1`. This only rotates which id a drawn command gets. Ids stay unique, and nothing outside the model reads them.
- `PathState.getBoundingBox` only looks at the roots, but action mode edits keep the geometry and it's only used for group highlight rectangles.
- Filled splits from point 0, `deleteFilledSubPathSegment`, and `deleteFilledSubPath` with nested splits are correct.
- `NeedlemanWunsch`'s DP and backtracking are consistent, and `M` never aligns with anything else. `orderSubPaths` and its `moveSubPath` bookkeeping are correct.
- The parser matches Chromium for S and T after non-curves and after C and Q, relative s and t, implicit repeats, `Z` followed by L or l, relative m after z, `1e-5`, `2E+1`, `.5.5`, `-.5`, H and V, and missing spaces.
- The 3-decimal writer turns -0 and tiny values into "0" and never writes exponents at realistic sizes.
- Arc radius scaling (the 1.99999 factor) moves the center by about 0.3% of the radius, as Android's parser does.
- Raw `autoFix` output isn't always morphable (21 of 100 random shape pairs), but `ActionModeService` reruns `autoConvert`, after which all of them were.
- `findTimeByDistance`'s ±0.25 search window is approximate by design and only fails on extreme straight cubics.
- `src/test/PathUtil.ts` doesn't hide bugs: chaining ops on one mutator matched rebuilding between ops in the fuzz.

### Store and services

- No Sets from the store are changed in place, and no frozen model objects are mutated: the services clone first, and the `LayerTimelineService` getters copy the Sets.
- `queueNestedDispatches`: no subscriber reads `getState()` right after dispatching, and the queue is cleared in `finally`.
- The batch meta reducer handles empty batches and a `ResetWorkspace` inside a batch, and `isRecorded` is correct for batches.
- Undo can't leave action mode pointing at a missing block, because the mode and the block selection come from the same snapshot (except through STORE-3).
- Playback rAF loops and timeouts are cancelled in `pause()` and `dispose()`, two loops can't run at once, and a duration of 0 is impossible (the minimum is 100).
- The shortcut and clipboard services' `init` is idempotent and StrictMode-safe, and `destroy` only removes their own listeners.
- Deleting several points in action mode sorts the ops in descending order, so indices stay valid.
- The first action after the store is created has no timestamp, which makes the comparison NaN, but that just starts a new group.
- **Duplicate names from two quick SVG pastes (reported by one agent, ruled out):** the names are chosen in a `.then` after the synchronous svgo call, so a spec that dispatches two paste events back to back can produce duplicates. Real pastes are separate input tasks, and the microtasks from the first finish before the second event arrives, so it can't happen in the app. Multi-file imports are safe for the same reason (each FileReader `onload` is its own task, and `addedVls` is updated before the next one).

### Layers, properties, timeline, and rendering

- Group transform order (`getCanvasTransformsForGroupLayer` builds T(pivot)·T(translate)·R·S·T(-pivot)) matches Android, and `Matrix.flatten` composes parents correctly.
- `Matrix.rotation` uses degrees with the SVG and Android orientation (its "counter clockwise" comment is misleading in y-down coordinates, but the math is right). `Matrix.invert` returns undefined at a zero determinant, and callers check. `getScaleFactor` matches Android's `getMatrixScale`.
- All 11 interpolator formulas and their `androidRef`s match AOSP, and `BezierEasing` matches bezier-easing, with exact results at 0 and 1.
- `AnimationRenderer` never divides by zero, uses the next block's `fromValue` at a shared boundary, skips blocks for missing layers and properties, and only mutates its own clone.
- `regenerateModelIds` remaps nested children, block ids, block layer ids, and hidden ids (apart from duplicates, IMP-12).
- `toStrokeDashArray` and `toStrokeDashOffset` match hwui's `applyTrim` for in-range values.
- Layer JSON defaults are stripped and restored symmetrically, unknown layer types throw and are caught by the import, and `clone()` copies the children arrays.
- `EnumProperty` replaces invalid values, and `NumberProperty.setEditableValue` ignores NaN.
- `androidToCssHexColor`'s `#RRGGBBAA` output is supported by browsers and by Android Studio's SVG converter.
- `MathUtil.areCollinear` treats everything as collinear when the first two points coincide, but only its spec uses it, and `TransformUtil` is only used by the paper.js editor.

### Import and export

- The SVG group transform string and the AVD attribute order both match Android's `T(t + p)·R·S·T(-p)`.
- `fillType` and `fill-rule`, value types, interpolator references, and integer `startOffset` and `duration` are all correct.
- The AVD `aapt:attr` structure and namespaces are right, attribute escaping is correct, and names are sanitized. `XmlSerializer.serializeNamespace` receives a boolean instead of its options, but that code is dead because every root declares its own namespaces.
- No XSS: the only `dangerouslySetInnerHTML` (`components/icons/Icon.tsx:93`) renders bundled SVGs, and layer names are rendered as text.
- A color block with an empty value doesn't crash `AnimatorInflater` (an existing spec covers it).
- Import stroke width scaling uses Android's minimum-scale formula.
- svgo: `removeUselessStrokeAndFill` never reaches clip path content, `applyTransforms` skips paths with `url()` references, and the global `floatPrecision` of 6 applies to every plugin.
- Figma's clip path pattern, `width="100%"`, millimeter units, `rgba()` and `hsl()`, and viewBox offsets import correctly.
- `.shapeshifter`: blocks for missing layers are filtered, `regenerateModelIds` runs for file imports and `?project=`, and the multi-animation format only existed in 2017 betas.
- The imported vector layer's `_1` name suffix is harmless, since `importLayers` discards the imported vector's name.

### Canvas

- `Canvas.tsx` creates and disposes its controller per `[actionSource, store, services]`, and StrictMode's double run unsubscribes cleanly.
- `useElementSize` disconnects its ResizeObserver, `useStoreEffect` is only used with module-level selectors, and `useScrollGroup` removes its listeners.
- `Dragger` removes its listeners on mouseup (apart from CANVAS-11). `Splitter` doesn't clamp a restored size, which is recoverable by dragging.
- `mouseEventToViewportCoords` uses the overlay's rectangle and CSS scale correctly.
- Zoom and pan are dead code, since the paper slice never changes.
- Clip paths in `CanvasLayers` are scoped by the group's save and restore, which matches Android, and the vector alpha composite is correct.
- `CanvasUtil.executeCommands` handles the first `M`'s missing start point, fragmented command lists, and `Z`.
- The known pair subpaths hover fix is intact, and hidden layers are skipped in drawing and hit testing.
- `ShapeSplitter`'s `lastCmdOffset` is correct for all six endpoint and segment combinations.
- `SelectionHelper:124` reuses a mutator after `build()`, against the paths `AGENTS.md` rule, but only to call `splitCommand`, which reassigns rather than mutating, and the result is transient.

### Layer timeline and UI

- Dialog promises resolve on Cancel, Escape, the backdrop, and when another dialog opens.
- `useDropTarget` handles child-to-child enter and leave order and non-file drops.
- The `?project=` fetch from StrictMode's first run is aborted, and the catch checks `signal.aborted`.
- The `beforeunload` prompt works. "Dirty" means non-empty, so it also prompts right after saving, as the original did.
- `PanelErrorBoundary`'s "Try again" resets and reports correctly.
- List keys are ids, or property names that are unique within their list.
- Layer drag-to-reorder blocks dropping into itself or a descendant, and single-block moves and plain edge drags are bounded correctly.
- The toolbar's shortcut hints match `services/shortcut.service.ts`.
- Number fields ignore `''`, `'-'`, and whitespace, and accept `'1e3'`.
- Clicks in enum menus and the "Animate this layer" menus come through portals, and the workspace's `contains()` check ignores them.

### Build, PWA, e2e tests, and security

- All 5 demos in `public/demos/` match `scripts/demos/index.ts`, load without dropped blocks, and export to AVD and SVG.
- `public/ngsw-worker.js` deletes the old `ngsw:` caches, unregisters on activate, has no fetch handler, can't clash with `/sw.js`, and is excluded from the precache.
- The precache has 52 entries and no source maps, service worker scripts, or paper.js assets, and the bundle is under the 4 MB limit.
- `skipWaiting` with `clientsClaim` and an old tab open: the only lazily loaded hashed assets are font subsets and the workbox-window chunk, so nothing realistic breaks.
- `onNeedReload` is a real vite-plugin-pwa option and does prevent reloads for returning users (the problem is only the test, CFG-3).
- Both browser skips in `e2e/offline.preview.spec.ts` still hold on Playwright 1.63, and `document.fonts.check` in the offline test is meaningful in Chromium and Firefox.
- No missing awaits, no `expect.poll` without a matcher, and no fixed timeouts in `e2e/`. The `modifier` fixture uses the same expression as the app.
- CI takes Node from `.nvmrc`, installs browsers before the Vitest browser project runs, and uses matching Playwright versions. `.npmrc`'s `min-release-age` is a real npm 11 setting.
- `tsconfig.json` excludes match the oxlint ignore list.
- Bugsnag only reports from `https:` on `*.shapeshifter.design` (an anchored regex), and the only metadata is the panel name and component stack. GA4 event names are valid and only sent from the site.
- Security: the only `dangerouslySetInnerHTML` renders bundled `?raw` SVGs. The loaders' `DOMParser` documents are never attached to the page. There's no `eval`, `new Function`, `document.write`, `insertAdjacentHTML`, `outerHTML`, `window.open`, or `location` assignment in compiled code. `?project=` goes through `fetch(url)` (`components/project/project.service.ts:19`), which can't run `javascript:` URLs, only reads data from `data:` and `blob:`, and sends no cookies cross-origin, and the result is parsed as JSON. A crafted project with markup in its names, sizes, and colors produced no `<script>` in the SVG, AVD, or sprite exports: names were escaped and numbers coerced.
- `public/assets/paper/` and `public/assets/tools/` are deployed but not precached or used by compiled code. That's dead weight, not a bug.
- `consoleErrors.length = 0` in `e2e/app.spec.ts` also clears unexpected errors, which is a documented tradeoff.
