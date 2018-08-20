import { ToolMode } from 'app/modules/editor/model/paper';
import {
  SetEditPathInfo,
  SetRotateItemsInfo,
  SetToolMode,
  SetTransformPathsInfo,
} from 'app/modules/editor/store/paper/actions';

// TODO: expand on this class... possibly a better redesigned version?

export function getEnterDefaultModeActions() {
  return [
    new SetToolMode(ToolMode.Default),
    new SetEditPathInfo(undefined),
    new SetRotateItemsInfo(undefined),
    new SetTransformPathsInfo(undefined),
  ];
}
