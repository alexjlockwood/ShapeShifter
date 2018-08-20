export interface DemoInfo {
  readonly id: string;
  readonly title: string;
}

export const DEMO_INFOS: ReadonlyArray<DemoInfo> = [
  { id: 'playtopause', title: 'Play-to-pause' },
  { id: 'searchtoclose', title: 'Search-to-close' },
  { id: 'morphinganimals', title: 'Morphing animals' },
  { id: 'visibilitystrike', title: 'Visibility strike' },
  { id: 'heartbreak', title: 'Heart break' },
];
