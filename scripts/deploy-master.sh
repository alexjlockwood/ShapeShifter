#!/bin/bash -e

git checkout master
npm i
ng build --prod --sourcemaps
echo "shapeshifter.design" > dist/CNAME
ngh
