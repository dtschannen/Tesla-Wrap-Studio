import { Transformer } from 'react-konva';
import { useEffect, useRef } from 'react';
import type Konva from 'konva';

interface TransformerWrapperProps {
  selectedLayerId: string | null;
  layers: any[];
  onTransformMove?: (node: any) => void;
}

export const TransformerWrapper = ({ selectedLayerId, layers, onTransformMove }: TransformerWrapperProps) => {
  const transformerRef = useRef<Konva.Transformer>(null);
  const transformMoveCallbackRef = useRef(onTransformMove);

  // Keep callback ref updated
  useEffect(() => {
    transformMoveCallbackRef.current = onTransformMove;
  }, [onTransformMove]);

  useEffect(() => {
    if (!transformerRef.current || !selectedLayerId) return;

    const stage = transformerRef.current.getStage();
    if (!stage) return;

    // Don't show transformer for line layers (they use endpoint handles instead)
    const selectedLayer = layers.find(l => l.id === selectedLayerId);
    if (selectedLayer?.type === 'line') {
      transformerRef.current.nodes([]);
      return;
    }

    const selectedNode = stage.findOne(`#${selectedLayerId}`);
    if (selectedNode) {
      transformerRef.current.nodes([selectedNode]);
      transformerRef.current.getLayer()?.batchDraw();
      
      // Add transform move listener using stage mousemove
      let isMouseDown = false;
      
      const handleMouseDown = () => {
        isMouseDown = true;
      };
      
      const handleMouseUp = () => {
        isMouseDown = false;
      };
      
      const handleMouseMove = () => {
        if (isMouseDown && transformMoveCallbackRef.current) {
          // Check if transformer is attached (means we're transforming)
          const attachedNodes = transformerRef.current?.nodes();
          if (attachedNodes && attachedNodes.length > 0) {
            transformMoveCallbackRef.current(selectedNode);
          }
        }
      };
      
      stage.on('mousedown', handleMouseDown);
      stage.on('mouseup', handleMouseUp);
      stage.on('mousemove', handleMouseMove);
      
      return () => {
        stage.off('mousedown', handleMouseDown);
        stage.off('mouseup', handleMouseUp);
        stage.off('mousemove', handleMouseMove);
      };
    } else {
      transformerRef.current.nodes([]);
    }
  }, [selectedLayerId, layers]);

  if (!selectedLayerId) return null;

  // Find the selected layer to check its type
  const selectedLayer = layers.find(l => l.id === selectedLayerId);
  const isImageLayer = selectedLayer?.type === 'image';
  
  // For image layers, preserve aspect ratio
  const keepRatio = isImageLayer;

  return (
    <Transformer
      ref={transformerRef}
      boundBoxFunc={(oldBox: any, newBox: any) => {
        // Limit resize
        if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
          return oldBox;
        }
        
        // For image layers, maintain aspect ratio
        if (isImageLayer) {
          const oldAspectRatio = Math.abs(oldBox.width / oldBox.height);
          const newAspectRatio = Math.abs(newBox.width / newBox.height);
          
          // If aspect ratio changed significantly, maintain the original
          if (Math.abs(newAspectRatio - oldAspectRatio) > 0.01) {
            // Determine which dimension changed more
            const widthChange = Math.abs(newBox.width - oldBox.width);
            const heightChange = Math.abs(newBox.height - oldBox.height);
            
            if (widthChange > heightChange) {
              // Width changed more, adjust height
              newBox.height = Math.abs(newBox.width / oldAspectRatio) * (newBox.height < 0 ? -1 : 1);
            } else {
              // Height changed more, adjust width
              newBox.width = Math.abs(newBox.height * oldAspectRatio) * (newBox.width < 0 ? -1 : 1);
            }
          }
        }
        
        // Call transform move callback to check for snapping
        if (transformMoveCallbackRef.current && selectedLayerId) {
          const stage = transformerRef.current?.getStage();
          if (stage) {
            const selectedNode = stage.findOne(`#${selectedLayerId}`);
            if (selectedNode) {
              // Use requestAnimationFrame to avoid calling during the transform
              requestAnimationFrame(() => {
                transformMoveCallbackRef.current?.(selectedNode);
              });
            }
          }
        }
        
        return newBox;
      }}
      // Modern styling for transformer - Tesla red theme
      borderEnabled={true}
      borderStroke="#B73038"
      borderStrokeWidth={2}
      borderDash={[5, 5]}
      anchorFill="#ffffff"
      anchorStroke="#B73038"
      anchorStrokeWidth={2}
      anchorSize={10}
      rotateAnchorOffset={30}
      // Better visual feedback
      keepRatio={keepRatio}
      centeredScaling={false}
      enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center', 'bottom-center', 'middle-left', 'middle-right']}
    />
  );
};

