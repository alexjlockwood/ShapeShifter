export type Type = 'perItem' | 'perItemReverse' | 'full';

export interface Plugin {
  readonly type: Type;
  readonly fn: Function;
}
