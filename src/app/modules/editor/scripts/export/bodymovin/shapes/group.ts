import { Shape } from './types';

export interface GroupShape {
  /** The shape type. Always 'gr'. */
  ty: 'gr';
  /** The group's children shapes. */
  it: Shape[];
}
