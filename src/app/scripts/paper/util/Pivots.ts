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

const OPPOSITE_PIVOT_TYPES: ReadonlyArray<PivotType> = ((arr: ReadonlyArray<PivotType>) =>
  arr.map((_, i) => arr[(i + arr.length / 2) % arr.length]))(PIVOT_TYPES);

export function getPivotType(index: number) {
  return PIVOT_TYPES[index];
}

export function getOppositePivotType(index: number) {
  return OPPOSITE_PIVOT_TYPES[index];
}
