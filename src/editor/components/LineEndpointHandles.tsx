import { Circle } from 'react-konva';
import { useEffect, useRef } from 'react';
import type Konva from 'konva';
import { useEditorStore } from '../state/useEditorStore';

interface LineEndpointHandlesProps {
  layerId: string;
}

export const LineEndpointHandles = ({ layerId }: LineEndpointHandlesProps) => {
  const { layers, updateLayer, selectedLayerId } = useEditorStore();
  const startHandleRef = useRef<Konva.Circle>(null);
  const endHandleRef = useRef<Konva.Circle>(null);
  const lineNodeRef = useRef<Konva.Line | null>(null);
  const isDraggingHandleRef = useRef<'start' | 'end' | null>(null);

  const layer = layers.find(l => l.id === layerId);
  
  if (!layer || layer.type !== 'line' || selectedLayerId !== layerId) {
    return null;
  }

  const points = layer.points || [0, 0, 0, 0];
  const layerX = layer.x || 0;
  const layerY = layer.y || 0;
  
  // Absolute positions of endpoints on stage
  const startX = points[0] + layerX;
  const startY = points[1] + layerY;
  const endX = points[2] + layerX;
  const endY = points[3] + layerY;

  // Find and track the line node to listen to its drag events
  useEffect(() => {
    const stage = startHandleRef.current?.getStage();
    if (!stage) return;

    const lineNode = stage.findOne(`#${layerId}`) as Konva.Line;
    if (lineNode) {
      lineNodeRef.current = lineNode;

      // Update handle positions during line dragging
      const handleLineDragMove = () => {
        if (!lineNode || !startHandleRef.current || !endHandleRef.current) return;
        
        // Get current line position (may be different from store during drag)
        const currentLineX = lineNode.x();
        const currentLineY = lineNode.y();
        
        // Update handle positions to match line movement
        const newStartX = points[0] + currentLineX;
        const newStartY = points[1] + currentLineY;
        const newEndX = points[2] + currentLineX;
        const newEndY = points[3] + currentLineY;
        
        startHandleRef.current.x(newStartX);
        startHandleRef.current.y(newStartY);
        endHandleRef.current.x(newEndX);
        endHandleRef.current.y(newEndY);
      };

      lineNode.on('dragmove', handleLineDragMove);
      
      return () => {
        lineNode.off('dragmove', handleLineDragMove);
      };
    }
  }, [layerId, points]);

  // Update handle positions when layer changes (from store updates)
  // Skip update if a handle is currently being dragged
  useEffect(() => {
    if (isDraggingHandleRef.current) return; // Don't interfere with active dragging
    
    if (startHandleRef.current) {
      startHandleRef.current.x(startX);
      startHandleRef.current.y(startY);
    }
    if (endHandleRef.current) {
      endHandleRef.current.x(endX);
      endHandleRef.current.y(endY);
    }
  }, [startX, startY, endX, endY]);

  // Handle start point drag
  useEffect(() => {
    const startHandle = startHandleRef.current;
    if (!startHandle) return;

    const handleDragStart = () => {
      isDraggingHandleRef.current = 'start';
    };

    const handleDragMove = () => {
      // Get current layer state (may have changed if line was dragged)
      const currentLayer = layers.find(l => l.id === layerId);
      if (!currentLayer || currentLayer.type !== 'line') return;
      
      const currentX = startHandle.x();
      const currentY = startHandle.y();
      const currentLayerX = currentLayer.x || 0;
      const currentLayerY = currentLayer.y || 0;
      const currentPoints = currentLayer.points || [0, 0, 0, 0];
      
      // Convert absolute position back to relative points
      const newPointX = currentX - currentLayerX;
      const newPointY = currentY - currentLayerY;
      updateLayer(layerId, {
        points: [newPointX, newPointY, currentPoints[2], currentPoints[3]],
      });
    };

    const handleDragEnd = () => {
      isDraggingHandleRef.current = null;
    };

    startHandle.on('dragstart', handleDragStart);
    startHandle.on('dragmove', handleDragMove);
    startHandle.on('dragend', handleDragEnd);
    return () => {
      startHandle.off('dragstart', handleDragStart);
      startHandle.off('dragmove', handleDragMove);
      startHandle.off('dragend', handleDragEnd);
    };
  }, [layerId, layers, updateLayer]);

  // Handle end point drag
  useEffect(() => {
    const endHandle = endHandleRef.current;
    if (!endHandle) return;

    const handleDragStart = () => {
      isDraggingHandleRef.current = 'end';
    };

    const handleDragMove = () => {
      // Get current layer state (may have changed if line was dragged)
      const currentLayer = layers.find(l => l.id === layerId);
      if (!currentLayer || currentLayer.type !== 'line') return;
      
      const currentX = endHandle.x();
      const currentY = endHandle.y();
      const currentLayerX = currentLayer.x || 0;
      const currentLayerY = currentLayer.y || 0;
      const currentPoints = currentLayer.points || [0, 0, 0, 0];
      
      // Convert absolute position back to relative points
      const newPointX = currentX - currentLayerX;
      const newPointY = currentY - currentLayerY;
      updateLayer(layerId, {
        points: [currentPoints[0], currentPoints[1], newPointX, newPointY],
      });
    };

    const handleDragEnd = () => {
      isDraggingHandleRef.current = null;
    };

    endHandle.on('dragstart', handleDragStart);
    endHandle.on('dragmove', handleDragMove);
    endHandle.on('dragend', handleDragEnd);
    return () => {
      endHandle.off('dragstart', handleDragStart);
      endHandle.off('dragmove', handleDragMove);
      endHandle.off('dragend', handleDragEnd);
    };
  }, [layerId, layers, updateLayer]);

  const handleSize = 8;
  const handleStrokeWidth = 2;

  // Prevent event propagation so handles don't interfere with line selection
  const handleClick = (e: any) => {
    e.cancelBubble = true;
  };

  return (
    <>
      {/* Start point handle */}
      <Circle
        ref={startHandleRef}
        x={startX}
        y={startY}
        radius={handleSize}
        fill="#ffffff"
        stroke="#B73038"
        strokeWidth={handleStrokeWidth}
        draggable={!layer.locked}
        listening={!layer.locked}
        onClick={handleClick}
        onTap={handleClick}
      />
      {/* End point handle */}
      <Circle
        ref={endHandleRef}
        x={endX}
        y={endY}
        radius={handleSize}
        fill="#ffffff"
        stroke="#B73038"
        strokeWidth={handleStrokeWidth}
        draggable={!layer.locked}
        listening={!layer.locked}
        onClick={handleClick}
        onTap={handleClick}
      />
    </>
  );
};
