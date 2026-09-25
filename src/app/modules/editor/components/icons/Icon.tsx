import AddIcon from '@mui/icons-material/Add';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import BugReportIcon from '@mui/icons-material/BugReport';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import CropRotateIcon from '@mui/icons-material/CropRotate';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoIcon from '@mui/icons-material/Info';
import LooksOneIcon from '@mui/icons-material/LooksOne';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RepeatIcon from '@mui/icons-material/Repeat';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SlowMotionVideoIcon from '@mui/icons-material/SlowMotionVideo';
import TransformIcon from '@mui/icons-material/Transform';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';

import addLayerSvg from './svg/addlayer.svg?raw';
import animationSvg from './svg/animation.svg?raw';
import animationBlockSvg from './svg/animationblock.svg?raw';
import autoFixSvg from './svg/autofix.svg?raw';
import clipPathLayerSvg from './svg/clippathlayer.svg?raw';
import collectionSvg from './svg/collection.svg?raw';
import contributeSvg from './svg/contribute.svg?raw';
import groupLayerSvg from './svg/grouplayer.svg?raw';
import pathLayerSvg from './svg/pathlayer.svg?raw';
import reverseSvg from './svg/reverse.svg?raw';
import shapeShifterSvg from './svg/shapeshifter.svg?raw';
import vectorLayerSvg from './svg/vectorlayer.svg?raw';

// Keyed by their Material Icons font ligature names.
const MATERIAL_ICONS = {
  add: AddIcon,
  add_circle_outline: AddCircleOutlineIcon,
  arrow_back: ArrowBackIcon,
  arrow_drop_down: ArrowDropDownIcon,
  bug_report: BugReportIcon,
  chevron_right: ChevronRightIcon,
  close: CloseIcon,
  compare_arrows: CompareArrowsIcon,
  content_cut: ContentCutIcon,
  crop_rotate: CropRotateIcon,
  delete: DeleteIcon,
  edit: EditIcon,
  expand_more: ExpandMoreIcon,
  info: InfoIcon,
  looks_one: LooksOneIcon,
  more_vert: MoreVertIcon,
  open_in_new: OpenInNewIcon,
  repeat: RepeatIcon,
  skip_next: SkipNextIcon,
  skip_previous: SkipPreviousIcon,
  slow_motion_video: SlowMotionVideoIcon,
  transform: TransformIcon,
  visibility: VisibilityIcon,
  visibility_off: VisibilityOffIcon,
  zoom_in: ZoomInIcon,
  zoom_out_map: ZoomOutMapIcon,
};

// The layer icons are keyed by layer type.
const SVG_ICONS = {
  addlayer: addLayerSvg,
  animation: animationSvg,
  animationblock: animationBlockSvg,
  autofix: autoFixSvg,
  collection: collectionSvg,
  contribute: contributeSvg,
  group: groupLayerSvg,
  mask: clipPathLayerSvg,
  path: pathLayerSvg,
  reverse: reverseSvg,
  shapeshifter: shapeShifterSvg,
  vector: vectorLayerSvg,
};

export type IconName = keyof typeof MATERIAL_ICONS | keyof typeof SVG_ICONS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const iconClassName = className ? `ss-icon ${className}` : 'ss-icon';
  if (name in SVG_ICONS) {
    const svg = SVG_ICONS[name as keyof typeof SVG_ICONS];
    return <span className={iconClassName} aria-hidden dangerouslySetInnerHTML={{ __html: svg }} />;
  }
  const MaterialIcon = MATERIAL_ICONS[name as keyof typeof MATERIAL_ICONS];
  return <MaterialIcon className={iconClassName} />;
}
