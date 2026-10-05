# Shape Shifter model docs

This document describes the model objects that make up a Shape Shifter project.

## `Layer`

Each Shape Shifter project is composed of a tree of `Layer` objects. The `Layer`s that make up this tree are displayed in the bottom left panel of the UI.

Every `Layer` object has a unique string `id` field. No two layers in a project will ever share the same `id`.

Every `Layer` type has a set of "inspectable" properties. When the layer is selected, these properties will be listed in the far right rectangular panel of the UI. A subset of these properties may be "animatable", meaning that they can be animated in the timeline at the bottom of the UI. Properties will take on one of the following value types:

- `integer` - A numeric value expressed as an integer.
- `float` - A numeric value expressed as a decimal.
- `string` - A string containing plain text.
- `color string` - A string representing an ARGB color. May be in one of the following formats: `#RGB`, `#RRGGBB`, or `#AARRGGBB`.
- `path string` - A string representing an SVG path. The contents of the string uses the SVG path data spec notation.
- `enum string` - A string representing an enum, meaning it will take on one of some fixed number of values.

There are currently four types of `Layer`s (all of which extend an abstract `Layer` base class):

### `VectorLayer`

This is the root node of the `Layer` tree and holds a list of 0 or more children `Layer`s. When you create a new Shape Shifter project, the project will consist of just a single empty `VectorLayer` object named `vector`. There will only ever be one `VectorLayer` object in a Shape Shifter project. This `Layer` is similar to the `<svg>` node in an SVG and/or the `<vector>` node in a `VectorDrawable`.

#### Properties

- `name` (string) - A unique name for the layer to be displayed in the UI.

- `children` (list of `Layer`s) - A list of children `Layer`s.

- `canvasColor` (color string) - An ARGB hex string describing the canvas background color. This value is currently only used by the Shape Shifter UI (it's not used at all in any of the export options).

- `width` (integer) - An integer greater than `0` describing the viewport width of the canvas.

- `height` (integer) - An integer greater than `0` describing the viewport height of the canvas.

- `alpha` (float, animatable) - A float value in the interval `[0,1]` describing the opacity of the layer tree. Default value is `1`.

### `GroupLayer`

A `GroupLayer` defines a group of 0 or more children `Layer`s. It has several properties that allow you to apply transformations on its children `Layer`s as well. Transformations are defined in viewport space (i.e. in terms of the viewport width/height set on the root `VectorLayer` node). Transformations are applied in the order of scale, rotation, and then translation. Similar to the `<g>` node of an SVG and/or the `<group>` node of a `VectorDrawable`.

#### Properties

- `name` (string) - A unique name for the layer to be displayed in the UI.

- `children` (list of `Layer`s) - A list of children `Layer`s.

- `rotation` (float, animatable) - A float value describing the rotation of the group. Default value is `0`.

- `scaleX` (float, animatable) - A float value describing the amount to scale in the x-direction. Default value is `1`.

- `scaleY` (float, animatable) - A float value describing the amount to scale in the y-direction. Default value is `1`.

- `pivotX` (float, animatable) - A float value (defined in viewport space) describing the x-coordinate of the pivot used to scale/rotate the group. Default value is `0`, but groups added in the app start at the center of the canvas (`LayerUtil.getCenterPivot`).

- `pivotY` (float, animatable) - A float value (defined in viewport space) describing the y-coordinate of the pivot used to scale/rotate the group. Default value is `0`, but groups added in the app start at the center of the canvas.

- `translateX` (float, animatable) - A float value (defined in viewport space) describing the amount to translate in the x-direction. Default value is `0`.

- `translateY` (float, animatable) - A float value (defined in viewport space) describing the amount to translate in the y-direction. Default value is `0`.

### `PathLayer`

A `PathLayer` allows us to draw filled and/or stroked shapes to the canvas. Similar to the `<path>` node of an SVG and/or the `<path>` node of a `VectorDrawable`.

#### Properties

- `name` (string) - A unique name for the layer to be displayed in the UI.

- `pathData` (path string, animatable) - A string describing the path's SVG path data. Similar to the `d` attribute of an SVG and/or the `android:pathData` attribute in a `VectorDrawable`. Default value is `undefined`.

- `fillColor` (color string, animatable) - An ARGB hex string representing the path's fill color. Similar to the `fill` attribute of an SVG and/or the `android:fillColor` attribute in a `VectorDrawable`. Default value is `undefined`.

- `fillAlpha` (float, animatable) - A float value in the interval `[0,1]` representing the path's fill opacity. Similar to the `fill-opacity` attribute of an SVG and/or the `android:fillAlpha` attribute in a `VectorDrawable`. Default value is `1`.

- `strokeColor` (color string, animatable) - An ARGB hex string representing the path's stroke color. Similar to the `stroke` attribute of an SVG and/or the `android:strokeColor` attribute in a `VectorDrawable`. Default value is `undefined`.

- `strokeAlpha` (float, animatable) - A float value in the interval `[0,1]` representing the path's stroke opacity. Similar to the `stroke-opacity` attribute of an SVG and/or the `android:strokeAlpha` attribute in a `VectorDrawable`. Default value is `1`.

- `strokeWidth` (float, animatable) - A float value greater than or equal to `0` representing the path's stroke width. Similar to the `stroke-width` attribute of an SVG and/or the `android:strokeWidth` attribute in a `VectorDrawable`. Default value is `0`.

- `strokeLinecap` (string enum) - An enum value of either `butt`, `round`, or `square`. Similar to the `stroke-linecap` attribute of an SVG and/or the `android:strokeLineCap` attribute in a `VectorDrawable`. Default value is `butt`.

- `strokeLinejoin` (string enum) - An enum value of either `miter`, `round`, or `bevel`. Similar to the `stroke-linejoin` attribute of an SVG and/or the `android:strokeLineJoin` attribute in a `VectorDrawable`. Default value is `miter`.

- `strokeMiterLimit` (float) - A float value that is greater than or equal to `1` that represents the path's stroke miter limit. Similar to the `stroke-miterlimit` attribute of an SVG and/or the `android:strokeMiterLimit` attribute in a `VectorDrawable`. Default value is `4`.

- `trimPathStart` - (float, animatable) - A float value in the interval `[0,1]` that represents the path's trim path start value (see this blog post for an in-depth explanation: https://j.mp/icon-animations). Similar to the `android:trimPathStart` attribute in a `VectorDrawable`. Default value is `0`.

- `trimPathEnd` - (float, animatable) - A float value in the interval `[0,1]` that represents the path's trim path end value (see this blog post for an in-depth explanation: https://j.mp/icon-animations). Similar to the `android:trimPathEnd` attribute in a `VectorDrawable`. Default value is `1`.

- `trimPathOffset` - (float, animatable) - A float value in the interval `[0,1]` that represents the path's trim path offset value (see this blog post for an in-depth explanation: https://j.mp/icon-animations). Similar to the `android:trimPathOffset` attribute in a `VectorDrawable`. Default value is `0`.

- `fillType` - (string enum) - An enum value of either `nonZero` or `evenOdd` describing the path's fill type. Similar to the `fill-rule` attribute of an SVG and/or the `android:fillType` attribute in a `VectorDrawable`. Default value is `nonZero`.

- `rotation`, `scaleX`, `scaleY`, `pivotX`, `pivotY`, `translateX`, and `translateY` (float, animatable) - The same transform as a `GroupLayer`'s, with the same names, defaults, and matrix, so a path can be rotated, scaled, and moved without being wrapped in a group. It maps the path's coordinates to its parent's, and scales its stroke too, exactly as a group around it would. Paths added in the app pivot at the center of the canvas, like new groups. Imported paths, and the pieces Break apart makes from a path that doesn't use its transform yet, pivot at their own center (`LayerUtil.getPathCenterPivot`), so each part rotates and scales in place. A path "uses its transform" when its rotation, scale, or translation isn't the default, or it has a transform block (`LayerUtil.pathUsesTransform`); a pivot alone doesn't count. `VectorDrawable` and SVG paths can't be transformed, so the exports replace such a path with a group named `${name}_transform` that has its transform and its transform blocks, around the path without one ([`wrapPathTransforms.ts`](../scripts/export/wrapPathTransforms.ts)). Importing that file back gives the group, not the path's transform. Transforms on paths need version 3 (see below).

### `ClipPathLayer`

A `ClipPathLayer` defines an area in which subsequent `Layer`s can be drawn. Note that the clip path only affects its subsequent sibling `Layer`s (i.e. if the `ClipPathLayer` is the 3rd child `Layer` in a `GroupLayer` with 5 total children, then the `ClipPathLayer` will only affect the 4th and 5th child `Layer`s in that group. Similar to the `<clipPath>` node of a `VectorDrawable`. Unlike a path, a clip path has no transform of its own (a `VectorDrawable` clip path can't be transformed, and a group around it would clip nothing), so a transformed clip path still needs a group, and converting a path to a clip path bakes its transform into its path.

#### Properties

- `name` (string) - A unique name for the layer to be displayed in the UI.

- `pathData` (path string, animatable) - A string describing the path's SVG path data. Similar to the `d` attribute of an SVG and/or the `android:pathData` attribute in a `VectorDrawable`. Default value is `undefined`.

## `Animation`

The `Animation` object contains the information needed to render the timeline at the bottom of the UI. An `Animation` has a unique ID and the following properties:

### Properties

- `name` (string) - A unique name for the animation to be displayed in the UI.

- `duration` (integer) - An integer value in the interval `[100,60000]` representing the duration of the timeline in milliseconds. Default value is `300`.

- `blocks` (list of `AnimationBlock`s) - A list of animation blocks (discussed below).

## `AnimationBlock`

An `AnimationBlock` describes a property animation for a particular `Layer`. They are shown in the animation as rounded rectangular blocks in the timeline UI at the bottom of the screen.

### Properties

- `name` (string) - A unique name for the layer to be displayed in the UI.

- `layerId` (string) - The `id` of the `Layer` that this `AnimationBlock` is associated with.

- `propertyName` (string) - The name of the `Layer` property this block is animating.

- `startTime` (integer) - An integer greater than or equal to `0` representing the block's starting time in milliseconds. Default value is `0`.

- `endTime` (integer) - An integer greater than the block's `startTime` representing the block's ending time in milliseconds. Default value is `100`.

- `interpolator` (string) - The easing of the property animation. It's either a preset, one of the `value`s in `INTERPOLATORS` ([`Interpolator.ts`](interpolators/Interpolator.ts)), or a custom curve written as canonical Android `pathInterpolator` path data, e.g. `"M 0 0 C 0.4 0 0.2 1 1 1"`: absolute cubics from (0, 0) to (1, 1), with numbers rounded to 3 decimals. A curve's anchor x values strictly increase, and each control point's x is within its segment, so x only increases along it (y may leave [0, 1] to anticipate or overshoot). It has at most 32 segments. [`CustomInterpolator.ts`](interpolators/CustomInterpolator.ts) parses and validates curves, and [`InterpolatorProperty.ts`](properties/InterpolatorProperty.ts) replaces anything that's neither with the default preset, `FAST_OUT_SLOW_IN`. The AVD export writes a preset as an `android:interpolator` reference, and a curve as an inline `<pathInterpolator>` (its control points for one cubic, and its `android:pathData` for more). Custom curves need version 2 (see below).

- `type` (enum string) - Describes the value type of the associated `Layer` property: `path`, `color`, or `number`.

- `fromValue` (the value type of the associated `Layer` property) - The start value of the property animation.

- `toValue` (the value type of the associated `Layer` property) - The end value of the property animation.

## Project file versions

A saved `.shapeshifter` file has a top-level `version` integer (a file without one is read as
version 1), alongside `layers` (holding `vectorLayer` and `hiddenLayerIds`) and `timeline`
(holding `animation`). There's no migrations framework: every version's shape still loads
directly, so version only decides whether `FileExportService.fromJSON` returns
`newerVersion: true`, which callers use to warn that some things may not show and saving may drop
them.

[`projectVersion.ts`](projectVersion.ts) holds `getRequiredVersion(json)`, an ordered list of
`ProjectVersionRule`s (`{ version, test }`), and `CURRENT_PROJECT_VERSION`, derived as the highest
version any registered rule can produce. `FileExportService.exportJSON` writes whatever
`getRequiredVersion` returns for the project being saved, so an ordinary file with none of the
rules' features stays at version 1.

The versions so far:

- 1: every project without the features below.
- 2: a block's `interpolator` is a custom curve rather than a preset's name. React builds before
  it replace a curve with the default preset.
- 3: a path uses its transform: its `rotation`, `scaleX`, `scaleY`, `translateX`, or `translateY`
  isn't the default, or it has a block for one of the transform properties. A pivot alone
  doesn't count, since it moves nothing, so a path added in the app stays at version 1. React
  builds before it ignore the transform and drop the blocks, so the path is drawn where its path
  data is.

### Format-change rules

Add a rule to `projectVersion.ts` when a format change means an older React build would silently
lose something, following these guidelines:

- Prefer an optional field whose absence means the old behavior, so old files and old code both
  keep working without a version bump.
- Raise the required version (add a rule) only for a change an older React build would otherwise
  silently drop or misinterpret, not for every new optional field.
- The live site (shapeshifter.design) is still the Angular 1.0.15 build, which ignores the
  `version` field entirely and crashes on formats it doesn't understand (e.g. an unknown
  interpolator string or a transform block on a path). Only the next deploy replaces it, so a rule
  documents the risk rather than working around 1.0.15.

## Useful links

The source code for each of these model objects is located here:

- [`layers/Layer.ts`](layers/Layer.ts)
- [`timeline/Animation.ts`](timeline/Animation.ts)
- [`timeline/AnimationBlock.ts`](timeline/AnimationBlock.ts)
- [`projectVersion.ts`](projectVersion.ts)

You may also find the documentation for `VectorDrawable` and `AnimatedVectorDrawable` useful, as Shape Shifter was closely modeled after the structure of these two Android classes:

- https://developer.android.com/reference/android/graphics/drawable/VectorDrawable
- https://developer.android.com/reference/android/graphics/drawable/AnimatedVectorDrawable
