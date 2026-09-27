import type { PointType } from 'app/modules/editor/model/paths';

/**
 * The point types as the inspector and the context menu show them, in the order of their
 * shortcuts (1 to 4, as in PathEdit.POINT_TYPES). It's outside of the canvas editor, so that the
 * context menu can use it without loading the editor.
 */
export const POINT_TYPE_OPTIONS: ReadonlyArray<{
  readonly value: PointType;
  readonly label: string;
}> = [
  { value: 'straight', label: 'Straight' },
  { value: 'mirrored', label: 'Mirrored' },
  { value: 'disconnected', label: 'Disconnected' },
  { value: 'asymmetric', label: 'Asymmetric' },
];

export function getPointTypeLabel(type: PointType) {
  return POINT_TYPE_OPTIONS.find(o => o.value === type)?.label ?? type;
}
