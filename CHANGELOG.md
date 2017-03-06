# [v0.1.2](https://github.com/alexjlockwood/ShapeShifter/compare/v0.1.1...v0.1.2) (2017-03-06)

### Features

* Shape Shifter now works offline! A cached version of the app will be saved in
  your browser's cache so that it can be used without an internet connection.
  Note that currently only Chrome, Firefox, and Opera are
  [supported](http://caniuse.com/#feat=serviceworkers).
  ([#61](https://github.com/alexjlockwood/ShapeShifter/issues/61))
  ([50e694e](https://github.com/alexjlockwood/ShapeShifter/commit/50e694e))
  ([d770fce](https://github.com/alexjlockwood/ShapeShifter/commit/d770fce))
* SVGs matching the final start and end state canvases are now exported for use on the web.
  ([#43](https://github.com/alexjlockwood/ShapeShifter/issues/43))
* `VectorDrawable`s matching the final start and end state canvases are now exported for
  use in Android apps.
  ([#52](https://github.com/alexjlockwood/ShapeShifter/issues/52))
* Exported `AnimatedVectorDrawable`s will now automatically animate differences
  in each path's `fillColor`, `strokeColor`, `fillAlpha`, `strokeAlpha`, and `strokeWidth`.
  ([#51](https://github.com/alexjlockwood/ShapeShifter/issues/51))
  ([500a4f8](https://github.com/alexjlockwood/ShapeShifter/commit/500a4f8))
  ([0dabb5f](https://github.com/alexjlockwood/ShapeShifter/commit/0dabb5f))
* SVG import now makes a best effort attempt to merge multiple `<path>`
  elements into a single `<path>` containing multiple subpaths. Shape Shifter currently
  only supports morphing one `<path>` element at a time, but this enhancement should make
  that less likely to be an issue in the meantime.

### Bug fixes

* Fixed SVG import crash in Firefox.
  ([#69](https://github.com/alexjlockwood/ShapeShifter/issues/69))
  ([d0d95b6](https://github.com/alexjlockwood/ShapeShifter/commit/d0d95b6))
* Fixed SVG import bug that caused `<circle>` and `<ellipse>` tags to be parsed incorrectly.
  ([#71](https://github.com/alexjlockwood/ShapeShifter/issues/71))
  ([a487576](https://github.com/alexjlockwood/ShapeShifter/commit/a487576))
* SVG `stroke-width` and `stroke-miterlimit` are now imported with default values
  of `1` and `4` respectively.
  ([#66](https://github.com/alexjlockwood/ShapeShifter/issues/66))
  ([1d47cef](https://github.com/alexjlockwood/ShapeShifter/commit/1d47cef))
  ([50e694e](https://github.com/alexjlockwood/ShapeShifter/commit/50e694e))
* Fixed bug that would sometimes cause the morphable paths to be displayed as unmorphable.
  ([#50](https://github.com/alexjlockwood/ShapeShifter/issues/50))
  ([0e3d45d](https://github.com/alexjlockwood/ShapeShifter/commit/0e3d45d))
* SVG `fill` color is now imported as `black` by default.
  ([0debebe](https://github.com/alexjlockwood/ShapeShifter/commit/0debebe))
* Fixed scaling bug in Safari when importing the 'morphing animals' demo.
  ([5a7a5bd](https://github.com/alexjlockwood/ShapeShifter/commit/5a7a5bd))

# [v0.1.1](https://github.com/alexjlockwood/ShapeShifter/compare/v0.1...v0.1.1) (2017-02-27)

### Features

* Imported SVGs are now preprocessed and simplified using [svgo](https://github.com/svg/svgo).
  Design tools often output bloated SVG source code with tons of unnecessary
  commands, so simplifying these SVGs beforehand will make them
  much easier to work with.
  ([#15](https://github.com/alexjlockwood/ShapeShifter/issues/15))
* Selection/hover events in one canvas are now mirrored in the other canvas, making it easier
  to understand which points will animate where.
  ([#30](https://github.com/alexjlockwood/ShapeShifter/issues/30))
  ([265608d](https://github.com/alexjlockwood/ShapeShifter/commit/265608d))

### Bug fixes

* SVG importer can now properly parse SVGs containing `<style>`
  tags and/or inline `style` attributes.
  ([#14](https://github.com/alexjlockwood/ShapeShifter/issues/14))
* SVG importer now correctly detects inherited attributes set on
  `<svg>` and/or `<g>` nodes and properly assigns them to their
  children `<path>` nodes.
  ([#20](https://github.com/alexjlockwood/ShapeShifter/issues/20))
  ([158497f](https://github.com/alexjlockwood/ShapeShifter/commit/158497f))
* SVG paths that begin with a relative `m` command are now imported correctly.
  ([#22](https://github.com/alexjlockwood/ShapeShifter/issues/22))
  ([158497f](https://github.com/alexjlockwood/ShapeShifter/commit/158497f))
* SVG paths with trailing whitespace are now imported correctly.
* SVG paths with consecutive elliptical arc commands are now imported correctly.
* SVG paths with the form `M ... Z ... Z ... Z` are now imported as multiple subpaths.
  ([#35](https://github.com/alexjlockwood/ShapeShifter/issues/35))
  ([82151f1](https://github.com/alexjlockwood/ShapeShifter/commit/82151f1))
* Split `Z` commands are now replaced with `L Z` rather than `Z Z`.
  ([#32](https://github.com/alexjlockwood/ShapeShifter/issues/32))
  ([c49289a](https://github.com/alexjlockwood/ShapeShifter/commit/c49289a))
* SVG paths use `#000` as their default fill color when neither a fill/stroke color
  isn't specified.
  ([#28](https://github.com/alexjlockwood/ShapeShifter/issues/28))
  ([b706eb3](https://github.com/alexjlockwood/ShapeShifter/commit/b706eb3))
* Fixed crash that sometimes occurred when switching between paths with different
  numbers of subpaths.
  ([#21](https://github.com/alexjlockwood/ShapeShifter/issues/2132))
  ([158497f](https://github.com/alexjlockwood/ShapeShifter/commit/158497f))
* Canvas rulers are now aligned properly for SVGs with large viewports.
  ([#38](https://github.com/alexjlockwood/ShapeShifter/issues/32))
  ([361be34](https://github.com/alexjlockwood/ShapeShifter/commit/361be34))

# v0.1 (2017-02-20)

* Initial release!
