// import { SvgTarget } from '../animation';

export function createHtml() {
  return `<html>
<body>
  <div class="shapeshifter play" style="background-image: url(svgsprite.svg)" data-iteration="infinite"></div>
  <style>@import "svgsprite.css" all;</style>
</body>
</html>
`;
}

export function createCss() {

}

export function createSvg() {

}

// function svgTargetToCssKeyframes(layerId: string, svgTarget: SvgTarget) {
//   const fromProps: string[] = [];
//   const toProps: string[] = [];
//   for (const anim of svgTarget.animations) {
//     let valueFrom = anim.valueFrom;
//     let valueTo = anim.valueTo;
//     if (anim.propertyName === 'd') {
//       valueFrom = `path('${valueFrom}')`;
//       valueTo = `path('${valueTo}')`;
//     }
//     fromProps.push(`${anim.propertyName}: ${valueFrom}`);
//     toProps.push(`${anim.propertyName}: ${valueTo}`);
//   }
//   return `
//     @keyframes ${layerId}_anim {
//       from {
//         ${fromProps.join(';\n      ')}
//       }
//       to {
//         ${toProps.join(';\n      ')}
//       }
//     }`;
// }

// @-webkit-keyframes play50 {
//   0% {
//     background-position: -128px 0px;
//   }
//   100% {
//     background-position: -6400px 0px;
//   }
// }
// @-moz-keyframes play50 {
//   0% {
//     background-position: -128px 0px;
//   }
//   100% {
//     background-position: -6400px 0px;
//   }
// }
// @-o-keyframes play50 {
//   0% {
//     background-position: -128px 0px;
//   }
//   100% {
//     background-position: -6400px 0px;
//   }
// }
// @keyframes play50 {
//   0% {
//     background-position: -128px 0px;
//   }
//   100% {
//     background-position: -6400px 0px;
//   }
// }
// .ai {
//   -webkit-animation-duration: 2s;
//   -moz-animation-duration: 2s;
//   -o-animation-duration: 2s;
//   animation-duration: 2s;
//   -webkit-animation-timing-function: steps(49);
//   -moz-animation-timing-function: steps(49);
//   -o-animation-timing-function: steps(49);
//   animation-timing-function: steps(49);
//   width: 128px;
//   height: 128px;
//   background-repeat: no-repeat;
// }
// .ai[data-iteration="infinite"] {
//   -webkit-animation-iteration-count: infinite;
//   -moz-animation-iteration-count: infinite;
//   -o-animation-iteration-count: infinite;
//   animation-iteration-count: infinite;
//   -webkit-animation-fill-mode: both;
//   -moz-animation-fill-mode: both;
//   -o-animation-fill-mode: both;
//   animation-fill-mode: both;
// }
// .ai.play {
//   -webkit-animation-name: play50;
//   -moz-animation-name: play50;
//   -o-animation-name: play50;
//   animation-name: play50;
// }
