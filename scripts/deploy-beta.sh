#!/bin/bash -e

git checkout beta
npm i
ng build --prod --sourcemaps
echo "beta.shapeshifter.design" > dist/CNAME
ngh --repo git@github.com:alexjlockwood/ShapeShifterBeta.git
