declare module 'paper' {
  export interface HitOptions<C extends Item = Item> {
    tolerance?: number;
    class?: Constructor<C>;
    fill?: boolean;
    stroke?: boolean;
    segments?: boolean;
    curves?: boolean;
    handles?: boolean;
    ends?: boolean;
    bounds?: boolean;
    center?: boolean;
    guides?: boolean;
    selected?: boolean;
    match?: (hitResult: HitResult<C>) => boolean;
  }
}
