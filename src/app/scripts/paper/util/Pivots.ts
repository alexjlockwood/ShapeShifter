import { Cursor } from './Cursors';

export type PivotType =
  | 'bottomLeft'
  | 'leftCenter'
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'rightCenter'
  | 'bottomRight'
  | 'bottomCenter';

const PIVOT_TYPES: ReadonlyArray<PivotType> = [
  'bottomLeft',
  'leftCenter',
  'topLeft',
  'topCenter',
  'topRight',
  'rightCenter',
  'bottomRight',
  'bottomCenter',
];

const RESIZE_CURSOR_MAP = new Map<PivotType, Cursor>([
  ['bottomLeft', Cursor.Resize45],
  ['leftCenter', Cursor.Resize90],
  ['topLeft', Cursor.Resize135],
  ['topCenter', Cursor.Resize0],
  ['topRight', Cursor.Resize45],
  ['rightCenter', Cursor.Resize90],
  ['bottomRight', Cursor.Resize135],
  ['bottomCenter', Cursor.Resize0],
]);

const OPPOSITE_PIVOT_TYPES: ReadonlyArray<PivotType> = ((arr: ReadonlyArray<PivotType>) =>
  arr.map((_, i) => arr[(i + arr.length / 2) % arr.length]))(PIVOT_TYPES);

export function getPivotType(index: number) {
  return PIVOT_TYPES[index];
}

export function getOppositePivotType(index: number) {
  return OPPOSITE_PIVOT_TYPES[index];
}

export function getResizeCursor(index: number) {
  return RESIZE_CURSOR_MAP.get(getPivotType(index));
}
