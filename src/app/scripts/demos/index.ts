export interface DemoInfo {
  readonly id: string;
  readonly title: string;
}

export const DEMO_INFOS: ReadonlyArray<DemoInfo> = [
  { id: 'playtopause', title: 'Play-to-pause' },
  { id: 'searchtoclose', title: 'Search-to-close' },
  { id: 'menutoback', title: 'Menu-to-back' },
  { id: 'morphinganimals', title: 'Morphing animals' },
  { id: 'visibilitystrike', title: 'Visibility strike' },
  { id: 'heartbreak', title: 'Heart break' },
];
