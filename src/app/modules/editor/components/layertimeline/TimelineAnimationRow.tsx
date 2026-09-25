import { useAppSelector } from 'app/modules/editor/hooks/useAppSelector';
import type { Layer } from 'app/modules/editor/model/layers';
import * as ModelUtil from 'app/modules/editor/scripts/common/ModelUtil';
import { getTimelineAnimationRowState } from 'app/modules/editor/store/common/selectors';
import _ from 'lodash';
import { memo, useMemo } from 'react';

import { useLayerTimelineController } from './LayerTimelineContext';
import './timelineanimationrow.scss';

/**
 * Shows the layer's animation blocks, and (recursively) those of its children.
 */
export const TimelineAnimationRow = memo(function TimelineAnimationRow({
  layer,
}: {
  layer: Layer;
}) {
  const controller = useLayerTimelineController();
  const { animation, collapsedLayerIds, selectedBlockIds, isActionMode } = useAppSelector(
    getTimelineAnimationRowState,
  );
  // A list of animation block lists. Each animation block list corresponds to
  // a property name displayed in the layer list tree.
  const blocksByPropertyNameValues = useMemo(
    () => _.values(ModelUtil.getOrderedBlocksByPropertyByLayer(animation)[layer.id]),
    [animation, layer.id],
  );
  const isExpanded = !collapsedLayerIds.has(layer.id);

  return (
    <div className="app-timelineanimationrow">
      <div className="slt-layer-row" />
      {isExpanded && (
        <div
          className={`slt-properties${blocksByPropertyNameValues.length ? '' : ' slt-properties-empty'}`}
        >
          {blocksByPropertyNameValues.map(blocks => (
            <div className="slt-property" key={blocks[0].propertyName}>
              {blocks.map(block => {
                const isSelected = selectedBlockIds.has(block.id);
                const isAnimatable = block.isAnimatable();
                const classNames = [
                  'slt-timeline-block',
                  isActionMode && 'is-disabled',
                  isAnimatable && isSelected && 'is-selected',
                  !isAnimatable && !isSelected && 'has-error',
                  !isAnimatable && isSelected && 'is-selected-with-error',
                ];
                return (
                  <div
                    key={block.id}
                    className={classNames.filter(Boolean).join(' ')}
                    tabIndex={-1}
                    style={{
                      left: `${(100 * block.startTime) / animation.duration}%`,
                      width: `${(100 * (block.endTime - block.startTime)) / animation.duration}%`,
                    }}
                    onClick={event => {
                      event.stopPropagation();
                      if (!isActionMode) {
                        controller.onTimelineBlockClick(event.nativeEvent, block);
                      }
                    }}
                    onDoubleClick={event => {
                      event.stopPropagation();
                      if (!isActionMode) {
                        controller.onTimelineBlockDoubleClick(event.nativeEvent, block);
                      }
                    }}
                    onMouseDown={event => {
                      if (!isActionMode) {
                        controller.onTimelineBlockMouseDown(event.nativeEvent, block);
                      }
                    }}
                  >
                    <div className="slt-timeline-block-edge slt-timeline-block-edge-start" />
                    <div className="slt-timeline-block-edge slt-timeline-block-edge-end" />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
      {isExpanded && layer.children.length > 0 && (
        <ul className="slt-children-row">
          {layer.children.map(child => (
            <li key={child.id}>
              <TimelineAnimationRow layer={child} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
