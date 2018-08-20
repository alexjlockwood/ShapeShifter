import * as paper from 'paper';

// By default paper.js bakes matrix transformations directly into its children.
// This is usually not the behavior we want (especially for groups).
paper.settings.applyMatrix = false;

// By default paper.js automatically inserts newly created items into the active layer.
// This behavior makes it harder to explicitly position things in the item hierarchy.
paper.settings.insertItems = false;

export { PaperProject } from './PaperProject';
