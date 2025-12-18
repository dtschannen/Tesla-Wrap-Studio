import { useEffect, useState } from 'react';
import { Circle, Group } from 'react-konva';
import type { Stage as StageType } from 'konva/lib/Stage';
import { useEditorStore } from '../state/useEditorStore';

interface BrushCursorProps {
  stageRef: React.RefObject<StageType | null>;
}

export const BrushCursor = ({ stageRef }: BrushCursorProps) => {
  const { activeTool, brushSettings } = useEditorStore();
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || (activeTool !== 'brush' && activeTool !== 'eraser')) {
      setIsVisible(false);
      return;
    }

    // Get zoom from stage scale
    const updateZoom = () => {
      const stage = stageRef.current;
      if (stage) {
        const scale = stage.scaleX();
        setZoom(scale);
      }
    };

    const handleMouseMove = () => {
      const pos = stage.getPointerPosition();
      if (pos) {
        setPosition(pos);
        setIsVisible(true);
        updateZoom();
      }
    };

    const handleMouseDown = () => {
      setIsDrawing(true);
    };

    const handleMouseUp = () => {
      setIsDrawing(false);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
      setIsDrawing(false);
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
      updateZoom();
    };

    // Initial zoom update
    updateZoom();

    stage.on('mousemove', handleMouseMove);
    stage.on('mousedown', handleMouseDown);
    stage.on('mouseup', handleMouseUp);
    stage.on('mouseleave', handleMouseLeave);
    stage.on('mouseenter', handleMouseEnter);

    // Also listen on container for when mouse leaves canvas area
    const container = stage.container();
    if (container) {
      container.addEventListener('mouseleave', handleMouseLeave);
      container.addEventListener('mouseenter', handleMouseEnter);
    }

    return () => {
      stage.off('mousemove', handleMouseMove);
      stage.off('mousedown', handleMouseDown);
      stage.off('mouseup', handleMouseUp);
      stage.off('mouseleave', handleMouseLeave);
      stage.off('mouseenter', handleMouseEnter);
      if (container) {
        container.removeEventListener('mouseleave', handleMouseLeave);
        container.removeEventListener('mouseenter', handleMouseEnter);
      }
    };
  }, [stageRef, activeTool, brushSettings.size, brushSettings.hardness]);

  // Hide cursor when drawing
  if (!isVisible || !position || isDrawing || (activeTool !== 'brush' && activeTool !== 'eraser')) {
    return null;
  }

  // Account for zoom - cursor size should appear consistent on screen
  const radius = (brushSettings.size / 2) / zoom;
  const hardness = brushSettings.hardness / 100;
  const outerRadius = radius;
  const innerRadius = radius * hardness;

  return (
    <Group listening={false} perfectDrawEnabled={false}>
      {/* Outer circle (brush boundary) - white with slight shadow for visibility */}
      <Circle
        x={position.x}
        y={position.y}
        radius={outerRadius}
        stroke="#ffffff"
        strokeWidth={1.5}
        fill="transparent"
        listening={false}
        perfectDrawEnabled={false}
        shadowBlur={2}
        shadowColor="#000000"
        shadowOpacity={0.5}
      />
      {/* Inner circle (hardness indicator) - dashed for soft edges */}
      {hardness < 1 && innerRadius > 2 && (
        <Circle
          x={position.x}
          y={position.y}
          radius={innerRadius}
          stroke="#ffffff"
          strokeWidth={1}
          fill="transparent"
          listening={false}
          perfectDrawEnabled={false}
          dash={[3, 3]}
          shadowBlur={1}
          shadowColor="#000000"
          shadowOpacity={0.3}
        />
      )}
      {/* Center crosshair dot */}
      <Circle
        x={position.x}
        y={position.y}
        radius={1.5}
        fill="#ffffff"
        listening={false}
        perfectDrawEnabled={false}
        shadowBlur={1}
        shadowColor="#000000"
        shadowOpacity={0.5}
      />
    </Group>
  );
};
