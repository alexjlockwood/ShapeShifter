export enum ToolMode {
  Selection = 1,
  Pencil,
  Pen,
  Circle,
  Rectangle,
  ZoomPan,
  Rotate,
  Transform,
}

// These names correspond to the names declared in root.component.scss
export enum CanvasCursor {
  PointSelect = 'cursor-point-select',
  Pen = 'cursor-pen',
  PenAdd = 'cursor-pen-add',
  PenClose = 'cursor-pen-close',
  Resize0 = 'cursor-resize-0',
  Resize45 = 'cursor-resize-45',
  Resize90 = 'cursor-resize-90',
  Resize135 = 'cursor-resize-135',
  Rotate0 = 'cursor-rotate-0',
  Rotate45 = 'cursor-rotate-45',
  Rotate90 = 'cursor-rotate-90',
  Rotate135 = 'cursor-rotate-135',
  Rotate180 = 'cursor-rotate-180',
  Rotate225 = 'cursor-rotate-225',
  Rotate270 = 'cursor-rotate-270',
  Rotate315 = 'cursor-rotate-315',
  ZoomIn = 'cursor-zoom-in',
  ZoomOut = 'cursor-zoom-out',
  Grab = 'cursor-grab',
  Grabbing = 'cursor-grabbing',
}
