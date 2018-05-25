#!/bin/bash -e

rm -rf dist
git checkout master
npm i
ng build --prod --output-path 'dist' --base-href '/'
git clone -b gh-pages --single-branch https://github.com/alexjlockwood/ShapeShifter .remote-dist
mv .remote-dist/next dist/next
rm -rf .remote-dist
cp CNAME dist/CNAME
ngh
