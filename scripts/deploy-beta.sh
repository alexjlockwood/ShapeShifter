#!/bin/bash -e

npm i
npm run build-beta
echo "beta.shapeshifter.design" > dist/CNAME
ngh --repo git@github.com:alexjlockwood/ShapeShifterBeta.git
