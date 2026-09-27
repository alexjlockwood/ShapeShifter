import { describe, expect, it } from 'vitest';

import { CURRENT_PROJECT_VERSION, getRequiredVersion } from './projectVersion';

describe('getRequiredVersion', () => {
  it('returns 1 for an ordinary project', () => {
    const json = {
      layers: { vectorLayer: { children: [] } },
      timeline: { animation: { blocks: [] } },
    };
    expect(getRequiredVersion(json)).toBe(1);
  });
});

describe('CURRENT_PROJECT_VERSION', () => {
  it('is at least 1, since no rules are registered yet', () => {
    expect(CURRENT_PROJECT_VERSION).toBeGreaterThanOrEqual(1);
  });
});
