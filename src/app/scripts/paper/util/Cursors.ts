import * as $ from 'jquery';

export function clear() {
  set(Cursor.Auto);
}

export function set(cursor: Cursor) {
  $('.paper-canvas').css('cursor', cursor);
}

export enum Cursor {
  Auto = 'auto',
  PointSelect = 'url(/assets/cursor/pointSelectCursor.png) 0 0, auto',
  Pen = 'url(/assets/cursor/penCursor.png) 0 0, auto',
  PenAdd = 'url(/assets/cursor/penAddCursor.png) 0 0, auto',
  PenClose = 'url(/assets/cursor/penCloseCursor.png) 0 0, auto',
  Resize0 = 'ns-resize',
  Resize45 = 'nesw-resize',
  Resize90 = 'ew-resize',
  Resize135 = 'nwse-resize',
  Rotate0 = 'url(/assets/cursor/rotateTopCursor.png) 0 0, auto',
  Rotate45 = 'url(/assets/cursor/rotateTopRightCursor.png) 0 0, auto',
  Rotate90 = 'url(/assets/cursor/rotateRightCursor.png) 0 0, auto',
  Rotate135 = 'url(/assets/cursor/rotateBottomRightCursor.png) 0 0, auto',
  Rotate180 = 'url(/assets/cursor/rotateBottomCursor.png) 0 0, auto',
  Rotate225 = 'url(/assets/cursor/rotateBottomLeftCursor.png) 0 0, auto',
  Rotate270 = 'url(/assets/cursor/rotateLeftCursor.png) 0 0, auto',
  Rotate315 = 'url(/assets/cursor/rotateTopLeftCursor.png) 0 0, auto',
  ZoomIn = 'zoom-in',
  ZoomOut = 'zoom-out',
  Grab = 'grab',
  Grabbing = 'grabbing',
}
