import { Line, Arrow } from 'react-konva';
import type { LineLayer as LineLayerType } from '../../state/editorTypes';

interface LineLayerProps {
  layer: LineLayerType;
  id?: string;
  onClick?: (e: any) => void;
  onTap?: (e: any) => void;
  onDragStart?: (e: any) => void;
  onDragMove?: (e: any) => void;
  onDragEnd?: (e: any) => void;
  onTransformStart?: (e: any) => void;
  onTransformEnd?: (e: any) => void;
  draggable?: boolean;
}

export const LineLayer = ({
  layer,
  id,
  onClick,
  onTap,
  onDragStart,
  onDragMove,
  onDragEnd,
  onTransformStart,
  onTransformEnd,
  draggable,
}: LineLayerProps) => {
  // Make line easier to grab by increasing hit stroke width
  // This makes the draggable area larger without changing visual appearance
  const hitStrokeWidth = Math.max(layer.strokeWidth || 4, 20);

  const commonProps = {
    id: id || layer.id,
    points: layer.points,
    x: layer.x,
    y: layer.y,
    rotation: layer.rotation,
    scaleX: layer.scaleX,
    scaleY: layer.scaleY,
    opacity: layer.opacity,
    visible: layer.visible,
    stroke: layer.stroke,
    strokeWidth: layer.strokeWidth,
    lineCap: layer.lineCap || 'round',
    lineJoin: layer.lineJoin || 'round',
    dash: layer.dash,
    listening: !layer.locked,
    // Increase hit area for easier dragging
    hitStrokeWidth: hitStrokeWidth,
    perfectDrawEnabled: false,
    onClick,
    onTap,
    onDragStart,
    onDragMove,
    onDragEnd,
    onTransformStart,
    onTransformEnd,
    draggable,
  };

  // If either arrow is enabled, use Arrow component
  if (layer.arrowStart || layer.arrowEnd) {
    return (
      <Arrow
        {...commonProps}
        pointerAtBeginning={layer.arrowStart}
        pointerAtEnding={layer.arrowEnd}
        pointerLength={layer.strokeWidth * 3}
        pointerWidth={layer.strokeWidth * 3}
        fill={layer.stroke}
      />
    );
  }

  // Otherwise use regular Line
  return <Line {...commonProps} />;
};
