# Shape Shifter

[![Build Status][travis-badge]][travis-badge-url]
[![Coverage Status][coveralls-badge]][coveralls-badge-url]
[![GitHub Stats](https://img.shields.io/badge/github-stats-ff5500.svg)](http://githubstats.com/alexjlockwood/ShapeShifter)

**[Go to Live Version](https://shapeshifter.design)**

-----

[Shape Shifter](https://alexjlockwood.github.io/ShapeShifter/) is a web-app that simplifies
the creation of [icon animations][adp-icon-animations] for Android, iOS, and the web.

This tool currently exports to standalone SVGs, SVG spritesheets,
and CSS keyframe animations for the web, as well as to
[`AnimatedVectorDrawable`](https://developer.android.com/reference/android/graphics/drawable/AnimatedVectorDrawable.html)
format for Android. I am totally open to adding support for other export formats as well, so
if you have a format that you'd like to see added in the future,
file a [feature request][report-feature-request]!

![Screen capture of tool](art/screencap.gif)

## Examples

Here are some example icon animations created by Shape Shifter:

<img src="art/expandcollapse.gif" alt="Expand to collapse animation" width="216px"/><img src="art/moreback.gif" alt="Overflow to back arrow animation" width="216px"/><img src="art/playpausestop.gif" alt="Play-pause-stop animation" width="216px"/><img src="art/animals.gif" alt="Animals animation" width="216px" vspace="34px"/><!--<img src="art/plusminus.gif" alt="Plus-to-minus animation" width="216px"/><img src="art/cast.gif" alt="Cast animation" width="216px"/><img src="art/drawerarrow.gif" alt="Drawer-to-arrow animation" width="216px"/><img src="art/digits.gif" alt="Digits animation" width="216px"/>-->

## Problem

Writing high-quality [path morphing animations][adp-path-morphing]
is a tedious and time-consuming task. In order to morph one shape into another,
the SVG paths describing the two must be *compatible* with each other&mdash;that is,
they need to have the same number and type of drawing commands. This is problematic because:

* Design tools&mdash;such as [Sketch][sketch] and [Illustrator][illustrator]&mdash;do not easily
  expose the order of points in a shape, making it difficult to change their order. As a result,
  engineers will often have to spend time tweaking the raw SVG path strings given to them by
  designers before they can be morphed, which can take a significant amount of time.
* Design tools often map to shape primitives not supported in certain platforms
  (e.g. circles need to be represented by a sequence of curves and/or arcs,
  not simply by their center point and radius).
* Design tools cannot place multiple path points in the same location, a technique that
  is often necessary when making two shapes compatible with each other.
* Design tools provide no easy way to visualize the in-between states of the desired
  path morph animation.

## Features

To address these problems, Shape Shifter provides the following features:

* *The ability to add/remove points to each path without altering their original appearance.*
  The added points can be modified by dragging them to different positions along the path,
  and they can be later deleted using the keyboard as well.
* *The ability to reverse/shift the relative positions of each path's points.* While reordering points
  won't affect whether or not two paths are compatible, it often plays a huge role in determining the
  appearance of the resulting animation.
* *Shape Shifter automatically converts incompatible pairs of SVG commands into a compatible
  format.* There's no longer any need to convert `L`s into `Q`s and `A`s into `C`s by hand in
  order to make your paths compatible&mdash;Shape Shifter does this for you behind-the-scenes!
* *Shape Shifter provides a useful utility called 'auto fix', which takes two incompatible
  paths and attempts to make them compatible in an optimal way.* Depending on the complexity
  of the paths, auto fix may or may not generate a satisfying final result, so further
  modification may be necessary in order to achieve the animation you're looking for.
* *The ability to export the results to SVG spritesheets, CSS keyframes, and
  `AnimatedVectorDrawable` format for use on
  the web and in Android applications.* I'm open to adding support for other export formats
  as well, so feel free to file a [feature request][report-feature-request]!

## How does it work?

Pretty much all of the graphics in this app are powered by bezier curve approximations under-the-hood.
I learned most of what I needed to know from this excellent [primer on bezier curves][primer-on-bezier-curves]
(especially sections 9 and 33, which explain how to split and project points onto bezier
curves without altering their original appearance). Most of the interesting SVG-related code
is located under [`src/app/model/paths`](https://github.com/alexjlockwood/ShapeShifter/tree/master/src/app/model/paths).

Auto fix is powered by an adaptation of the [Needleman-Wunsch algorithm][Needleman-Wunsch],
which is used in bioinformatics to align protein or nucleotide sequences. Instead of
aligning DNA base-pairs, Shape Shifter aligns the individual SVG commands that make up
each path instead. You can view the current implementation of the algorithm in the
[`AutoAwesome.ts`](https://github.com/alexjlockwood/ShapeShifter/blob/master/src/app/scripts/algorithms/AutoAwesome.ts) file.

## Bug reports & feature requests

Let me know if you encounter any issues with the app (attach SVG files and/or
screenshots if you can). Before you do, take a look at the list of known issues
[here](https://github.com/alexjlockwood/ShapeShifter/issues) and leave a comment
on the existing bugs you want to see fixed in a future release!

I am open to pretty much any feature request, so don't be afraid to ask!
I'll likely work on the most popular feature requests first. **I'm especially
curious how I can make this web app more useful for iOS and web developers.**

## Build instructions

If you want to contribute, you can build and serve the web app locally as follows:

  1. First install [`Node.js`](https://nodejs.org/) and [`npm`](https://www.npmjs.com/).

  2. Clone the repository and in the root directory, run:

     ```
     npm install
     ```

  3. To build and serve the web app locally, run:

     ```
     npm start
     ```

If you're having issues with the build, make sure your `Node.js` version is up-to-date before reporting issues.

## Special thanks

Huge thanks to [Nick Butcher][nick-butcher-twitter], [Roman Nurik][roman-nurik-twitter],
and [Steph Yim][steph-yim-website] for all of their help during the early stages of this project!

  [report-feature-request]: https://github.com/alexjlockwood/ShapeShifter/issues/new
  [adp-icon-animations]: http://www.androiddesignpatterns.com/2016/11/introduction-to-icon-animation-techniques.html
  [adp-path-morphing]: http://www.androiddesignpatterns.com/2016/11/introduction-to-icon-animation-techniques.html#morphing-paths
  [sketch]: https://www.sketchapp.com/
  [illustrator]: http://www.adobe.com/products/illustrator.html
  [Needleman-Wunsch]: https://en.wikipedia.org/wiki/Needleman%E2%80%93Wunsch_algorithm
  [primer-on-bezier-curves]: https://pomax.github.io/bezierinfo
  [nick-butcher-twitter]: https://twitter.com/crafty
  [roman-nurik-twitter]: https://twitter.com/romannurik
  [steph-yim-website]: http://stephanieyim.com
  [travis-badge]: https://travis-ci.org/alexjlockwood/ShapeShifter.svg?branch=master
  [travis-badge-url]: https://travis-ci.org/alexjlockwood/ShapeShifter
  [david-badge]: https://david-dm.org/alexjlockwood/ShapeShifter.svg
  [david-badge-url]: https://david-dm.org/alexjlockwood/ShapeShifter
  [david-dev-badge]: https://david-dm.org/alexjlockwood/ShapeShifter/dev-status.svg
  [david-dev-badge-url]: https://david-dm.org/alexjlockwood/ShapeShifter?type=dev
  [coveralls-badge]: https://coveralls.io/repos/github/alexjlockwood/ShapeShifter/badge.svg?branch=master
  [coveralls-badge-url]: https://coveralls.io/github/alexjlockwood/ShapeShifter?branch=master
