type HandleType =
  | 'bottomLeft'
  | 'leftCenter'
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'rightCenter'
  | 'bottomRight'
  | 'bottomCenter';

const HANDLE_NAMES: ReadonlyArray<HandleType> = [
  'bottomLeft',
  'leftCenter',
  'topLeft',
  'topCenter',
  'topRight',
  'rightCenter',
  'bottomRight',
  'bottomCenter',
];

const OPPOSITE_HANDLE_NAMES: ReadonlyArray<HandleType> = ((arr: ReadonlyArray<HandleType>) =>
  arr.map((_, i) => arr[(i + arr.length / 2) % arr.length]))(HANDLE_NAMES);

export function getHandleName(index: number) {
  return HANDLE_NAMES[index];
}

export function getOppositeHandleName(index: number) {
  return OPPOSITE_HANDLE_NAMES[index];
}
