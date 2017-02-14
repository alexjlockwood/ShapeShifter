# Shape Shifter

[![Build Status](https://travis-ci.org/alexjlockwood/ShapeShifter.svg?branch=master)](https://travis-ci.org/alexjlockwood/ShapeShifter)

**[Go to Live Version](https://alexjlockwood.github.io/ShapeShifter/)**

-----

A simple web-app that greatly simplifies the process of creating path
morphing animations between two arbitrary SVGs.

Currently exports to [`AnimatedVectorDrawable`](https://developer.android.com/reference/android/graphics/drawable/AnimatedVectorDrawable.html)
format for Android. Exporting to web/iOS is a work in progress.

## Build instructions

If you want to contribute, you can build and serve the web app locally as follows:

  1. First install [Node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/).

  2. Clone the repository and in the root directory, run:

    ```
    $ npm install
    ```

  3. To build and serve the web app locally, run:

    ```
    $ ng serve
    ```
