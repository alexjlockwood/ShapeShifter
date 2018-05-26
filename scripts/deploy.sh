#!/bin/bash -e

git checkout master
npm i
ng build --prod
ngh
