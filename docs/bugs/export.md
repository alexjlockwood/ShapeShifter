# Export bugs found by the 2026-09-25 sweep

- **VD and AVD export write empty or unmorphable path data, which crashes Android at inflate
  time.** A new path or clip path layer has no path data, and exporting it writes
  `android:pathData=""` (and empty `valueFrom` and `valueTo` if it's animated). Android throws
  when inflating those, and when a path block isn't morphable, so the app crashes. Skip layers
  without path data and blocks that can't animate, and warn before exporting
  (`scripts/export/AvdSerializer.ts`). (EXP-1, medium, confirmed by a test and by reading AOSP)
- **SVG export trims paths wrongly inside scaled groups.** The trim length is measured after the
  canvas transform instead of in the path's own local units, so `stroke-dasharray` is wrong by the
  group's scale factor for SVG exports, frames, and spritesheets
  (`scripts/export/SvgSerializer.ts`). (EXP-2, confirmed by a test; a candidate fix exists on the
  unmerged `alex/fix-sweep-quick-wins` branch, needs a rebase before reuse. The canvas preview has
  the same mix-up in the opposite direction, see CANVAS-4 in `docs/bugs/canvas.md`.)
- **SVG export can give two clip paths, or a clip path and a layer, the same id.** The generated
  ids only separate some parts with an underscore, so a clipped layer and an unrelated layer or
  clip path can collide, and the wrong one gets clipped (`scripts/export/SvgSerializer.ts`).
  (EXP-3, confirmed by a test; a candidate fix exists on the unmerged `alex/fix-sweep-quick-wins`
  branch, needs a rebase before reuse. It doesn't cover hand-edited project files with unsanitized
  names, see `docs/bugs/import.md`.)
- **SVG export omits `stroke-width` when it's 0.** A stroked path whose width has animated or been
  set to 0 exports with no `stroke-width` attribute, so it falls back to the SVG default of 1 and
  draws a stroke the editor doesn't show (`scripts/export/SvgSerializer.ts`). (EXP-4, confirmed by
  a test; a candidate fix exists on the unmerged `alex/fix-sweep-quick-wins` branch, needs a
  rebase before reuse)
- **Spritesheet frames aren't clipped to their cells.** Content that goes past the viewport, like
  a slide-in, a rotation, or a stroke at the edge, draws into the neighboring frames, since each
  frame is only translated. Wrap each frame in a nested `<svg>`, or clip it
  (`scripts/export/SpriteSerializer.ts`, `createSvgSprite`). (EXP-5, low, confirmed by a test)
- **Frame file names in the SVG zip are padded one digit short.** The zero padding is sized from
  `numSteps - 1` instead of `numSteps`, so exports whose frame count is a power of 10 produce
  `frame0` through `frame10`, which sort out of numeric order
  (`services/fileexport.service.ts`). (EXP-6, confirmed by a test; a candidate fix exists on the
  unmerged `alex/fix-sweep-quick-wins` branch, needs a rebase before reuse)
- **The spritesheet CSS never rests on the last frame.** Without `animation-fill-mode: forwards`,
  the sprite snaps back to frame 0 when it ends, so a one-shot play-to-pause icon ends on the play
  icon. Add it (`scripts/export/SpriteSerializer.ts`, `createCss`). (EXP-7, low, confirmed by
  reading)
