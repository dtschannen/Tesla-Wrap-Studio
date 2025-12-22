import { useRef, useState, useEffect } from 'react';
import type { Stage as StageType } from 'konva/lib/Stage';
import { EditorCanvas } from './EditorCanvas';
import { Toolbar } from './Toolbar';
import { ToolsPanel } from './components/ToolsPanel';
import { LayersPanel } from './LayersPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { ThreeViewer } from '../viewer/ThreeViewer';
import { NewProjectDialog } from './components/NewProjectDialog';
import { UnsavedChangesDialog } from './components/UnsavedChangesDialog';
import { useEditorStore } from './state/useEditorStore';
import { useAuth } from '../contexts/AuthContext';
import { loadProjectFromSupabase } from '../utils/supabaseProjects';
import { 
  loadProjectFromLocalStorage, 
  clearSavedProject, 
  loadUIState, 
  clearUIState,
  saveProjectToLocalStorage 
} from '../utils/localStorageProject';
import { loadStripeReturnContext } from '../utils/stripe';

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
  const [loadingDesign, setLoadingDesign] = useState(false);
  const [pendingDesignId, setPendingDesignId] = useState<string | null>(null);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);
  const [openAIDialogOnMount, setOpenAIDialogOnMount] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true); // Loading state for initial restore
  const hasRestoredRef = useRef(false); // Prevent double restore

  // Use auto-fit zoom when autoFit is true, otherwise use manual zoom
  const currentZoom = autoFit ? autoFitZoom : manualZoom;

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
      <div className="flex-1 flex overflow-hidden gap-1 p-1 relative z-0">
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
      <ThreeViewer
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
