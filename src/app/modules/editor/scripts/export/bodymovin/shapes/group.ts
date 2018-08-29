import { Shape } from './types';

export interface GroupShape {
  /** The shape type. */
  ty: 'gr';
  /** The group's children shapes. */
  it: Shape[];
}
