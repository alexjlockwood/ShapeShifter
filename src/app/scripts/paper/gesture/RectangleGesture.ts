import { Guides, Items, Selections } from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Gesture } from './Gesture';

export class RectangleGesture extends Gesture {
  // @Override
  onMouseDown(event: paper.ToolEvent) {}

  // @Override
  onMouseDrag(event: paper.ToolEvent) {}

  // @Override
  onMouseUp(event: paper.ToolEvent) {}
}

// pg.tools.rectangle = function() {
//   var tool;

//   var options = {
//     roundedCorners: false,
//     cornerRadius: 20,
//   };

//   var components = {
//     roundedCorners: {
//       type: 'boolean',
//       label: 'Rounded corners',
//     },
//     cornerRadius: {
//       type: 'float',
//       label: 'Corner radius',
//       requirements: { roundedCorners: true },
//       min: 0,
//     },
//   };

//   var activateTool = function() {
//     // get options from local storage if present
//     options = pg.tools.getLocalOptions(options);

//     tool = new Tool();
//     var mouseDown;
//     var path;
//     var rect;

//     tool.onMouseDown = function(event) {
//       mouseDown = event.downPoint;
//     };

//     tool.onMouseDrag = function(event) {
//       if (event.event.button > 0) return; // only first mouse button

//       rect = new Rectangle(event.downPoint, event.point);

//       if (event.modifiers.shift) {
//         rect.height = rect.width;
//       }

//       if (options.roundedCorners) {
//         path = new Path.Rectangle(rect, options.cornerRadius);
//       } else {
//         path = new Path.Rectangle(rect);
//       }

//       if (event.modifiers.alt) {
//         path.position = mouseDown;
//       }

//       path = pg.stylebar.applyActiveToolbarStyle(path);

//       // Remove this path on the next drag event:
//       path.removeOnDrag();
//     };

//     tool.onMouseUp = function(event) {
//       if (event.event.button > 0) return; // only first mouse button

//       pg.undo.snapshot('rectangle');
//     };

//     // setup floating tool options panel in the editor
//     pg.toolOptionPanel.setup(options, components, function() {});

//     tool.activate();
//   };

//   return {
//     options: options,
//     activateTool: activateTool,
//   };
// };
