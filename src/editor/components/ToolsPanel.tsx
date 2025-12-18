import { useEditorStore } from '../state/useEditorStore';
import type { ToolType } from '../state/editorTypes';
import { loadImage } from '../../utils/image';
import {
  Move,
  Brush,
  Eraser,
  Type,
  RectangleHorizontal,
  Circle,
  Minus,
  Star,
  Image as ImageIcon,
  Layers,
  PaintBucket,
} from 'lucide-react';

export const ToolsPanel = () => {
  const { activeTool, setActiveTool, addLayer, setSelection } = useEditorStore();

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

  const tools: { id: ToolType; label: string; icon: React.ReactNode; shortcut: string }[] = [
    {
      id: 'select',
      label: 'Move Tool',
      shortcut: 'V',
      icon: <Move className="w-5 h-5" />,
    },
    {
      id: 'brush',
      label: 'Brush Tool',
      shortcut: 'B',
      icon: <Brush className="w-5 h-5" />,
    },
    {
      id: 'eraser',
      label: 'Eraser Tool',
      shortcut: 'E',
      icon: <Eraser className="w-5 h-5" />,
    },
    {
      id: 'text',
      label: 'Text Tool',
      shortcut: 'T',
      icon: <Type className="w-5 h-5" />,
    },
    {
      id: 'fill',
      label: 'Fill Tool',
      shortcut: 'F',
      icon: <PaintBucket className="w-5 h-5" />,
    },
    {
      id: 'rectangle',
      label: 'Rectangle Tool',
      shortcut: 'U',
      icon: <RectangleHorizontal className="w-5 h-5" />,
    },
    {
      id: 'circle',
      label: 'Ellipse Tool',
      shortcut: 'O',
      icon: <Circle className="w-5 h-5" />,
    },
    {
      id: 'line',
      label: 'Line Tool',
      shortcut: 'L',
      icon: <Minus className="w-5 h-5" />,
    },
    {
      id: 'star',
      label: 'Star Tool',
      shortcut: 'S',
      icon: <Star className="w-5 h-5" />,
    },
    {
      id: 'image',
      label: 'Image Tool',
      shortcut: 'I',
      icon: <ImageIcon className="w-5 h-5" />,
    },
    {
      id: 'texture',
      label: 'Texture Tool',
      shortcut: 'X',
      icon: <Layers className="w-5 h-5" />,
    },
  ];

  const handleToolSelect = (tool: ToolType) => {
    setActiveTool(tool);
    
    // When switching to brush tool, auto-create or select a brush layer
    if (tool === 'brush' || tool === 'eraser') {
      const { layers } = useEditorStore.getState();
      const existingBrushLayer = layers.find(l => l.type === 'brush');
      
      if (existingBrushLayer) {
        setSelection(existingBrushLayer.id);
      } else {
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
      }
      return;
    }
    
    // When selecting shape tools, create a new layer immediately
    if (tool === 'text') {
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
    }
    
    if (tool === 'rectangle') {
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
    }
    
    if (tool === 'circle') {
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
    }
    
    if (tool === 'line') {
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
    }
    
    if (tool === 'star') {
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
    }
    
    if (tool === 'image') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          setActiveTool('select');
          return;
        }

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
            setActiveTool('select');
          }
        };
        reader.readAsDataURL(file);
      };
      input.click();
    }
    
    if (tool === 'texture') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          setActiveTool('select');
          return;
        }

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
            setActiveTool('select');
          }
        };
        reader.readAsDataURL(file);
      };
      input.click();
    }
  };

  return (
    <div className="h-full panel rounded-xl flex flex-col w-16 overflow-hidden shadow-lg">
      {/* Tool Buttons */}
      <div className="flex-1 p-2 space-y-1.5 overflow-y-auto overflow-x-hidden scrollbar-thin">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => handleToolSelect(tool.id)}
            className={`w-full p-2 rounded-lg transition-all duration-200 flex items-center justify-center relative group ${
              activeTool === tool.id
                ? 'bg-tesla-red text-white shadow-md shadow-tesla-red/40'
                : 'text-tesla-gray hover:text-tesla-light hover:bg-tesla-dark/40'
            }`}
            title={`${tool.label} (${tool.shortcut})`}
          >
            {tool.icon}
            {/* Tooltip */}
            <div className="absolute left-full ml-3 px-3 py-1.5 bg-tesla-black/95 border border-tesla-dark/50 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
              {tool.label} <span className="text-tesla-gray">({tool.shortcut})</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
