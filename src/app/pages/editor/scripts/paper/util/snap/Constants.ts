type H = Readonly<{ dir: 'horizontal'; start: 'left'; end: 'right'; size: 'width'; coord: 'x' }>;
type V = Readonly<{ dir: 'vertical'; start: 'top'; end: 'bottom'; size: 'height'; coord: 'y' }>;

export type Horiz = H & Record<'opp', V>;
export type Vert = V & Record<'opp', H>;

const horiz: H = { dir: 'horizontal', start: 'left', end: 'right', size: 'width', coord: 'x' };
const vert: V = { dir: 'vertical', start: 'top', end: 'bottom', size: 'height', coord: 'y' };

export type Direction = 'horizontal' | 'vertical';
export const DIRECTIONS: ['horizontal', 'vertical'] = ['horizontal', 'vertical'];
export const CONSTANTS: Readonly<{ horizontal: Horiz; vertical: Vert }> = {
  horizontal: { ...horiz, opp: vert },
  vertical: { ...vert, opp: horiz },
};
