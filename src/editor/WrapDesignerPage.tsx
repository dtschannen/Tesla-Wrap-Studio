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
import { loadProjectFromLocalStorage, clearSavedProject } from '../utils/localStorageProject';

export const WrapDesignerPage = () => {
  const stageRef = useRef<StageType | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const [show3DPreview, setShow3DPreview] = useState(false);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(true); // Show on first load
  const [manualZoom, setManualZoom] = useState(1);
  const [autoFitZoom, setAutoFitZoom] = useState(1);
  const [autoFit, setAutoFit] = useState(true);
  const { selectedLayerId, deleteLayer, undo, redo, updateLayer, layers, loadProject, setDesignId, isDirty } = useEditorStore();
  const { user, loading: authLoading } = useAuth();
  const [loadingDesign, setLoadingDesign] = useState(false);
  const [pendingDesignId, setPendingDesignId] = useState<string | null>(null);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);

  // Initialize auto-fit zoom (will be calculated by EditorCanvas when autoFit is true)
  // This is just for initial state, actual calculation happens in EditorCanvas

  // Use auto-fit zoom when autoFit is true, otherwise use manual zoom
  const currentZoom = autoFit ? autoFitZoom : manualZoom;

  // Check for saved project in localStorage or design ID in URL parameter
  useEffect(() => {
    const loadProjectOnMount = async () => {
      if (authLoading || loadingDesign) return;

      const params = new URLSearchParams(window.location.search);
      const designId = params.get('designId');

      // Priority 1: Load from URL parameter (editing existing design from Gallery)
      if (designId && user) {
        // Check for unsaved changes
        if (isDirty) {
          setPendingDesignId(designId);
          setShowUnsavedChangesDialog(true);
          return;
        }

        setLoadingDesign(true);
        try {
          const project = await loadProjectFromSupabase(designId);
          await loadProject(project);
          setDesignId(designId);
          setShowNewProjectDialog(false);
          // Clean URL
          window.history.replaceState({}, '', window.location.pathname);
          // Clear any saved project from localStorage since we loaded from URL
          clearSavedProject();
        } catch (error: any) {
          console.error('Failed to load design from URL:', error);
          alert(error.message || 'Failed to load design. Please try again.');
        } finally {
          setLoadingDesign(false);
        }
        return;
      }

      // Priority 2: Restore unsaved project from localStorage (after login)
      // Only restore if no layers are currently loaded (avoid overwriting existing work)
      const savedProject = loadProjectFromLocalStorage();
      if (savedProject && user && layers.length === 0) {
        setLoadingDesign(true);
        try {
          await loadProject(savedProject);
          setShowNewProjectDialog(false);
          clearSavedProject(); // Clear after successful restore
        } catch (error: any) {
          console.error('Failed to restore saved project:', error);
          clearSavedProject(); // Clear invalid data
        } finally {
          setLoadingDesign(false);
        }
      }
    };

    if (!authLoading) {
      loadProjectOnMount();
    }
  }, [user, authLoading, loadProject, setDesignId, isDirty]);

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
        <ToolsPanel />
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
