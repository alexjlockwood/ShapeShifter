export type HandleType =
  | 'bottomLeft'
  | 'leftCenter'
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'rightCenter'
  | 'bottomRight'
  | 'bottomCenter';

const HANDLE_TYPES: ReadonlyArray<HandleType> = [
  'bottomLeft',
  'leftCenter',
  'topLeft',
  'topCenter',
  'topRight',
  'rightCenter',
  'bottomRight',
  'bottomCenter',
];

const OPPOSITE_HANDLE_TYPES: ReadonlyArray<HandleType> = ((arr: ReadonlyArray<HandleType>) =>
  arr.map((_, i) => arr[(i + arr.length / 2) % arr.length]))(HANDLE_TYPES);

export function getHandleType(index: number) {
  return HANDLE_TYPES[index];
}

export function getOppositeHandleType(index: number) {
  return OPPOSITE_HANDLE_TYPES[index];
}
