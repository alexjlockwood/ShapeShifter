## v0.1.1 (2017-02-27)

### Features

* Imported SVGs are now preprocessed and simplified using [svgo](https://github.com/svg/svgo).
  Design tools are notorious for outputting bloated SVG source code with tons of unnecessary
  commands, so the simplified SVGs should be much easier to work with.
* Selection/hover events in one canvas are now mirroed in the other canvas, making it easier
  to understand which points map where. (#30) (265608d)

### Bug fixes

* SVG importer is much better at importing SVGs with `<style>` tags and/or inline
  `style` attributes.
* SVG importer is much better at detecting and assignin inherited attributes to children nodes.
* SVG paths beginning with a relative `m` command are now imported correctly. (#22) (158497f)
* SVG paths with trailing whitespace are now imported correctly.
* SVG paths with consecutive elliptical arc commands are now imported correctly.
* SVG paths with the form `M ... Z ... Z ... Z` are now imported as multiple subpaths.
  (#35) (82151f1)
* Split `Z` commands are now replaced with `L Z` rather than `Z Z`. (#32) (c49289a)
* SVG paths use `#000` as their default fill color when neither a fill/stroke color
  isn't specified. (#28) (b706eb3)
* Fixed crash that sometimes occurred when switching between paths with different
  numbers of subpaths. (#21) (158497f)
* Align rulers properly for SVGs with large viewports. (#38) (361be34)

## v0.1.0 (2017-02-20)

* Initial release!
