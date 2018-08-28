import { FillShape } from './fill';
import { GroupShape } from './group';
import { PathShape } from './path';
import { StrokeShape } from './stroke';
import { TransformShape } from './transform';

export type Shape = GroupShape | PathShape | TransformShape | FillShape | StrokeShape;
