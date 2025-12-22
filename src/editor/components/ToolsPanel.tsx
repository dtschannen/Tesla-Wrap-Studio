import { useState, useRef, useEffect } from 'react';
import { useEditorStore } from '../state/useEditorStore';
import type { ToolType } from '../state/editorTypes';
import { loadImage, calculateImageScale } from '../../utils/image';
import {
  Move,
  Brush,
  Type,
  RectangleHorizontal,
  Circle,
  Minus,
  Star,
  Image as ImageIcon,
  Layers,
  PaintBucket,
  Sparkles,
  X,
} from 'lucide-react';
import { AIGeneratorDialog } from './AIGeneratorDialog';
import { useAuth } from '../../contexts/AuthContext';
import { LoginDialog } from '../../components/LoginDialog';
import Tooltip from '@mui/material/Tooltip';

interface ToolsPanelProps {
  openAIDialogOnMount?: boolean;
  onAIDialogOpened?: () => void;
}

export const ToolsPanel = ({ openAIDialogOnMount, onAIDialogOpened }: ToolsPanelProps = {}) => {
  const { activeTool, setActiveTool, addLayer, setSelection } = useEditorStore();
  const { user } = useAuth();
  const [isAIGeneratorDialogOpen, setIsAIGeneratorDialogOpen] = useState(false);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [showAITooltip, setShowAITooltip] = useState(false);
  const pendingAIOpenRef = useRef(false);
  const loginSuccessRef = useRef(false); // Track if login succeeded (to not clear pending on close)
  const aiToolButtonRef = useRef<HTMLButtonElement>(null);

  // Show tooltip every time the editor opens (but not if opening AI dialog)
  useEffect(() => {
    if (!openAIDialogOnMount) {
      // Small delay to ensure the button is rendered
      setTimeout(() => {
        setShowAITooltip(true);
      }, 500);
    }
  }, [openAIDialogOnMount]);

  // Open AI dialog on mount if requested (e.g., after Stripe redirect)
  useEffect(() => {
    if (openAIDialogOnMount && user) {
      setIsAIGeneratorDialogOpen(true);
      onAIDialogOpened?.();
    }
  }, [openAIDialogOnMount, user, onAIDialogOpened]);

  // Open AI dialog when user logs in and was trying to access it
  useEffect(() => {
    if (user && pendingAIOpenRef.current && !isLoginDialogOpen) {
      // User just logged in and was trying to access AI tool
      // Open AI dialog after a brief delay for state to settle
      const timer = setTimeout(() => {
        if (pendingAIOpenRef.current) {
          pendingAIOpenRef.current = false;
          loginSuccessRef.current = false;
          setIsAIGeneratorDialogOpen(true);
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [user, isLoginDialogOpen]);

  const handleDismissTooltip = () => {
    setShowAITooltip(false);
  };

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

  const tools: { id: ToolType | 'ai-textures'; label: string; icon: React.ReactNode; shortcut: string }[] = [
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
    {
      id: 'ai-textures',
      label: 'AI Textures',
      shortcut: 'A',
      icon: <Sparkles className="w-5 h-5" />,
    },
  ];

  const handleToolSelect = (tool: ToolType | 'ai-textures') => {
    // AI Textures: Check authentication first, then open dialog
    if (tool === 'ai-textures') {
      if (!user) {
        pendingAIOpenRef.current = true;
        setIsLoginDialogOpen(true);
        return;
      }
      setIsAIGeneratorDialogOpen(true);
      return;
    }
    
    setActiveTool(tool as ToolType);
    
    // BRUSH TOOL: Auto-create or select a brush layer for convenience
    if (tool === 'brush') {
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
        fill: '#000000',
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
        fill: '#B73038',
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
        stroke: '#B73038',
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
        fill: '#B73038',
        stroke: '#B73038',
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
            // Calculate scale to make long side ~300px
            const scale = calculateImageScale(img, 300);
            
            // Center the image on canvas (1024x1024)
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;
            const x = (1024 - scaledWidth) / 2;
            const y = (1024 - scaledHeight) / 2;
            
            addLayer({
              type: 'image',
              name: nextLayerName('image'),
              src,
              image: img,
              visible: true,
              locked: false,
              opacity: 1,
              x,
              y,
              rotation: 0,
              scaleX: scale,
              scaleY: scale,
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
    <>
      <div className="h-full panel rounded-xl flex flex-col w-16 overflow-hidden shadow-lg">
        {/* Tool Buttons */}
        <div className="flex-1 p-2 space-y-1.5 overflow-y-auto overflow-x-hidden scrollbar-thin">
          {tools.map((tool) => {
            // AI Textures tool uses both MUI tooltip and custom tooltip
            if (tool.id === 'ai-textures') {
              return (
                <Tooltip 
                  key={tool.id}
                  title={`${tool.label} (${tool.shortcut})`} 
                  placement="right" 
                  arrow
                >
                  <button
                    ref={aiToolButtonRef}
                    onClick={() => {
                      handleToolSelect(tool.id);
                      if (showAITooltip) {
                        handleDismissTooltip();
                      }
                    }}
                    className={`w-full p-2 rounded-lg transition-all duration-200 flex items-center justify-center ${
                      isAIGeneratorDialogOpen
                        ? 'bg-blue-500/20 text-blue-400'
                        : showAITooltip
                        ? 'bg-blue-500/25 text-blue-400 ring-1 ring-blue-400/50'
                        : 'text-tesla-gray hover:text-blue-400 hover:bg-blue-500/10'
                    }`}
                  >
                    {tool.icon}
                  </button>
                </Tooltip>
              );
            }
            
            // All other tools use MUI Tooltip
            return (
              <Tooltip 
                key={tool.id}
                title={`${tool.label} (${tool.shortcut})`} 
                placement="right" 
                arrow
              >
                <button
                  onClick={() => handleToolSelect(tool.id)}
                  className={`w-full p-2 rounded-lg transition-all duration-200 flex items-center justify-center ${
                    activeTool === tool.id
                      ? 'bg-tesla-red text-white shadow-md shadow-tesla-red/40'
                      : 'text-tesla-gray hover:text-tesla-light hover:bg-tesla-dark/40'
                  }`}
                >
                  {tool.icon}
                </button>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* AI Texture Generator Tooltip */}
      {showAITooltip && aiToolButtonRef.current && (
        <div className="fixed inset-0 z-[200] pointer-events-none">
          {/* Tooltip */}
          <div 
            className="absolute pointer-events-auto"
            style={{
              left: `${aiToolButtonRef.current.getBoundingClientRect().right + 12}px`,
              top: `${aiToolButtonRef.current.getBoundingClientRect().top + aiToolButtonRef.current.getBoundingClientRect().height / 2}px`,
              transform: 'translateY(-50%)',
            }}
          >
            <div className="relative bg-[#1c1c1e] rounded-lg p-3 shadow-xl border border-white/10 max-w-[200px]">
              {/* Arrow pointing LEFT to button */}
              <div 
                className="absolute w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[8px] border-r-[#1c1c1e]"
                style={{
                  left: '-8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
              
              {/* Content */}
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    <h3 className="text-white font-medium text-xs">AI Textures</h3>
                  </div>
                  <p className="text-white/60 text-[10px] leading-relaxed mb-2">
                    Generate unique wrap textures with AI
                  </p>
                  <button
                    onClick={() => {
                      handleDismissTooltip();
                      if (!user) {
                        pendingAIOpenRef.current = true;
                        setIsLoginDialogOpen(true);
                      } else {
                        setIsAIGeneratorDialogOpen(true);
                      }
                    }}
                    className="px-2.5 py-1 bg-blue-500 hover:bg-blue-400 text-white text-[10px] font-medium rounded transition-colors"
                  >
                    Try it
                  </button>
                </div>
                <button
                  onClick={handleDismissTooltip}
                  className="flex-shrink-0 p-0.5 hover:bg-white/10 rounded transition-colors -mt-0.5 -mr-0.5"
                  aria-label="Close tooltip"
                >
                  <X className="w-3 h-3 text-white/40 hover:text-white/60" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Login Dialog */}
      <LoginDialog
        isOpen={isLoginDialogOpen}
        onClose={() => {
          setIsLoginDialogOpen(false);
          // Only clear pending if user cancelled (not after successful login)
          // loginSuccessRef tracks if onSuccess was just called
          if (!loginSuccessRef.current) {
            pendingAIOpenRef.current = false;
          }
          loginSuccessRef.current = false; // Reset for next time
        }}
        onSuccess={() => {
          // Mark that login succeeded so onClose doesn't clear pending
          loginSuccessRef.current = true;
          // Close login dialog - the useEffect will detect user change and open AI dialog
          setIsLoginDialogOpen(false);
        }}
      />

      {/* AI Generator Dialog */}
      <AIGeneratorDialog
        isOpen={isAIGeneratorDialogOpen}
        onClose={() => setIsAIGeneratorDialogOpen(false)}
      />
    </>
  );
};
