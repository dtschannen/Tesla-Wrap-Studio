import { useRef, useState, useEffect } from 'react';
import type { Stage as StageType } from 'konva/lib/Stage';
import { EditorCanvas } from './EditorCanvas';
import { Toolbar } from './Toolbar';
import { ToolsPanel } from './components/ToolsPanel';
import { LayersPanel } from './LayersPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { GodotViewer } from '../viewer/GodotViewer';
import { NewProjectDialog } from './components/NewProjectDialog';
import { UnsavedChangesDialog } from './components/UnsavedChangesDialog';
import { useEditorStore } from './state/useEditorStore';
import { useAuth } from '../contexts/AuthContext';
import { loadProjectFromSupabase } from '../utils/supabaseProjects';
import { Brush, Layers, SlidersHorizontal, X } from 'lucide-react';
import { 
  loadProjectFromLocalStorage, 
  clearSavedProject, 
  loadUIState, 
  clearUIState,
  saveProjectToLocalStorage 
} from '../utils/localStorageProject';
import { loadStripeReturnContext, isStripeNavigation } from '../utils/stripe';

export const WrapDesignerPage = () => {
  const stageRef = useRef<StageType | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const [show3DPreview, setShow3DPreview] = useState(false);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false); // Start false, show only if no saved state
  const [manualZoom, setManualZoom] = useState(1);
  const [autoFitZoom, setAutoFitZoom] = useState(1);
  const [autoFit, setAutoFit] = useState(true);
  const { selectedLayerId, deleteLayer, undo, redo, updateLayer, layers, loadProject, setDesignId, isDirty, getSerializedState } = useEditorStore();
  const { user, loading: authLoading } = useAuth();
  const [_loadingDesign, setLoadingDesign] = useState(false);
  const [pendingDesignId, setPendingDesignId] = useState<string | null>(null);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);
  const [openAIDialogOnMount, setOpenAIDialogOnMount] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true); // Loading state for initial restore
  const hasRestoredRef = useRef(false); // Prevent double restore
  const [mobilePanel, setMobilePanel] = useState<'tools' | 'layers' | 'properties' | null>(null);
  const [isPortraitSmallScreen, setIsPortraitSmallScreen] = useState(false);

  // Use auto-fit zoom when autoFit is true, otherwise use manual zoom
  const currentZoom = autoFit ? autoFitZoom : manualZoom;

  // Mobile orientation guard (we support mobile in landscape; portrait gets a rotate hint)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px) and (orientation: portrait)');
    const update = () => setIsPortraitSmallScreen(mq.matches);
    update();
    // Safari < 14 uses addListener/removeListener
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  // If we rotate into portrait, close drawers so the rotate overlay is unobstructed.
  useEffect(() => {
    if (isPortraitSmallScreen) {
      setMobilePanel(null);
    }
  }, [isPortraitSmallScreen]);

  // Unified restore logic - runs once on mount
  useEffect(() => {
    const restoreState = async () => {
      // Prevent double restore
      if (hasRestoredRef.current) return;
      hasRestoredRef.current = true;

      const params = new URLSearchParams(window.location.search);
      const paymentStatus = params.get('payment');
      const openDialog = params.get('openDialog');
      const designId = params.get('designId');

      // Clear URL parameters early
      if (paymentStatus || designId) {
        window.history.replaceState({}, '', window.location.pathname);
      }

      // Priority 1: Handle Stripe payment return
      if (paymentStatus === 'success' || paymentStatus === 'cancelled') {
        // Load return context from sessionStorage
        const stripeContext = loadStripeReturnContext();
        const uiState = loadUIState();
        
        // Restore project from localStorage if available
        const savedProject = loadProjectFromLocalStorage();
        if (savedProject) {
          setLoadingDesign(true);
          try {
            await loadProject(savedProject);
            // Restore UI state (zoom, etc.)
            if (uiState) {
              if (uiState.zoom) setManualZoom(uiState.zoom);
              if (typeof uiState.autoFit === 'boolean') setAutoFit(uiState.autoFit);
            }
            // Don't clear project - user continues working
          } catch (error) {
            console.error('Failed to restore project after payment:', error);
            setShowNewProjectDialog(true);
          } finally {
            setLoadingDesign(false);
          }
        } else {
          // No saved project, show new project dialog
          setShowNewProjectDialog(true);
        }
        
        // Open AI dialog if requested (on success only)
        if (paymentStatus === 'success' && (openDialog === 'ai' || stripeContext?.openDialog === 'ai' || uiState?.openDialog === 'ai')) {
          setTimeout(() => {
            setOpenAIDialogOnMount(true);
          }, 500);
        }
        
        // Clear UI state after restore
        clearUIState();
        setIsRestoring(false);
        return;
      }

      // Priority 2: Load from URL parameter (editing existing design from Gallery)
      if (designId && user) {
        setLoadingDesign(true);
        try {
          const project = await loadProjectFromSupabase(designId);
          await loadProject(project);
          setDesignId(designId);
          clearSavedProject();
        } catch (error: any) {
          console.error('Failed to load design from URL:', error);
          alert(error.message || 'Failed to load design. Please try again.');
          setShowNewProjectDialog(true);
        } finally {
          setLoadingDesign(false);
        }
        setIsRestoring(false);
        return;
      }

      // Priority 3: Restore from localStorage
      const savedProject = loadProjectFromLocalStorage();
      const uiState = loadUIState();
      
      if (savedProject) {
        setLoadingDesign(true);
        try {
          await loadProject(savedProject);
          // Restore UI state
          if (uiState) {
            if (uiState.zoom) setManualZoom(uiState.zoom);
            if (typeof uiState.autoFit === 'boolean') setAutoFit(uiState.autoFit);
            if (uiState.openDialog === 'ai') {
              setTimeout(() => setOpenAIDialogOnMount(true), 500);
            }
          }
          // Don't clear project - keep it for crash recovery
        } catch (error: any) {
          console.error('Failed to restore saved project:', error);
          clearSavedProject();
          setShowNewProjectDialog(true);
        } finally {
          setLoadingDesign(false);
        }
        clearUIState();
        setIsRestoring(false);
        return;
      }

      // Priority 4: No saved state - show new project dialog
      setShowNewProjectDialog(true);
      setIsRestoring(false);
    };

    if (!authLoading) {
      restoreState();
    }
  }, [authLoading, user, loadProject, setDesignId]);

  // Auto-save project on changes (debounced)
  useEffect(() => {
    // Don't auto-save during restore or if no project is loaded
    if (isRestoring || layers.length === 0) return;
    
    // Don't save if not dirty (no changes)
    if (!isDirty) return;

    const timer = setTimeout(() => {
      try {
        const project = getSerializedState();
        saveProjectToLocalStorage(project);
      } catch (error) {
        console.error('[Auto-save] Failed to save project:', error);
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
  }, [isDirty, layers.length, isRestoring, getSerializedState]);

  // Handle unsaved changes dialog actions for URL-based loading
  const handleUnsavedSaveForUrl = async () => {
    setShowUnsavedChangesDialog(false);
    // User needs to save manually - we can't auto-save here
    // Just proceed with loading after they save
    if (pendingDesignId) {
      setLoadingDesign(true);
      try {
        const project = await loadProjectFromSupabase(pendingDesignId);
        await loadProject(project);
        setDesignId(pendingDesignId);
        setShowNewProjectDialog(false);
        window.history.replaceState({}, '', window.location.pathname);
        clearSavedProject();
      } catch (error: any) {
        console.error('Failed to load design from URL:', error);
        alert(error.message || 'Failed to load design. Please try again.');
      } finally {
        setLoadingDesign(false);
        setPendingDesignId(null);
      }
    }
  };

  const handleUnsavedDiscardForUrl = async () => {
    setShowUnsavedChangesDialog(false);
    if (pendingDesignId) {
      setLoadingDesign(true);
      try {
        const project = await loadProjectFromSupabase(pendingDesignId);
        await loadProject(project);
        setDesignId(pendingDesignId);
        setShowNewProjectDialog(false);
        window.history.replaceState({}, '', window.location.pathname);
        clearSavedProject();
      } catch (error: any) {
        console.error('Failed to load design from URL:', error);
        alert(error.message || 'Failed to load design. Please try again.');
      } finally {
        setLoadingDesign(false);
        setPendingDesignId(null);
      }
    }
  };

  const handleUnsavedCancelForUrl = () => {
    setShowUnsavedChangesDialog(false);
    setPendingDesignId(null);
    // Clean URL since we're not loading
    window.history.replaceState({}, '', window.location.pathname);
  };

  // Browser beforeunload warning for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Skip warning if intentionally navigating to Stripe (project is saved before redirect)
      if (isStripeNavigation()) {
        return;
      }
      
      if (isDirty) {
        // Standard way to show browser's "Leave site?" dialog
        e.preventDefault();
        // For older browsers
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when dialog is open
      if (showNewProjectDialog) return;
      
      // Delete/Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedLayerId) {
        // Don't delete if focused on an input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }
        const layer = layers.find((l) => l.id === selectedLayerId);
        if (layer && !layer.locked) {
          deleteLayer(selectedLayerId);
        }
      }

      // Undo (Ctrl/Cmd + Z)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      // Redo (Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z)
      if (
        ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')
      ) {
        e.preventDefault();
        redo();
      }

      // Zoom shortcuts (Ctrl/Cmd + Plus, Minus, 0)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          setAutoFit(false);
          setManualZoom((prev) => Math.min(prev * 1.1, 5)); // Max 500%
        } else if (e.key === '-') {
          e.preventDefault();
          setAutoFit(false);
          setManualZoom((prev) => Math.max(prev / 1.1, 0.1)); // Min 10%
        } else if (e.key === '0') {
          e.preventDefault();
          setAutoFit(true);
        }
      }

      // New Project (Ctrl/Cmd + N)
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setShowNewProjectDialog(true);
      }

      // Nudge with arrow keys
      if (selectedLayerId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const layer = layers.find((l) => l.id === selectedLayerId);
        if (!layer || layer.locked) return;

        const nudgeAmount = e.shiftKey ? 10 : 1;
        let newX = layer.x;
        let newY = layer.y;

        switch (e.key) {
          case 'ArrowUp':
            newY -= nudgeAmount;
            break;
          case 'ArrowDown':
            newY += nudgeAmount;
            break;
          case 'ArrowLeft':
            newX -= nudgeAmount;
            break;
          case 'ArrowRight':
            newX += nudgeAmount;
            break;
        }

        updateLayer(selectedLayerId, { x: newX, y: newY });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLayerId, layers, deleteLayer, undo, redo, updateLayer, setAutoFit, setManualZoom, autoFitZoom, showNewProjectDialog]);

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-tesla-black via-[#3a3b3c] to-tesla-black overflow-hidden">
      <div className="p-1 relative z-[100]">
        <Toolbar
          stageRef={stageRef}
          onOpen3DPreview={() => setShow3DPreview(true)}
        />
      </div>
      {/* Desktop / large tablets: 4-column layout */}
      <div className="flex-1 hidden lg:flex overflow-hidden gap-1 p-1 relative z-0">
        <ToolsPanel
          openAIDialogOnMount={openAIDialogOnMount}
          onAIDialogOpened={() => setOpenAIDialogOnMount(false)}
        />
        <LayersPanel />
        <div ref={canvasContainerRef} className="flex-1 overflow-hidden relative z-0">
          <EditorCanvas
            ref={stageRef}
            zoom={currentZoom}
            onZoomChange={(newZoom) => {
              if (autoFit) {
                setAutoFitZoom(newZoom);
              } else {
                setManualZoom(newZoom);
              }
            }}
            autoFit={autoFit}
            onAutoFitChange={(fit) => {
              setAutoFit(fit);
              if (!fit && autoFitZoom) {
                setManualZoom(autoFitZoom);
              }
            }}
          />
        </div>
        <PropertiesPanel />
      </div>

      {/* Mobile / small tablets: canvas-first layout + drawers (landscape-friendly) */}
      <div className="flex-1 lg:hidden overflow-hidden p-1 relative z-0">
        <div ref={canvasContainerRef} className="h-full w-full overflow-hidden relative z-0">
          <EditorCanvas
            ref={stageRef}
            zoom={currentZoom}
            onZoomChange={(newZoom) => {
              if (autoFit) {
                setAutoFitZoom(newZoom);
              } else {
                setManualZoom(newZoom);
              }
            }}
            autoFit={autoFit}
            onAutoFitChange={(fit) => {
              setAutoFit(fit);
              if (!fit && autoFitZoom) {
                setManualZoom(autoFitZoom);
              }
            }}
          />
        </div>

        {/* Bottom control bar (kept small to preserve canvas space) */}
        {!isPortraitSmallScreen && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[300]">
            <div className="panel rounded-full px-2 py-1.5 flex items-center gap-1 shadow-2xl">
              <button
                onClick={() => setMobilePanel((p) => (p === 'tools' ? null : 'tools'))}
                className={`px-3 py-2 rounded-full text-xs font-medium flex items-center gap-2 transition-colors ${
                  mobilePanel === 'tools'
                    ? 'bg-tesla-red text-white'
                    : 'bg-tesla-black/50 text-tesla-gray hover:text-tesla-light hover:bg-tesla-dark/40'
                }`}
                aria-label="Open tools"
                title="Tools"
              >
                <Brush className="w-4 h-4" />
                Tools
              </button>
              <button
                onClick={() => setMobilePanel((p) => (p === 'layers' ? null : 'layers'))}
                className={`px-3 py-2 rounded-full text-xs font-medium flex items-center gap-2 transition-colors ${
                  mobilePanel === 'layers'
                    ? 'bg-tesla-red text-white'
                    : 'bg-tesla-black/50 text-tesla-gray hover:text-tesla-light hover:bg-tesla-dark/40'
                }`}
                aria-label="Open layers"
                title="Layers"
              >
                <Layers className="w-4 h-4" />
                Layers
              </button>
              <button
                onClick={() => setMobilePanel((p) => (p === 'properties' ? null : 'properties'))}
                className={`px-3 py-2 rounded-full text-xs font-medium flex items-center gap-2 transition-colors ${
                  mobilePanel === 'properties'
                    ? 'bg-tesla-red text-white'
                    : 'bg-tesla-black/50 text-tesla-gray hover:text-tesla-light hover:bg-tesla-dark/40'
                }`}
                aria-label="Open properties"
                title="Properties"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Props
              </button>
            </div>
          </div>
        )}

        {/* Portrait hint overlay (mobile) */}
        {isPortraitSmallScreen && (
          <div className="absolute inset-0 z-[400] flex items-center justify-center bg-tesla-black/70 backdrop-blur-sm">
            <div className="panel rounded-2xl p-5 max-w-[90vw] text-center">
              <div className="text-tesla-light font-semibold mb-2">Rotate your phone</div>
              <div className="text-sm text-tesla-gray">
                Tesla Wrap Studio is optimized for <span className="text-tesla-light">landscape</span> on mobile.
              </div>
            </div>
          </div>
        )}

        {/* Drawer overlay */}
        {mobilePanel && !isPortraitSmallScreen && (
          <div className="fixed inset-0 z-[500]">
            <button
              className="absolute inset-0 bg-black/50"
              onClick={() => setMobilePanel(null)}
              aria-label="Close panel overlay"
              title="Close"
            />

            <div
              className={`absolute inset-y-0 p-2 w-[min(92vw,24rem)] ${
                mobilePanel === 'properties' ? 'right-0' : 'left-0'
              }`}
            >
              <div className="h-full relative">
                <button
                  onClick={() => setMobilePanel(null)}
                  className="absolute top-3 right-3 z-[10] p-2 rounded-lg bg-tesla-black/60 hover:bg-tesla-dark/50 text-tesla-gray hover:text-tesla-light border border-tesla-dark/40"
                  aria-label="Close panel"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>

                {mobilePanel === 'tools' && (
                  <ToolsPanel
                    className="w-full"
                    openAIDialogOnMount={openAIDialogOnMount}
                    onAIDialogOpened={() => setOpenAIDialogOnMount(false)}
                  />
                )}
                {mobilePanel === 'layers' && <LayersPanel className="w-full" />}
                {mobilePanel === 'properties' && <PropertiesPanel className="w-full" />}
              </div>
            </div>
          </div>
        )}
      </div>
      <GodotViewer
        isOpen={show3DPreview}
        onClose={() => setShow3DPreview(false)}
        stageRef={stageRef}
      />
      <NewProjectDialog
        isOpen={showNewProjectDialog}
        onClose={() => setShowNewProjectDialog(false)}
      />
      <UnsavedChangesDialog
        isOpen={showUnsavedChangesDialog}
        onSave={handleUnsavedSaveForUrl}
        onDiscard={handleUnsavedDiscardForUrl}
        onCancel={handleUnsavedCancelForUrl}
      />
    </div>
  );
};
