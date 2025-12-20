import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getUserDesigns, loadProjectFromSupabase } from '../../utils/supabaseProjects';
import type { SavedDesign } from '../../utils/supabaseProjects';
import { useEditorStore } from '../state/useEditorStore';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';
import { LoginDialog } from '../../components/LoginDialog';
import { X, Loader2, AlertCircle, FolderOpen } from 'lucide-react';

interface OpenProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectLoaded: () => void;
}

export function OpenProjectDialog({ isOpen, onClose, onProjectLoaded }: OpenProjectDialogProps) {
  const { user } = useAuth();
  const { loadProject, setDesignId } = useEditorStore();
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingDesignId, setOpeningDesignId] = useState<string | null>(null);
  const [pendingDesignId, setPendingDesignId] = useState<string | null>(null);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      loadDesigns();
    }
  }, [isOpen, user]);

  const loadDesigns = async () => {
    setLoading(true);
    setError(null);
    try {
      const userDesigns = await getUserDesigns();
      setDesigns(userDesigns);
    } catch (err: any) {
      const message = err?.message || 'Failed to load designs';
      setError(message);
      // If session is missing/expired, prompt sign-in
      if (message.toLowerCase().includes('must be logged in')) {
        setIsLoginDialogOpen(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDesign = async (design: SavedDesign) => {
    // No need to check for unsaved changes here - already checked when opening the dialog
    // Just load the design directly
    await loadDesign(design.id);
  };

  const loadDesign = async (designId: string) => {
    setOpeningDesignId(designId);
    setError(null);
    try {
      const project = await loadProjectFromSupabase(designId);
      await loadProject(project);
      setDesignId(designId);
      onProjectLoaded();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to open design');
    } finally {
      setOpeningDesignId(null);
    }
  };

  const handleUnsavedSave = () => {
    setShowUnsavedChangesDialog(false);
    // User needs to save manually first
    // For now, just proceed with loading (they can save before opening)
    if (pendingDesignId) {
      loadDesign(pendingDesignId);
      setPendingDesignId(null);
    }
  };

  const handleUnsavedDiscard = () => {
    setShowUnsavedChangesDialog(false);
    if (pendingDesignId) {
      loadDesign(pendingDesignId);
      setPendingDesignId(null);
    }
  };

  const handleUnsavedCancel = () => {
    setShowUnsavedChangesDialog(false);
    setPendingDesignId(null);
  };

  if (!isOpen) return null;

  if (!user) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-tesla-black via-[#2a2b2c] to-tesla-black border border-tesla-dark rounded-xl p-6 max-w-md w-full shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-4">Login Required</h2>
          <p className="text-tesla-light mb-4">Please log in to open projects from your account.</p>
          <div className="flex gap-3">
            <button
              onClick={() => setIsLoginDialogOpen(true)}
              className="flex-1 px-4 py-2 bg-tesla-red hover:bg-tesla-red/80 text-white rounded transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
        <LoginDialog
          isOpen={isLoginDialogOpen}
          onClose={() => setIsLoginDialogOpen(false)}
          onSuccess={() => {
            setIsLoginDialogOpen(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-tesla-black via-[#2a2b2c] to-tesla-black border border-tesla-dark rounded-xl p-6 max-w-2xl w-full max-h-[80vh] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">Open Project</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-tesla-dark rounded transition-colors text-tesla-light hover:text-white"
            aria-label="Close dialog"
            title="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-200 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* User's Designs */}
        <div className="flex-1 overflow-y-auto">
          <h3 className="text-lg font-semibold text-white mb-3">Your Saved Designs</h3>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-tesla-red animate-spin" />
            </div>
          ) : designs.length === 0 ? (
            <div className="text-center py-8 text-tesla-light">
              <p>No saved designs yet.</p>
              <p className="text-sm mt-2">Save a project to see it here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {designs.map((design) => (
                <div
                  key={design.id}
                  onClick={() => handleOpenDesign(design)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    openingDesignId === design.id
                      ? 'border-tesla-red bg-tesla-red/10'
                      : 'border-tesla-dark hover:border-tesla-red/50 hover:bg-tesla-dark/50'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {design.preview_image_url ? (
                      <img
                        src={design.preview_image_url}
                        alt={design.title}
                        className="w-16 h-16 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded bg-tesla-dark flex items-center justify-center flex-shrink-0">
                        <FolderOpen className="w-6 h-6 text-tesla-light" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium truncate">{design.title}</div>
                      {design.description && (
                        <div className="text-tesla-light text-sm mt-1 line-clamp-2">{design.description}</div>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-tesla-light">
                        <span>{new Date(design.updated_at).toLocaleDateString()}</span>
                        <span className={`px-2 py-0.5 rounded ${
                          design.visibility === 'public' 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {design.visibility === 'public' ? 'Public' : 'Private'}
                        </span>
                      </div>
                    </div>
                    {openingDesignId === design.id && (
                      <Loader2 className="w-5 h-5 text-tesla-red animate-spin flex-shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={showUnsavedChangesDialog}
        onSave={handleUnsavedSave}
        onDiscard={handleUnsavedDiscard}
        onCancel={handleUnsavedCancel}
      />
      <LoginDialog
        isOpen={isLoginDialogOpen}
        onClose={() => setIsLoginDialogOpen(false)}
        onSuccess={() => {
          setIsLoginDialogOpen(false);
        }}
      />
    </div>
  );
}



