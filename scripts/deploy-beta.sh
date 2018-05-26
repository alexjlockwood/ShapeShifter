#!/bin/bash -e

git checkout next
npm i
ng build --prod
ngh --repo git@github.com:alexjlockwood/ShapeShifterBeta.git
