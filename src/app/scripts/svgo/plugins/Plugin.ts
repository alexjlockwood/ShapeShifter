export type Type = 'perItem' | 'perItemReverse' | 'full';

export interface Plugin {
  active: boolean;
  type: Type;
  fn: Function;
  params: any;
}
