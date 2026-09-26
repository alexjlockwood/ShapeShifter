import { Path } from 'app/modules/editor/model/paths';

import { AutoAwesome } from '.';

// Production builds don't build a path's curves until they're needed, so a curve with missing
// points used to be stored, and threw once auto fix or a split reached it.
vi.mock('environments/environment', () => ({ environment: { production: true, beta: false } }));

describe('AutoAwesome in production builds', () => {
  it.each(['M 0 0 Q 1 1', 'M 0 0 C 1 1', 'M 0 0 C 1 1 2 2 3 3 4 4'])(
    'auto fixes a path with an incomplete curve (%s)',
    pathString => {
      const [from, to] = AutoAwesome.autoFix(
        new Path(pathString),
        new Path('M 0 0 L 10 0 L 10 10 Z'),
      );
      expect(from.isMorphableWith(to)).toBe(true);
      expect(() => from.mutate().splitCommandInHalf(0, 1).build()).not.toThrow();
    },
  );
});
