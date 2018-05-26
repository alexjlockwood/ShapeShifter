#!/bin/bash -e

git checkout master
npm i
ng build --prod
echo "shapeshifter.design" > dist/CNAME
ngh
