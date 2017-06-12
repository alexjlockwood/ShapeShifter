export interface DemoInfo {
  readonly id: string;
  readonly title: string;
}

export const DEMO_INFOS: ReadonlyArray<DemoInfo> = [
  { id: 'hippobuffalo', title: 'Morphing animals' },
  { id: 'visibilitystrike', title: 'Visibility strike' },
  { id: 'searchtoback', title: 'Search-to-back' },
  { id: 'heartbreak', title: 'Heart break' },
  { id: 'searchtoclose', title: 'Search-to-close' },
];
