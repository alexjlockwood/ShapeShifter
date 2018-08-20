import { ToolMode } from 'app/pages/editor/model/paper';
import {
  SetEditPathInfo,
  SetRotateItemsInfo,
  SetToolMode,
  SetTransformPathsInfo,
} from 'app/pages/editor/store/paper/actions';

// TODO: expand on this class... possibly a better redesigned version?

export function getEnterDefaultModeActions() {
  return [
    new SetToolMode(ToolMode.Default),
    new SetEditPathInfo(undefined),
    new SetRotateItemsInfo(undefined),
    new SetTransformPathsInfo(undefined),
  ];
}
