#!/bin/bash -e

npm i
ng build --prod --sourcemaps --app beta
echo "beta.shapeshifter.design" > dist/CNAME
ngh --repo git@github.com:alexjlockwood/ShapeShifterBeta.git
