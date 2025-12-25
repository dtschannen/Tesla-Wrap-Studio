import { useEffect, useRef, useCallback, useState } from 'react';
import { X, Move3D, Info, RotateCcw } from 'lucide-react';
import type { Stage as StageType } from 'konva/lib/Stage';
import { useEditorStore } from '../editor/state/useEditorStore';
import { carModels } from '../data/carModels';

interface GodotViewerProps {
  isOpen: boolean;
  onClose: () => void;
  stageRef: React.RefObject<StageType | null>;
}

// Public URL for the .pck file in Supabase Storage
const PCK_URL = 'https://mehvzkfcitccchzpqyfd.supabase.co/storage/v1/object/public/godot-assets/index.pck';

export const GodotViewer = ({ isOpen, onClose, stageRef }: GodotViewerProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const godotReadyRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState<'loading' | 'initializing' | 'ready'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [godotReady, setGodotReady] = useState(false);
  const [, setCarLoaded] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [iframeEverLoaded, setIframeEverLoaded] = useState(false);
  
  const { currentModelId } = useEditorStore();
  const currentModel = carModels.find(m => m.id === currentModelId) || carModels.find(m => m.id === 'modely') || carModels[0];

  // Track last loaded model to prevent duplicate loads
  const lastLoadedModelRef = useRef<string | null>(null);

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
      const canvas = stage.toCanvas();
      const dataUrl = canvas.toDataURL('image/png');

      sendToGodot({
        type: 'set_texture',
        texture: dataUrl,
      });
      console.log('[GodotViewer] Sent texture to Godot');
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

      console.log('[GodotViewer] Received message:', data.type, data);

      switch (data.type) {
        case 'godot_ready':
          // Ignore if already ready (prevent duplicate handling)
          if (godotReadyRef.current) return;
          godotReadyRef.current = true;
          
          setLoadingProgress(100);
          setLoadingStage('ready');
          setTimeout(() => {
            setGodotReady(true);
            setLoading(false);
          }, 200);
          break;

        case 'godot_progress':
          if (data.progress !== undefined && !godotReadyRef.current) {
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
          setTimeout(() => sendTextureToGodot(), 200);
          break;

        case 'godot_error':
          setError(data.message || 'Unknown Godot error');
          setLoading(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [sendTextureToGodot]);

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    console.log('[GodotViewer] Iframe loaded');
    setIframeEverLoaded(true);
    setLoadingStage('loading');
    setLoadingProgress(10);
    
    // Start a slower progress simulation that won't go past 90%
    // The real godot_ready message will complete it
    let progress = 10;
    const interval = setInterval(() => {
      if (godotReadyRef.current) {
        clearInterval(interval);
        return;
      }
      progress += Math.random() * 5;
      if (progress > 90) {
        clearInterval(interval);
        setLoadingProgress(90);
        setLoadingStage('initializing');
      } else {
        setLoadingProgress(Math.round(progress));
        if (progress > 50) {
          setLoadingStage('initializing');
        }
      }
    }, 300);

    return () => clearInterval(interval);
  }, []);

  // Send model change to Godot when model changes
  useEffect(() => {
    if (!godotReady || !isOpen) return;
    
    // Only send if model actually changed
    if (lastLoadedModelRef.current === currentModel.id) return;
    
    lastLoadedModelRef.current = currentModel.id;
    setCarLoaded(false);
    sendToGodot({
      type: 'load_scene',
      modelId: currentModel.id,
    });
    console.log('[GodotViewer] Loading model:', currentModel.id);
  }, [currentModel.id, godotReady, isOpen, sendToGodot]);

  // When reopening, resend texture
  useEffect(() => {
    if (isOpen && godotReady && iframeEverLoaded) {
      // Small delay to ensure viewer is visible
      const timer = setTimeout(() => {
        sendTextureToGodot();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, godotReady, iframeEverLoaded, sendTextureToGodot]);

  // Camera controls
  const handleCameraPreset = (preset: string) => {
    sendToGodot({ type: 'set_camera_preset', preset });
  };

  const handleResetCamera = () => {
    sendToGodot({ type: 'reset_camera' });
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Build iframe URL with .pck URL as query parameter (public URL)
  const iframeSrc = `/godot/index.html?pck=${encodeURIComponent(PCK_URL)}`;

  // Determine if we should show loading (only on first load)
  const showLoading = loading && !godotReady;
  
  // If engine is ready, reopening is instant
  const isInstantReopen = godotReady && iframeEverLoaded;

  return (
    <>
      {/* Hidden iframe container - always mounted to keep engine alive */}
      <div 
        className={`fixed inset-0 z-[200] ${isOpen ? '' : 'pointer-events-none opacity-0 invisible'}`}
        style={{ 
          visibility: isOpen ? 'visible' : 'hidden',
          transition: 'opacity 0.15s ease-out'
        }}
      >
        <div className={`absolute inset-0 bg-black/90 backdrop-blur-sm ${isOpen ? 'animate-in fade-in duration-200' : ''}`}>
          <div className="w-full h-full flex items-center justify-center">
            <div className="bg-[#1a1a1c] rounded-2xl shadow-2xl w-[95vw] h-[95vh] max-w-[1800px] max-h-[1000px] flex flex-col overflow-hidden border border-white/10">
              {/* Header */}
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/30">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-tesla-red to-red-700 flex items-center justify-center">
                      <Move3D className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">3D Preview</h2>
                      <p className="text-xs text-white/50">{currentModel.name}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Camera presets */}
                  {(godotReady || isInstantReopen) && (
                    <div className="flex items-center gap-1 mr-2">
                      <button
                        onClick={() => handleCameraPreset('front')}
                        className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-lg transition-all"
                      >
                        Front
                      </button>
                      <button
                        onClick={() => handleCameraPreset('rear')}
                        className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-lg transition-all"
                      >
                        Rear
                      </button>
                      <button
                        onClick={() => handleCameraPreset('left')}
                        className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-lg transition-all"
                      >
                        Side
                      </button>
                      <button
                        onClick={handleResetCamera}
                        className="p-1.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-lg transition-all"
                        title="Reset camera"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  
                  {/* Controls hint toggle */}
                  <button
                    onClick={() => setShowControls(!showControls)}
                    className={`p-2.5 rounded-xl transition-all ${showControls ? 'bg-white/10 text-white' : 'bg-transparent text-white/50 hover:text-white hover:bg-white/5'}`}
                    title="Toggle controls help"
                  >
                    <Info className="w-5 h-5" />
                  </button>
                  
                  {/* Close button */}
                  <button
                    onClick={onClose}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all"
                    title="Close (Esc)"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Main viewport */}
              <div className="flex-1 relative bg-black">
                {/* Godot iframe - always mounted */}
                <iframe
                  ref={iframeRef}
                  src={iframeSrc}
                  className="absolute inset-0 w-full h-full border-0"
                  title="Godot 3D Viewer"
                  allow="autoplay; fullscreen"
                  onLoad={handleIframeLoad}
                />
                
                {/* Loading overlay - only on first load */}
                {showLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a1c] z-10">
                    {/* Progress circle */}
                    <div className="relative w-28 h-28 mb-6">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                        {/* Background circle */}
                        <circle
                          cx="50"
                          cy="50"
                          r="42"
                          fill="none"
                          stroke="rgba(255,255,255,0.1)"
                          strokeWidth="6"
                        />
                        {/* Progress circle */}
                        <circle
                          cx="50"
                          cy="50"
                          r="42"
                          fill="none"
                          stroke="url(#progressGradient)"
                          strokeWidth="6"
                          strokeLinecap="round"
                          strokeDasharray={`${loadingProgress * 2.64} 264`}
                          className="transition-all duration-300 ease-out"
                        />
                        <defs>
                          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#e82127" />
                            <stop offset="100%" stopColor="#ff4444" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-white text-xl font-semibold">{loadingProgress}%</span>
                      </div>
                    </div>
                    
                    <p className="text-white/80 text-sm font-medium">
                      {loadingStage === 'loading' && 'Loading 3D engine...'}
                      {loadingStage === 'initializing' && 'Starting engine...'}
                      {loadingStage === 'ready' && 'Ready!'}
                    </p>
                    <p className="text-white/40 text-xs mt-2">
                      {loadingStage === 'loading' ? 'This may take a moment' :
                       loadingStage === 'initializing' ? 'Almost ready...' : ''}
                    </p>
                  </div>
                )}
                
                {/* Error overlay */}
                {error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a1c] z-10">
                    <div className="text-center max-w-md">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                        <X className="w-8 h-8 text-red-500" />
                      </div>
                      <p className="text-red-400 text-lg font-medium">{error}</p>
                      <p className="text-white/40 text-sm mt-2">
                        Please try again later
                      </p>
                      <button
                        onClick={onClose}
                        className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}

                {/* Controls help panel */}
                {showControls && !showLoading && !error && (godotReady || isInstantReopen) && (
                  <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md rounded-xl p-4 border border-white/10 text-sm space-y-2 animate-in slide-in-from-left duration-300">
                    <p className="text-white/80 font-medium mb-2">Controls</p>
                    <div className="flex items-center gap-3 text-white/60">
                      <span className="bg-white/10 px-2 py-0.5 rounded text-xs">Drag</span>
                      <span>Rotate view</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/60">
                      <span className="bg-white/10 px-2 py-0.5 rounded text-xs">Scroll</span>
                      <span>Zoom in/out</span>
                    </div>
                    <div className="pt-2 border-t border-white/10 text-white/50 text-xs">
                      <span className="bg-white/10 px-1.5 py-0.5 rounded">Esc</span> close
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
