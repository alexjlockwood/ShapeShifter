import { Guides, Items, Selections } from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Gesture } from './Gesture';

export class PencilGesture extends Gesture {
  constructor() {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {}
}

// pg.tools.draw = function() {
//   var tool;

//   var options = {
//     pointDistance: 20,
//     drawParallelLines: false,
//     lines: 3,
//     lineDistance: 10,
//     closePath: 'near start',
//     smoothPath: true,
//   };

//   var components = {
//     pointDistance: {
//       type: 'int',
//       label: 'Point distance',
//       min: 1,
//     },
//     drawParallelLines: {
//       type: 'boolean',
//       label: 'Draw parallel lines',
//     },
//     lines: {
//       type: 'int',
//       label: 'Lines',
//       requirements: { drawParallelLines: true },
//       min: 1,
//     },
//     lineDistance: {
//       type: 'float',
//       label: 'Line distance',
//       requirements: { drawParallelLines: true },
//       min: 0,
//     },
//     closePath: {
//       type: 'list',
//       label: 'Close path',
//       options: ['near start', 'always', 'never'],
//     },
//     smoothPath: {
//       type: 'boolean',
//       label: 'Smooth path',
//     },
//   };

//   var activateTool = function() {
//     var paths = [];

//     // get options from local storage if present
//     options = pg.tools.getLocalOptions(options);

//     tool = new Tool();

//     var lineCount;

//     tool.onMouseDown = function(event) {
//       if (event.event.button > 0) return; // only first mouse button

//       tool.fixedDistance = options.pointDistance;

//       if (options.drawParallelLines) {
//         lineCount = options.lines;
//       } else {
//         lineCount = 1;
//       }

//       for (var i = 0; i < lineCount; i++) {
//         var path = paths[i];
//         path = new Path();

//         path = pg.stylebar.applyActiveToolbarStyle(path);

//         paths.push(path);
//       }
//     };

//     tool.onMouseDrag = function(event) {
//       if (event.event.button > 0) return; // only first mouse button

//       var offset = event.delta;
//       offset.angle += 90;
//       for (var i = 0; i < lineCount; i++) {
//         var path = paths[i];
//         offset.length = options.lineDistance * i;
//         path.add(event.middlePoint + offset);
//       }
//     };

//     tool.onMouseUp = function(event) {
//       if (event.event.button > 0) return; // only first mouse button
//       //
//       // accidental clicks produce a path but no segments
//       // so return if an accidental click happened
//       if (paths[0].segments.length === 0) return;

//       var group;
//       if (lineCount > 1) {
//         group = new Group();
//       }

//       var nearStart = pg.math.checkPointsClose(paths[0].firstSegment.point, event.point, 30);
//       for (var i = 0; i < lineCount; i++) {
//         var path = paths[i];

//         if (options.closePath === 'near start' && nearStart) {
//           path.closePath(true);
//         } else if (options.closePath === 'always') {
//           path.closePath(true);
//         }
//         if (options.smoothPath) path.smooth();

//         if (lineCount > 1) {
//           group.addChild(path);
//         }
//       }

//       paths = [];
//       pg.undo.snapshot('draw');
//     };

//     // setup floating tool options panel in the editor
//     pg.toolOptionPanel.setup(options, components, function() {
//       lineCount = options.lines;
//       tool.fixedDistance = options.pointDistance;
//     });

//     tool.activate();
//   };

//   return {
//     options: options,
//     activateTool: activateTool,
//   };
// };
