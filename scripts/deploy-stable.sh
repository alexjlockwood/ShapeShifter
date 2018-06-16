#!/bin/bash -e

npm i
npm run build
echo "shapeshifter.design" > dist/CNAME
ngh --repo git@github.com:alexjlockwood/ShapeShifterStable.git
