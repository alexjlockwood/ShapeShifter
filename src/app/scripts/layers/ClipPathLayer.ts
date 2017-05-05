import { Path, PathUtil } from '../paths';
import { AbstractLayer, ConstructorArgs as AbstractConstructorArgs } from './AbstractLayer';
import { Property, PathProperty } from '../properties';

/**
 * Model object that mirrors the VectorDrawable's '<clip-path>' element.
 */
@Property.register(
  new PathProperty('pathData', { isAnimatable: true }),
)
export class ClipPathLayer extends AbstractLayer {
  constructor(obj: ConstructorArgs) {
    super(obj);
    this.pathData = obj.pathData;
  }

  clone<ClipPathLayer>() {
    return new ClipPathLayer({
      id: this.id,
      children: [],
      pathData: this.pathData.clone(),
    });
  }

  interpolate(start: ClipPathLayer, end: ClipPathLayer, fraction: number) {
    this.pathData = PathUtil.interpolate(start.pathData, end.pathData, fraction);
  }
}

interface ClipPathLayerArgs {
  pathData: Path;
}

export interface ClipPathLayer extends AbstractLayer, ClipPathLayerArgs { }

export interface ConstructorArgs extends AbstractConstructorArgs, ClipPathLayerArgs { }
