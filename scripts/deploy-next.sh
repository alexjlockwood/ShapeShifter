#!/bin/bash -e

rm -rf dist
git checkout next
npm i
git clone -b gh-pages --single-branch https://github.com/alexjlockwood/ShapeShifter .remote-dist
ng build --prod --output-path '.remote-dist/next' --base-href '/next/'
mv .remote-dist dist
ngh
