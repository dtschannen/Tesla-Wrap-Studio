import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { 
  X, 
  Play, 
  Pause, 
  Eye,
  Move,
  ZoomIn,
  ZoomOut,
  Car,
} from 'lucide-react';
import type { Stage as StageType } from 'konva/lib/Stage';
import { useEditorStore } from '../editor/state/useEditorStore';
import { carModels } from '../data/carModels';
import logo from '../assets/logo-darktext.png';

// Debounce helper
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

interface GodotViewerProps {
  isOpen: boolean;
  onClose: () => void;
  stageRef: React.RefObject<StageType | null>;
}

// Public URL for the .pck file in Supabase Storage
const PCK_URL = 'https://mehvzkfcitccchzpqyfd.supabase.co/storage/v1/object/public/godot-assets/index.pck';

// Local storage key for first-time hint
const VIEWER_HINT_SHOWN_KEY = 'tesla-wrap-viewer-hint-shown';

export const GodotViewer = ({ isOpen, onClose, stageRef }: GodotViewerProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const godotReadyRef = useRef(false);
  const receivedRealProgressRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState<'loading' | 'initializing' | 'ready'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [godotReady, setGodotReady] = useState(false);
  const [, setCarLoaded] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showHints, setShowHints] = useState(false);
  const [iframeEverLoaded, setIframeEverLoaded] = useState(false);
  const [plateRegion, setPlateRegion] = useState<'us' | 'eu'>('us');
  const plateRegionRef = useRef<'us' | 'eu'>('us');
  const autoRotateRef = useRef<boolean>(true);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  
  const { currentModelId, layers, baseColor } = useEditorStore();
  const currentModel = carModels.find(m => m.id === currentModelId) || carModels.find(m => m.id === 'modely') || carModels[0];
  
  // Create a change signature to detect canvas updates
  const layersSignature = useMemo(() => {
    return JSON.stringify({
      baseColor,
      layerCount: layers.length,
      layerData: layers.map(l => ({
        id: l.id,
        type: l.type,
        visible: l.visible,
        opacity: l.opacity,
        x: l.x,
        y: l.y,
        rotation: l.rotation,
        scaleX: l.scaleX,
        scaleY: l.scaleY,
        // Type-specific properties for change detection
        ...(l.type === 'text' && { 
          text: (l as any).text, 
          fontSize: (l as any).fontSize, 
          fill: (l as any).fill,
          fontFamily: (l as any).fontFamily,
          fontStyle: (l as any).fontStyle,
        }),
        ...(l.type === 'brush' && { 
          strokeCount: (l as any).strokes?.length,
          // Include last stroke info for detection
          lastStroke: (l as any).strokes?.length > 0 ? (l as any).strokes[(l as any).strokes.length - 1]?.points?.length : 0,
        }),
        ...(l.type === 'image' && { 
          // Use image dimensions as proxy for content change
          width: (l as any).width,
          height: (l as any).height,
          // If src is a data URL, use its length as proxy
          srcLength: typeof (l as any).src === 'string' ? (l as any).src.length : 0,
        }),
        ...(['rect', 'circle', 'line', 'star'].includes(l.type) && {
          fill: (l as any).fill,
          stroke: (l as any).stroke,
          strokeWidth: (l as any).strokeWidth,
          width: (l as any).width,
          height: (l as any).height,
        }),
        ...(l.type === 'fill' && {
          fill: (l as any).color,
        }),
      }))
    });
  }, [layers, baseColor]);
  
  // Debounce the signature to avoid too many updates (200ms for responsive live preview)
  const debouncedSignature = useDebounce(layersSignature, 200);

  // Track last loaded model to prevent duplicate loads
  const lastLoadedModelRef = useRef<string | null>(null);

  // Check if this is first time viewing
  useEffect(() => {
    if (isOpen && godotReady) {
      const hintShown = localStorage.getItem(VIEWER_HINT_SHOWN_KEY);
      if (!hintShown) {
        setShowHints(true);
        // Auto-hide after 5 seconds
        const timer = setTimeout(() => {
          setShowHints(false);
          localStorage.setItem(VIEWER_HINT_SHOWN_KEY, 'true');
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, godotReady]);

  // Send message to Godot via postMessage
  const sendToGodot = useCallback((message: object) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(message, '*');
    }
  }, []);

  // Send texture to Godot from canvas
  const sendTextureToGodot = useCallback(() => {
    if (!stageRef.current || !godotReady) return;

    try {
      const stage = stageRef.current;
      
      // Hide UI elements that shouldn't be in the 3D preview (same as PNG export)
      const elementsToHide: { node: any; wasVisible: boolean }[] = [];
      
      // Hide transformer if it exists
      const transformer = stage.findOne('Transformer');
      if (transformer) {
        elementsToHide.push({ node: transformer, wasVisible: transformer.visible() });
        transformer.visible(false);
      }
      
      // Hide brush cursor groups (Groups with listening=false and Circle children)
      const allGroups = stage.find('Group');
      allGroups.forEach((node: any) => {
        if (node.listening() === false) {
          const children = node.getChildren();
          const hasCircles = children.some((child: any) => child.getClassName() === 'Circle');
          if (hasCircles && children.length >= 2) {
            elementsToHide.push({ node, wasVisible: node.visible() });
            node.visible(false);
          }
        }
      });
      
      // Hide cyan guide lines (center alignment guides)
      const allLines = stage.find('Line');
      allLines.forEach((lineNode: any) => {
        const stroke = lineNode.stroke();
        if (stroke === '#00FFFF' || stroke === '#00ffff' || stroke === 'rgb(0, 255, 255)' || stroke === 'cyan') {
          elementsToHide.push({ node: lineNode, wasVisible: lineNode.visible() });
          lineNode.visible(false);
        }
      });
      
      // Hide line endpoint handles (Circles with red stroke #B73038)
      const allCircles = stage.find('Circle');
      allCircles.forEach((circleNode: any) => {
        const stroke = circleNode.stroke();
        if (stroke === '#B73038') {
          elementsToHide.push({ node: circleNode, wasVisible: circleNode.visible() });
          circleNode.visible(false);
        }
      });
      
      // Force redraw to apply visibility changes
      stage.batchDraw();
      
      // Export at exactly 1024x1024 with pixelRatio 1 to match Godot UV2 mapping
      const dataUrl = stage.toDataURL({
        pixelRatio: 1,
        width: 1024,
        height: 1024,
        mimeType: 'image/png',
      });
      
      // Restore visibility of hidden elements
      elementsToHide.forEach(({ node, wasVisible }) => {
        node.visible(wasVisible);
      });
      
      // Force redraw to restore UI
      stage.batchDraw();

      sendToGodot({
        type: 'set_texture',
        texture: dataUrl,
      });
    } catch (err) {
      console.error('[GodotViewer] Failed to send texture:', err);
    }
  }, [stageRef, godotReady, sendToGodot]);

  // Listen for messages from Godot iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only handle messages from our iframe
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) {
        return;
      }

      const data = event.data;
      if (!data || typeof data !== 'object' || !data.type) return;

      switch (data.type) {
        case 'godot_ready':
          // Ignore if already ready (prevent duplicate handling)
          if (godotReadyRef.current) return;
          godotReadyRef.current = true;
          
          setLoadingProgress(100);
          setLoadingStage('ready');
          
          // Trigger resize when Godot is ready to fix any distortion
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({ type: 'force_resize' }, '*');
            setTimeout(() => {
              iframeRef.current?.contentWindow?.postMessage({ type: 'force_resize' }, '*');
            }, 100);
          }
          
          setTimeout(() => {
            setGodotReady(true);
            setLoading(false);
          }, 200);
          break;

        case 'godot_progress':
          if (data.progress !== undefined && !godotReadyRef.current) {
            // Mark that we're receiving real progress (stops simulated progress)
            receivedRealProgressRef.current = true;
            // Map Godot's 0-1 progress to 10-95%
            const mappedProgress = 10 + Math.round(data.progress * 85);
            setLoadingProgress(mappedProgress);
            if (data.progress >= 0.9) {
              setLoadingStage('initializing');
            }
          }
          break;

        case 'car_loaded':
          setCarLoaded(true);
          setTimeout(() => {
            sendTextureToGodot();
            // Also sync plate region on car load (use ref to avoid stale closure)
            sendToGodot({ type: 'set_plate_region', region: plateRegionRef.current });
            // Apply auto-rotate preference on load
            sendToGodot({ type: 'set_camera_auto_rotate', enabled: autoRotateRef.current });
          }, 200);
          break;

        case 'godot_error':
          setError(data.message || 'Unknown Godot error');
          setLoading(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [sendTextureToGodot, sendToGodot]);

  // Trigger iframe resize
  const triggerIframeResize = useCallback(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'force_resize' }, '*');
    }
  }, []);

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    setIframeEverLoaded(true);
    setLoadingStage('loading');
    setLoadingProgress(10);
    receivedRealProgressRef.current = false;
    
    // Trigger multiple resize events to ensure canvas is correctly sized
    triggerIframeResize();
    setTimeout(triggerIframeResize, 100);
    setTimeout(triggerIframeResize, 300);
    setTimeout(triggerIframeResize, 600);
    setTimeout(triggerIframeResize, 1000);
    
    // Start a fallback progress simulation (only used if Godot doesn't send real progress)
    let progress = 10;
    const interval = setInterval(() => {
      // Stop if Godot is ready or we're receiving real progress
      if (godotReadyRef.current || receivedRealProgressRef.current) {
        clearInterval(interval);
        return;
      }
      // Smooth, consistent increments (slowing down as we approach 90%)
      const remaining = 90 - progress;
      const increment = Math.max(0.5, remaining * 0.08);
      progress = Math.min(90, progress + increment);
      
      if (progress >= 89.5) {
        clearInterval(interval);
        setLoadingProgress(90);
        setLoadingStage('initializing');
      } else {
        setLoadingProgress(Math.round(progress));
        if (progress > 50) {
          setLoadingStage('initializing');
        }
      }
    }, 150);

    return () => clearInterval(interval);
  }, [triggerIframeResize]);

  // Track previous signature to detect changes
  const prevSignatureRef = useRef<string | null>(null);
  
  // Auto-sync texture when canvas changes (debounced) - works in background too!
  // This ensures the 3D preview is always up-to-date when opened
  useEffect(() => {
    if (!godotReady) return;
    
    // Sync texture whenever signature changes (including initial load after restore)
    if (prevSignatureRef.current !== debouncedSignature) {
      prevSignatureRef.current = debouncedSignature;
      // Small delay to ensure canvas is fully rendered
      setTimeout(() => {
        sendTextureToGodot();
      }, 50);
    }
  }, [debouncedSignature, godotReady, sendTextureToGodot]);

  // Send model change to Godot in the background (even when viewer is closed)
  useEffect(() => {
    if (!godotReady) {
      return;
    }
    
    const needsLoad = lastLoadedModelRef.current !== currentModel.id;
    
    if (!needsLoad) return;
    
    lastLoadedModelRef.current = currentModel.id;
    setCarLoaded(false);
    
    sendToGodot({
      type: 'load_scene',
      modelId: currentModel.id,
    });
  }, [currentModel.id, godotReady, sendToGodot]);

  // When reopening, ensure model is loaded, trigger resize, and sync texture
  useEffect(() => {
    if (isOpen && godotReady && iframeEverLoaded) {
      if (lastLoadedModelRef.current !== currentModel.id) {
        lastLoadedModelRef.current = currentModel.id;
        setCarLoaded(false);
        sendToGodot({
          type: 'load_scene',
          modelId: currentModel.id,
        });
      } else {
        // Trigger resize
        triggerIframeResize();
        setTimeout(triggerIframeResize, 100);
        
        // Always sync texture when viewer opens to handle restored projects
        // This ensures texture is up-to-date even if initial sync was missed
        setTimeout(() => {
          sendTextureToGodot();
        }, 150);
      }
    }
  }, [isOpen, godotReady, iframeEverLoaded, currentModel.id, triggerIframeResize, sendToGodot, sendTextureToGodot]);

  // Handle window resize while viewer is open
  useEffect(() => {
    if (!isOpen || !iframeEverLoaded) return;

    let resizeTimeout: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        triggerIframeResize();
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [isOpen, iframeEverLoaded, triggerIframeResize]);

  // Camera controls
  const handleCameraPreset = (preset: string) => {
    setActivePreset(preset);
    sendToGodot({ type: 'set_camera_preset', preset });
    // Stop auto-rotation when a preset is selected
    if (autoRotate) {
      setAutoRotate(false);
      autoRotateRef.current = false;
      sendToGodot({ type: 'set_camera_auto_rotate', enabled: false });
    }
    // Clear active state after animation
    setTimeout(() => setActivePreset(null), 500);
  };

  // Auto-rotate control
  const handleAutoRotate = (enabled: boolean) => {
    setAutoRotate(enabled);
    autoRotateRef.current = enabled;
    sendToGodot({ type: 'set_camera_auto_rotate', enabled });
  };

  // Plate region control
  const handlePlateRegionChange = useCallback((region: 'us' | 'eu') => {
    setPlateRegion(region);
    plateRegionRef.current = region;
    sendToGodot({ type: 'set_plate_region', region });
  }, [sendToGodot]);

  // Zoom control
  const handleZoom = useCallback((delta: number) => {
    sendToGodot({ type: 'adjust_camera_zoom', delta });
  }, [sendToGodot]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case ' ': // Space bar
          e.preventDefault();
          handleAutoRotate(!autoRotate);
          break;
        case '1':
          handleCameraPreset('rear');
          break;
        case '2':
          handleCameraPreset('front');
          break;
        case '3':
          handleCameraPreset('left');
          break;
        case '?':
          setShowHints(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, autoRotate]);

  // Build iframe URL with .pck URL as query parameter (public URL)
  const iframeSrc = `/godot/index.html?pck=${encodeURIComponent(PCK_URL)}`;

  // Determine if we should show loading (only on first load)
  const showLoading = loading && !godotReady;
  
  // If engine is ready, reopening is instant
  const isInstantReopen = godotReady && iframeEverLoaded;

  // Ensure auto-rotate preference is applied when viewer opens and engine is ready
  useEffect(() => {
    if (!isOpen) return;
    if (!(godotReady || isInstantReopen)) return;
    sendToGodot({ type: 'set_camera_auto_rotate', enabled: autoRotateRef.current });
  }, [isOpen, godotReady, isInstantReopen, sendToGodot]);

  const viewerReady = godotReady || isInstantReopen;

  return (
    <>
      {/* Main viewer container */}
      <div 
        className={`fixed inset-0 z-[200] ${isOpen ? '' : 'pointer-events-none opacity-0 invisible'}`}
        style={{ 
          visibility: isOpen ? 'visible' : 'hidden',
          transition: 'opacity 0.2s ease-out',
          background: '#0a0a0b',
        }}
      >
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f0f10] via-[#0a0a0b] to-[#050506]" />
        
        {/* Main content area */}
        <div className="relative w-full h-full flex flex-col">
          
          {/* Minimal top bar */}
          <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 pointer-events-auto">
            {/* Left: Logo */}
            <img 
              src={logo} 
              alt="Tesla Wrap Studio" 
              className="h-6 sm:h-8 w-auto drop-shadow"
            />
            
            {/* Right: Utility buttons */}
            <div className="flex items-center gap-2">
              {viewerReady && !showLoading && (
                <button
                  onClick={() => setShowHints(!showHints)}
                  className={`p-2 rounded-full transition-all shadow-lg ${
                    showHints 
                      ? 'bg-black/60 text-white' 
                      : 'bg-black/40 text-white/80 hover:bg-black/60 hover:text-white'
                  } backdrop-blur-xl border border-white/20`}
                  title="Toggle controls help (?)"
                >
                  <span className="text-xs font-bold w-4 h-4 flex items-center justify-center">?</span>
                </button>
              )}
              
              {/* Close button */}
              <button
                onClick={onClose}
                className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white transition-all backdrop-blur-xl border border-white/20 shadow-lg"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Viewport */}
          <div className="flex-1 relative">
            {/* Godot iframe - always mounted */}
            <iframe
              ref={iframeRef}
              src={iframeSrc}
              className="absolute inset-0 w-full h-full border-0"
              title="Godot 3D Viewer"
              allow="autoplay; fullscreen"
              onLoad={handleIframeLoad}
            />
            
            {/* Loading overlay */}
            {showLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0b] z-10">
                {/* Animated car silhouette */}
                <div className="relative mb-8">
                  <div className="w-32 h-32 relative">
                    {/* Outer glow ring */}
                    <div 
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: `conic-gradient(from 0deg, transparent, rgba(232, 33, 39, 0.4), transparent)`,
                        animation: 'spin 2s linear infinite',
                      }}
                    />
                    {/* Inner circle */}
                    <div className="absolute inset-2 rounded-full bg-[#0a0a0b] flex items-center justify-center">
                      <Car className="w-12 h-12 text-white/20" />
                    </div>
                    {/* Progress indicator */}
                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="46"
                        fill="none"
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth="3"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="46"
                        fill="none"
                        stroke="url(#loadingGradient)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={`${loadingProgress * 2.89} 289`}
                        style={{ transition: 'stroke-dasharray 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
                      />
                      <defs>
                        <linearGradient id="loadingGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#e82127" />
                          <stop offset="100%" stopColor="#ff6b6b" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>
                
                {/* Progress text */}
                <div className="text-center">
                  <p className="text-white/90 text-lg font-medium tracking-wide">
                    {loadingProgress}%
                  </p>
                  <p className="text-white/40 text-sm mt-1">
                    {loadingStage === 'loading' && 'Loading 3D engine...'}
                    {loadingStage === 'initializing' && 'Preparing your vehicle...'}
                    {loadingStage === 'ready' && 'Ready!'}
                  </p>
                </div>
              </div>
            )}
            
            {/* Error overlay */}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0b] z-10">
                <div className="text-center max-w-md px-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                    <X className="w-8 h-8 text-red-500" />
                  </div>
                  <p className="text-red-400 text-lg font-medium">{error}</p>
                  <p className="text-white/40 text-sm mt-2">
                    Please try again later
                  </p>
                  <button
                    onClick={onClose}
                    className="mt-6 px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-full transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* Controls hint overlay */}
            {showHints && !showLoading && !error && viewerReady && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex items-center justify-center animate-in fade-in duration-200">
                <div className="bg-[#1a1a1c]/90 backdrop-blur-xl rounded-2xl p-8 border border-white/10 max-w-md mx-4 shadow-2xl">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-tesla-red to-red-700 flex items-center justify-center">
                      <Eye className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">3D Controls</h3>
                      <p className="text-white/50 text-xs">Interact with your design</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Mouse/Touch controls */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                          <Move className="w-5 h-5 text-white/60" />
                        </div>
                        <div>
                          <p className="text-white/90 text-sm font-medium">Drag to rotate</p>
                          <p className="text-white/40 text-xs">Click and drag to orbit around</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                          <ZoomIn className="w-5 h-5 text-white/60" />
                        </div>
                        <div>
                          <p className="text-white/90 text-sm font-medium">Scroll to zoom</p>
                          <p className="text-white/40 text-xs">Mouse wheel or pinch gesture</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Keyboard shortcuts */}
                    <div className="pt-4 border-t border-white/10">
                      <p className="text-white/50 text-xs uppercase tracking-wider mb-3">Keyboard shortcuts</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <kbd className="px-2 py-1 bg-white/10 rounded text-white/70 font-mono">Space</kbd>
                          <span className="text-white/50">Toggle rotation</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <kbd className="px-2 py-1 bg-white/10 rounded text-white/70 font-mono">1-3</kbd>
                          <span className="text-white/50">Camera presets</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      setShowHints(false);
                      localStorage.setItem(VIEWER_HINT_SHOWN_KEY, 'true');
                    }}
                    className="w-full mt-6 py-2.5 bg-tesla-red hover:bg-red-700 text-white rounded-xl font-medium transition-all"
                  >
                    Got it
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom floating toolbar */}
          {viewerReady && !showLoading && !error && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
              <div className="flex items-center gap-1 bg-[#1a1a1c]/90 backdrop-blur-xl rounded-2xl p-1.5 border border-white/10 shadow-2xl">
                
                {/* Camera preset buttons */}
                <div className="flex items-center gap-0.5 px-1">
                  <button
                    onClick={() => handleCameraPreset('rear')}
                    className={`px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                      activePreset === 'rear'
                        ? 'bg-tesla-red text-white'
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                    title="Front view (1)"
                  >
                    Front
                  </button>
                  <button
                    onClick={() => handleCameraPreset('front')}
                    className={`px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                      activePreset === 'front'
                        ? 'bg-tesla-red text-white'
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                    title="Rear view (2)"
                  >
                    Rear
                  </button>
                  <button
                    onClick={() => handleCameraPreset('left')}
                    className={`px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                      activePreset === 'left'
                        ? 'bg-tesla-red text-white'
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                    title="Side view (3)"
                  >
                    Side
                  </button>
                </div>
                
                {/* Divider */}
                <div className="w-px h-6 bg-white/10" />
                
                {/* Auto-rotate toggle */}
                <button
                  onClick={() => handleAutoRotate(!autoRotate)}
                  className={`p-2.5 rounded-xl transition-all ${
                    autoRotate
                      ? 'bg-tesla-red text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                  title={autoRotate ? 'Stop rotation (Space)' : 'Start rotation (Space)'}
                >
                  {autoRotate ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                
                {/* Divider */}
                <div className="w-px h-6 bg-white/10" />
                
                {/* Zoom controls */}
                <div className="flex items-center gap-0.5 px-1">
                  <button
                    onClick={() => handleZoom(0.5)}
                    className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all"
                    title="Zoom out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleZoom(-0.5)}
                    className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all"
                    title="Zoom in"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Divider */}
                <div className="w-px h-6 bg-white/10" />
                
                {/* Plate region toggle */}
                <div className="flex items-center gap-1 px-1">
                  <span className="text-[10px] text-white/40 mr-0.5">Plate</span>
                  <button
                    onClick={() => handlePlateRegionChange('us')}
                    className={`px-2 py-1.5 text-xs font-medium rounded-lg transition-all ${
                      plateRegion === 'us'
                        ? 'bg-white/15 text-white'
                        : 'text-white/50 hover:text-white hover:bg-white/10'
                    }`}
                    title="US License Plate"
                  >
                    🇺🇸
                  </button>
                  <button
                    onClick={() => handlePlateRegionChange('eu')}
                    className={`px-2 py-1.5 text-xs font-medium rounded-lg transition-all ${
                      plateRegion === 'eu'
                        ? 'bg-white/15 text-white'
                        : 'text-white/50 hover:text-white hover:bg-white/10'
                    }`}
                    title="EU License Plate"
                  >
                    🇪🇺
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Keyframes for loading animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};
