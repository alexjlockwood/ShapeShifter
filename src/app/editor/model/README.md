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

- `pivotX` (float, animatable) - A float value (defined in viewport space) describing the x-coordinate of the pivot used to scale/rotate the group. Default value is `0`.

- `pivotY` (float, animatable) - A float value (defined in viewport space) describing the y-coordinate of the pivot used to scale/rotate the group. Default value is `0`.

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

### `ClipPathLayer`

A `ClipPathLayer` defines an area in which subsequent `Layer`s can be drawn. Note that the clip path only affects its subsequent sibling `Layer`s (i.e. if the `ClipPathLayer` is the 3rd child `Layer` in a `GroupLayer` with 5 total children, then the `ClipPathLayer` will only affect the 4th and 5th child `Layer`s in that group. Similar to the `<clipPath>` node of a `VectorDrawable`.

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

- `interpolator` (enum string) - Describes the interpolator to use for the property animation. It will be one of the `value`s listed in this [`Interpolator.ts`](https://github.com/alexjlockwood/ShapeShifter/blob/master/src/app/model/interpolators/Interpolator.ts) file.

- `type` (enum string) - Describes the value type of the associated `Layer` property: `path`, `color`, or `number`.

- `fromValue` (the value type of the associated `Layer` property) - The start value of the property animation.

- `toValue` (the value type of the associated `Layer` property) - The end value of the property animation.

## Useful links

The source code for each of these model objects is located here:

- https://github.com/alexjlockwood/ShapeShifter/blob/master/src/app/model/layers/Layer.ts
- https://github.com/alexjlockwood/ShapeShifter/blob/master/src/app/model/timeline/Animation.ts
- https://github.com/alexjlockwood/ShapeShifter/blob/master/src/app/model/timeline/AnimationBlock.ts

You may also find the documentation for `VectorDrawable` and `AnimatedVectorDrawable` useful, as Shape Shifter was closely modeled after the structure of these two Android classes:

- https://developer.android.com/reference/android/graphics/drawable/VectorDrawable
- https://developer.android.com/reference/android/graphics/drawable/AnimatedVectorDrawable
