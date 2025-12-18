import { useEffect, useRef } from 'react';
import type { Stage as StageType } from 'konva/lib/Stage';
import { useEditorStore } from '../state/useEditorStore';
import type { BrushStroke, BrushLayer } from '../state/editorTypes';
import { loadImage } from '../../utils/image';

interface BrushToolProps {
  stageRef: React.RefObject<StageType | null>;
}

export const BrushTool = ({ stageRef }: BrushToolProps) => {
  const isDrawing = useRef(false);
  const currentPoints = useRef<number[]>([]);
  const currentLayerId = useRef<string | null>(null);
  
  // Subscribe to activeTool reactively so the effect re-runs when tool changes
  const activeTool = useEditorStore((state) => state.activeTool);
  
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    
    // Only activate when brush or eraser tool is active
    if (activeTool !== 'brush' && activeTool !== 'eraser') {
      // Reset cursor when not brush/eraser
      const container = stage.container();
      if (container) {
        container.style.cursor = 'default';
      }
      return;
    }

    const getState = () => useEditorStore.getState();
    
    const getLayerTypeName = (type: string): string => {
      const typeMap: Record<string, string> = {
        'brush': 'Brush',
        'text': 'Text',
        'rect': 'Rectangle',
        'circle': 'Ellipse',
        'line': 'Line',
        'star': 'Star',
        'image': 'Image',
        'texture': 'Texture',
      };
      return typeMap[type] || 'Layer';
    };

    const nextLayerName = (layerType: string) => {
      const { layers } = getState();
      const baseName = getLayerTypeName(layerType);
      let index = 1;
      while (layers.some((l) => l.name === `${baseName} ${index}`)) {
        index += 1;
      }
      return `${baseName} ${index}`;
    };

    // Get or create brush layer
    const ensureBrushLayer = (): BrushLayer | null => {
      const state = getState();
      const { layers, selectedLayerId, addLayer, setSelection } = state;
      
      // First check if selected layer is a brush layer
      if (selectedLayerId) {
        const selected = layers.find(l => l.id === selectedLayerId);
        if (selected?.type === 'brush') {
          return selected as BrushLayer;
        }
      }
      
      // Find any existing brush layer
      let brushLayer = layers.find(l => l.type === 'brush') as BrushLayer | undefined;
      
      if (!brushLayer) {
        // Create new brush layer
        addLayer({
          type: 'brush',
          name: nextLayerName('brush'),
          strokes: [],
          visible: true,
          locked: false,
          opacity: 1,
          x: 0,
          y: 0,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        });
        
        // Get the newly created layer
        const newState = getState();
        brushLayer = newState.layers.find(l => l.type === 'brush') as BrushLayer;
        if (brushLayer) {
          setSelection(brushLayer.id);
        }
      } else {
        setSelection(brushLayer.id);
      }
      
      return brushLayer || null;
    };

    // Get correct pointer position accounting for CSS transform
    const getCorrectPointerPosition = () => {
      const pos = stage.getPointerPosition();
      if (!pos) return null;
      
      // Get the CSS scale from the canvas wrapper
      const container = stage.container();
      if (!container) return pos;
      
      const wrapper = container.closest('.canvas-wrapper');
      if (!wrapper) return pos;
      
      // Get the computed transform scale
      const style = window.getComputedStyle(wrapper);
      const transform = style.transform;
      
      if (transform && transform !== 'none') {
        // Extract scale from matrix(a, b, c, d, tx, ty) where a is scaleX
        const match = transform.match(/matrix\(([^,]+)/);
        if (match) {
          const cssScale = parseFloat(match[1]);
          if (cssScale && cssScale !== 1) {
            // Konva returns screen coordinates, need to convert to canvas coordinates
            // The container's bounding rect is already scaled, so we need to adjust
            return { x: pos.x, y: pos.y };
          }
        }
      }
      
      return pos;
    };

    const handleMouseDown = (e: any) => {
      // Prevent drawing on transformer handles
      const target = e.target;
      if (target !== stage && target.getClassName?.() !== 'Layer') {
        const parent = target.getParent?.();
        if (parent?.getClassName?.() === 'Transformer') {
          return;
        }
      }
      
      const brushLayer = ensureBrushLayer();
      if (!brushLayer || brushLayer.locked) return;
      
      e.cancelBubble = true;
      isDrawing.current = true;
      currentLayerId.current = brushLayer.id;
      
      const pos = getCorrectPointerPosition();
      if (pos) {
        currentPoints.current = [pos.x, pos.y];
      }
    };

    const handleMouseMove = () => {
      if (!isDrawing.current || !currentLayerId.current) return;
      
      const pos = getCorrectPointerPosition();
      if (!pos) return;
      
      const { brushSettings } = getState();
      
      // Calculate spacing-based minimum distance
      // Spacing is percentage of brush size (e.g., 25% = brush stamps every 25% of size)
      const spacingDistance = (brushSettings.size * (brushSettings.spacing || 25)) / 100;
      const minDistance = Math.max(1, spacingDistance);
      
      const lastX = currentPoints.current[currentPoints.current.length - 2];
      const lastY = currentPoints.current[currentPoints.current.length - 1];
      
      // Only add point if moved enough (based on spacing)
      const dx = pos.x - lastX;
      const dy = pos.y - lastY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance >= minDistance) {
        // Apply smoothing if enabled
        let finalX = pos.x;
        let finalY = pos.y;
        
        if (brushSettings.smoothing && brushSettings.smoothing > 0 && currentPoints.current.length >= 2) {
          // Smoothing: interpolate between last point and current position
          // Higher smoothing = more interpolation (smoother but less responsive)
          const smoothingFactor = brushSettings.smoothing / 100;
          const lastX = currentPoints.current[currentPoints.current.length - 2];
          const lastY = currentPoints.current[currentPoints.current.length - 1];
          finalX = lastX + (pos.x - lastX) * (1 - smoothingFactor * 0.5);
          finalY = lastY + (pos.y - lastY) * (1 - smoothingFactor * 0.5);
        }
        
        currentPoints.current.push(finalX, finalY);
        
        // Update the layer with current stroke for real-time preview
        const state = getState();
        const layer = state.layers.find(l => l.id === currentLayerId.current);
        if (layer && layer.type === 'brush') {
          const brushLayer = layer as BrushLayer;
          const { activeTool, brushSettings } = state;
          
          // Create preview stroke
          const previewStroke: BrushStroke = {
            points: [...currentPoints.current],
            color: activeTool === 'eraser' ? 'transparent' : brushSettings.color,
            size: brushSettings.size,
            hardness: brushSettings.hardness,
            opacity: brushSettings.opacity / 100,
            flow: brushSettings.flow,
            blendMode: activeTool === 'eraser' ? 'normal' : brushSettings.blendMode,
          };
          
          // Get committed strokes (all except temporary preview)
          const committedStrokes = brushLayer.strokes.filter(s => !(s as any)._preview);
          
          // Update with committed strokes + preview
          const previewWithFlag = { ...previewStroke, _preview: true };
          state.updateLayer(currentLayerId.current!, { 
            strokes: [...committedStrokes, previewWithFlag] 
          });
        }
      }
    };

    const handleMouseUp = () => {
      if (!isDrawing.current || !currentLayerId.current) return;
      
      const state = getState();
      const layer = state.layers.find(l => l.id === currentLayerId.current);
      
      if (layer && layer.type === 'brush' && currentPoints.current.length >= 4) {
        const { activeTool, brushSettings } = state;
        
        // Create final stroke
        const finalStroke: BrushStroke = {
          points: [...currentPoints.current],
          color: activeTool === 'eraser' ? 'transparent' : brushSettings.color,
          size: brushSettings.size,
          hardness: brushSettings.hardness,
          opacity: brushSettings.opacity / 100,
          flow: brushSettings.flow,
          blendMode: activeTool === 'eraser' ? 'normal' : brushSettings.blendMode,
        };
        
        // Add final stroke
        state.addBrushStroke(currentLayerId.current!, finalStroke);
        
        // Clean up any preview strokes
        const updatedState = getState();
        const updatedLayer = updatedState.layers.find(l => l.id === currentLayerId.current) as BrushLayer;
        if (updatedLayer) {
          const cleanStrokes = updatedLayer.strokes.filter(s => !(s as any)._preview);
          if (cleanStrokes.length !== updatedLayer.strokes.length) {
            state.updateLayer(currentLayerId.current!, { strokes: cleanStrokes });
          }
        }
      } else if (layer && layer.type === 'brush') {
        // Remove any preview strokes if stroke was too short
        const currentBrushLayer = layer as BrushLayer;
        const committedStrokes = currentBrushLayer.strokes.filter(s => !(s as any)._preview);
        if (committedStrokes.length !== currentBrushLayer.strokes.length) {
          state.updateLayer(currentLayerId.current!, { strokes: committedStrokes });
        }
      }
      
      isDrawing.current = false;
      currentPoints.current = [];
      currentLayerId.current = null;
    };

    // Attach events
    stage.on('mousedown touchstart', handleMouseDown);
    stage.on('mousemove touchmove', handleMouseMove);
    stage.on('mouseup touchend mouseleave', handleMouseUp);

    // Hide default cursor - we'll use custom brush cursor
    const container = stage.container();
    if (container) {
      container.style.cursor = 'none';
    }

    return () => {
      stage.off('mousedown touchstart', handleMouseDown);
      stage.off('mousemove touchmove', handleMouseMove);
      stage.off('mouseup touchend mouseleave', handleMouseUp);
      
      if (container) {
        container.style.cursor = 'default';
      }
    };
  }, [stageRef, activeTool]);

  // Handle keyboard shortcuts for tools
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      const { setActiveTool, addLayer, setBrushSettings, brushSettings } = useEditorStore.getState();
      
      const getLayerTypeName = (type: string): string => {
        const typeMap: Record<string, string> = {
          'brush': 'Brush',
          'text': 'Text',
          'rect': 'Rectangle',
          'circle': 'Ellipse',
          'line': 'Line',
          'star': 'Star',
          'image': 'Image',
          'texture': 'Texture',
          'fill': 'Fill',
        };
        return typeMap[type] || 'Layer';
      };

      const nextLayerName = (layerType: string) => {
        const { layers } = useEditorStore.getState();
        const baseName = getLayerTypeName(layerType);
        let index = 1;
        while (layers.some((l) => l.name === `${baseName} ${index}`)) {
          index += 1;
        }
        return `${baseName} ${index}`;
      };
      
      switch (e.key.toLowerCase()) {
        case 'v':
          setActiveTool('select');
          break;
        case 'b':
          setActiveTool('brush');
          break;
        case 'e':
          setActiveTool('eraser');
          break;
        case 't':
          addLayer({
            type: 'text',
            name: nextLayerName('text'),
            text: 'Sample Text',
            fontSize: 48,
            fontFamily: 'Arial',
            fill: '#ffffff',
            align: 'left',
            verticalAlign: 'top',
            fontStyle: 'normal',
            textDecoration: 'none',
            visible: true,
            locked: false,
            opacity: 1,
            x: 100,
            y: 100,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          });
          setActiveTool('select');
          break;
        case 'u':
          addLayer({
            type: 'rect',
            name: nextLayerName('rect'),
            width: 200,
            height: 100,
            fill: '#B73038',
            visible: true,
            locked: false,
            opacity: 1,
            x: 100,
            y: 100,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          });
          setActiveTool('select');
          break;
        case 'o':
          addLayer({
            type: 'circle',
            name: nextLayerName('circle'),
            radius: 50,
            fill: '#D7DCDD',
            visible: true,
            locked: false,
            opacity: 1,
            x: 150,
            y: 150,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          });
          setActiveTool('select');
          break;
        case 'l':
          addLayer({
            type: 'line',
            name: nextLayerName('line'),
            points: [100, 100, 300, 200],
            stroke: '#ffffff',
            strokeWidth: 4,
            lineCap: 'round',
            lineJoin: 'round',
            visible: true,
            locked: false,
            opacity: 1,
            x: 0,
            y: 0,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          });
          setActiveTool('select');
          break;
        case 's':
          addLayer({
            type: 'star',
            name: nextLayerName('star'),
            numPoints: 5,
            innerRadius: 30,
            outerRadius: 60,
            fill: '#ffffff',
            stroke: '#ffffff',
            strokeWidth: 1,
            visible: true,
            locked: false,
            opacity: 1,
            x: 200,
            y: 200,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          });
          setActiveTool('select');
          break;
        case 'i':
          // Image tool - trigger file input
          {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (!file) return;

              const reader = new FileReader();
              reader.onload = async (event) => {
                const src = event.target?.result as string;
                try {
                  const img = await loadImage(src);
                  addLayer({
                    type: 'image',
                    name: nextLayerName('image'),
                    src,
                    image: img,
                    visible: true,
                    locked: false,
                    opacity: 1,
                    x: 100,
                    y: 100,
                    rotation: 0,
                    scaleX: 1,
                    scaleY: 1,
                  });
                  setActiveTool('select');
                } catch (error) {
                  console.error('Failed to load image:', error);
                }
              };
              reader.readAsDataURL(file);
            };
            input.click();
          }
          break;
        case 'x':
          // Texture tool - trigger file input
          {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (!file) return;

              const reader = new FileReader();
              reader.onload = async (event) => {
                const src = event.target?.result as string;
                try {
                  const img = await loadImage(src);
                  addLayer({
                    type: 'texture',
                    name: nextLayerName('texture'),
                    src,
                    image: img,
                    visible: true,
                    locked: false,
                    opacity: 1,
                    x: 0,
                    y: 0,
                    rotation: 0,
                    scaleX: 1,
                    scaleY: 1,
                  });
                  setActiveTool('select');
                } catch (error) {
                  console.error('Failed to load texture:', error);
                }
              };
              reader.readAsDataURL(file);
            };
            input.click();
          }
          break;
        case 'f':
          setActiveTool('fill');
          break;
        case '[':
          setBrushSettings({ size: Math.max(1, brushSettings.size - 5) });
          break;
        case ']':
          setBrushSettings({ size: Math.min(200, brushSettings.size + 5) });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return null;
};
