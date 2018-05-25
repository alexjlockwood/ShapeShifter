#!/bin/bash -e

rm -rf dist
git checkout next
npm i
git clone -b gh-pages --single-branch https://github.com/alexjlockwood/ShapeShifter dist
ng build --prod --output-path 'dist/next' --base-href '/next/'
ngh --dry-run
