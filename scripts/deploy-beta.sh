#!/bin/bash -e

git checkout beta
npm i
ng build --prod
echo "beta.shapeshifter.design" > dist/CNAME
ngh --repo git@github.com:alexjlockwood/ShapeShifterBeta.git
