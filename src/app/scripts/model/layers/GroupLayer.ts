import { AbstractLayer } from './AbstractLayer';
import { ClipPathLayer, PathLayer } from '.';

/**
 * Model object that mirrors the VectorDrawable's '<group>' element.
 */
export class GroupLayer extends AbstractLayer {
  constructor(
    children: Array<GroupLayer | ClipPathLayer | PathLayer>,
    id: string,
    public pivotX = 0,
    public pivotY = 0,
    public rotation = 0,
    public scaleX = 1,
    public scaleY = 1,
    public translateX = 0,
    public translateY = 0,
  ) {
    super(children || [], id);
  }
}
