# Layers and properties bugs found by the 2026-09-25 sweep

- **Flattening a group mis-decomposes mirrored or rotated nested groups.** Flattening a group
  whose child group is mirrored, rotated by more than 90 degrees, or rotated with a non-uniform
  scale moves or flips that group's content. `getScaling` and `getRotation` are only right for
  uniform positive scales. Use `atan2(b, a)` for the rotation and `hypot(a, b)` and the
  determinant for the scales, and refuse to flatten skews (`scripts/common/Matrix.ts`, used by
  `flattenGroupLayer`). (MODEL-1, medium, confirmed by a test)
- **Merging viewports of different sizes misplaces the content.** Importing a 24x12 SVG into a
  non-empty 48x48 project puts it at the bottom instead of the middle, and content in rotated or
  scaled groups moves sideways. The offsets are in scaled units but applied before scaling, and to
  every path. Apply them once, after scaling, at the top level (`model/layers/LayerUtil.ts`,
  `adjustViewports`). (MODEL-2, medium, confirmed by a test)
- **Importing a larger SVG into an animated project breaks the existing animation.** Importing a
  48x48 SVG into a 24x24 project rescales the existing layers but not their blocks, so during
  playback animated paths and translations jump back to the old scale. `adjustViewports` could
  return its transform so `importLayers` can apply it to the blocks, or the import could fit the
  new layers into the existing viewport (`model/layers/LayerUtil.ts`). (MODEL-3, medium, confirmed
  by a test)
- **Before a delayed block starts, the preview shows the static value, unlike Android 7.1+.**
  Before a block that starts after 0, the preview and the SVG and sprite exports show the layer's
  own value, then jump to the block's `fromValue`. Since API 25, AVDs show the `fromValue` from
  the start. Matching that (with the `fromValue` of the block that ends first) is a judgment call,
  and documenting it may be enough (`scripts/animator/AnimationRenderer.ts`). (MODEL-4, medium,
  confirmed by reading)
- **Invalid and partial colors become black, and garbage hex is accepted.** The property panel
  commits every keystroke, so typing `#00ff00` flashes black several times, and a typo like
  `#12345` turns the color black. `#1z1z1z` in a file is accepted and exported, and SVG
  `currentColor` and gradients import as black. `svgToAndroidColor` should reject invalid colors,
  and `setEditableValue` should ignore them (`scripts/common/ColorUtil.ts`,
  `model/properties/ColorProperty.ts`). (MODEL-5, low, confirmed by a test)
- **Color interpolation doesn't use Android's linear color space.** Halfway from `#ff0000` to
  `#0000ff` the preview shows `#800080`, but Android 8.0 (API 26) and later interpolate in linear
  RGB and show about `#ba00ba`, so the preview and the SVG and sprite exports are darker than
  those devices mid-block. Android 7.x matches the preview, so switching to linear is a judgment
  call (`model/properties/ColorProperty.ts`, `interpolateValue`). (MODEL-6, low, confirmed by a
  test)
- **An end time of 0 turns into 100, and inverted times flip on the next clone.** An end time of
  0, which the property panel allows, becomes 100 the next time the animation is cloned or loaded,
  because of `obj.endTime || 100`. A start time after the end time is stored as entered, then
  swapped by the next unrelated edit. Use `??`, and normalize or reject inverted times when they're
  set (`model/timeline/AnimationBlock.ts`). (MODEL-7, low, confirmed by a test)
- **Overshooting fraction animations are clamped in the preview but wrap on Android.** Animating
  `trimPathEnd` from 0 to 1 with an overshoot interpolator shows the whole path in the preview,
  which clamps fractions to 1, but Android wraps 1.05 to 0.05 and draws 5% of it. Model the
  wrapping, or warn about overshooting interpolators on fraction properties
  (`model/properties/FractionProperty.ts`). (MODEL-8, low, confirmed by reading)
- **The selection box of rotated or mirrored groups is wrong.** A group rotated 45 degrees gets a
  selection outline that collapses to a line, and a mirrored subgroup's content falls outside it.
  `GroupLayer.bounds` only transforms two corners of its children's bounds, and should transform
  all four (`model/layers/Layer.ts`). (MODEL-9, low, confirmed by a test)
- **Decimal commas are silently truncated in number fields.** Typing `1,5`, as people in
  comma-decimal locales do, stores 1, since `parseFloat` stops at the comma. Accept the comma, or
  reject input that isn't a number (`model/properties/NumberProperty.ts`). (MODEL-10, low,
  confirmed by a test)
