import { useRef, useState, useEffect } from 'react';
import { useEditorStore } from './state/useEditorStore';
import logo from '../assets/logo.png';
import { exportPng } from '../utils/exportPng';
import { carModels } from '../data/carModels';
import { loadProjectFromFile, getProjectFileAccept } from '../utils/projectFile';
import { calculateImageScale } from '../utils/image';
import { NewProjectDialog } from './components/NewProjectDialog';
import { DownloadDialog } from './components/DownloadDialog';
import { InfoDialog } from './components/InfoDialog';
import { OpenProjectDialog } from './components/OpenProjectDialog';
import { FeatureDevelopmentDialog } from './components/FeatureDevelopmentDialog';
import { SaveDialog } from './components/SaveDialog';
import { UnsavedChangesDialog } from './components/UnsavedChangesDialog';
import { ProfileMenu } from '../components/ProfileMenu';
import { useAuth } from '../contexts/AuthContext';
import { LoginDialog } from '../components/LoginDialog';
import type { Stage as StageType } from 'konva/lib/Stage';

interface ToolbarProps {
  stageRef: React.RefObject<StageType | null>;
  onOpen3DPreview: () => void;
}

export const Toolbar = ({ stageRef, onOpen3DPreview }: ToolbarProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const projectNameInputRef = useRef<HTMLInputElement>(null);
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [isInfoDropdownOpen, setIsInfoDropdownOpen] = useState(false);
  const [isOpenProjectDialogOpen, setIsOpenProjectDialogOpen] = useState(false);
  const [isFeatureDevelopmentDialogOpen, setIsFeatureDevelopmentDialogOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [isUnsavedChangesDialogOpen, setIsUnsavedChangesDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'new' | 'open' | null>(null);
  const [pendingSaveCallback, setPendingSaveCallback] = useState<(() => void) | null>(null);
  const infoDropdownRef = useRef<HTMLDivElement>(null);
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [editingName, setEditingName] = useState('');
  const { user } = useAuth();
  
  const {
    undo,
    redo,
    history,
    historyIndex,
    currentModelId,
    addLayer,
    isDirty,
    projectName,
    setProjectName,
    loadProject,
  } = useEditorStore();

  const currentModel = carModels.find((m) => m.id === currentModelId) || carModels[0];
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Generate export filename from project name
  const getExportFilename = () => {
    const sanitizedName = projectName
      .replace(/[^a-zA-Z0-9\s-_]/g, '')
      .replace(/\s+/g, '_')
      .toLowerCase();
    return `${sanitizedName}_${currentModel.folderName}.png`;
  };

  const handleExport = () => {
    setIsDownloadDialogOpen(true);
  };

  const handleConfirmDownload = () => {
    setIsDownloadDialogOpen(false);
    if (stageRef.current) {
      exportPng(stageRef.current, getExportFilename());
    }
  };

  const handleCancelDownload = () => {
    setIsDownloadDialogOpen(false);
  };

  // Project name editing handlers
  const handleProjectNameClick = () => {
    setEditingName(projectName);
    setIsEditingProjectName(true);
    // Focus the input after state update
    setTimeout(() => {
      projectNameInputRef.current?.focus();
      projectNameInputRef.current?.select();
    }, 0);
  };

  const handleProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingName(e.target.value);
  };

  const handleProjectNameBlur = () => {
    const trimmedName = editingName.trim();
    if (trimmedName) {
      setProjectName(trimmedName);
    }
    setIsEditingProjectName(false);
  };

  const handleProjectNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleProjectNameBlur();
    } else if (e.key === 'Escape') {
      setIsEditingProjectName(false);
    }
  };

  // Handle New Project button
  const handleNewProject = () => {
    if (isDirty) {
      setPendingAction('new');
      setIsUnsavedChangesDialogOpen(true);
    } else {
      setIsNewProjectDialogOpen(true);
    }
  };

  // Handle Open Project button
  const handleOpenProject = () => {
    if (isDirty) {
      setPendingAction('open');
      setIsUnsavedChangesDialogOpen(true);
    } else {
      setIsOpenProjectDialogOpen(true);
    }
  };

  // Handle unsaved changes dialog actions
  const handleUnsavedSave = async () => {
    setIsUnsavedChangesDialogOpen(false);
    if (!user) {
      setIsLoginDialogOpen(true);
      setPendingSaveCallback(() => {
        setIsUnsavedChangesDialogOpen(true);
      });
      return;
    }
    setIsSaveDialogOpen(true);
    setPendingSaveCallback(() => {
      // After save completes, proceed with pending action
      if (pendingAction === 'new') {
        setIsNewProjectDialogOpen(true);
      } else if (pendingAction === 'open') {
        setIsOpenProjectDialogOpen(true);
      }
      setPendingAction(null);
    });
  };

  const handleUnsavedDiscard = () => {
    setIsUnsavedChangesDialogOpen(false);
    if (pendingAction === 'new') {
      setIsNewProjectDialogOpen(true);
    } else if (pendingAction === 'open') {
      setIsOpenProjectDialogOpen(true);
    }
    setPendingAction(null);
  };

  const handleUnsavedCancel = () => {
    setIsUnsavedChangesDialogOpen(false);
    setPendingAction(null);
  };

  // Handle Save Project
  const handleSaveProject = () => {
    // Check if user is authenticated
    if (!user) {
      setIsLoginDialogOpen(true);
      return;
    }
    
    // Show save dialog
    setIsSaveDialogOpen(true);
  };


  // Handle project file selection
  const handleProjectFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const project = await loadProjectFromFile(file);
      await loadProject(project);
    } catch (error: any) {
      alert(error.message || 'Failed to load project file.');
    }

    // Reset input
    e.target.value = '';
  };

  // Handle info dropdown menu items
  const handleShowInstallInstructions = () => {
    setIsInfoDropdownOpen(false);
    setIsInfoDialogOpen(true);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (infoDropdownRef.current && !infoDropdownRef.current.contains(event.target as Node)) {
        setIsInfoDropdownOpen(false);
      }
    };

    if (isInfoDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isInfoDropdownOpen]);

  // Handle image file selection (for adding image layers)
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const src = event.target?.result as string;
      
      // Create an image element to get dimensions
      const img = new Image();
      img.onload = () => {
        // Calculate scale to make long side ~300px
        const scale = calculateImageScale(img, 300);
        
        // Center the image on canvas (1024x1024)
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        const x = (1024 - scaledWidth) / 2;
        const y = (1024 - scaledHeight) / 2;
        
        // Add as a new image layer
        addLayer({
          type: 'image',
          name: file.name,
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
      };
      img.src = src;
    };
    reader.readAsDataURL(file);

    // Reset input
    e.target.value = '';
  };

  return (
    <>
      <div className="panel border-b-0 rounded-xl p-2 sm:p-3 flex items-center gap-2 sm:gap-3 shadow-lg relative z-[100]">
        {/* Logo */}
        <div className="flex items-center gap-2 sm:gap-3 border-r border-tesla-dark/50 pr-2 sm:pr-3 flex-shrink-0">
          <img
            src={logo}
            alt="Tesla Wrap Studio"
            className="h-6 sm:h-8 w-auto drop-shadow"
          />
        </div>

        {/* File Operations */}
        <div className="flex items-center gap-1 border-r border-tesla-dark/50 pr-2 sm:pr-3 flex-shrink-0">
          <button
            onClick={handleNewProject}
            className="px-2 sm:px-3 py-1.5 text-xs font-medium text-tesla-light bg-tesla-black/70 rounded hover:bg-tesla-black transition-colors"
            title="New Project"
          >
            New
          </button>
          <button
            onClick={handleOpenProject}
            className="px-2 sm:px-3 py-1.5 text-xs font-medium text-tesla-light bg-tesla-black/70 rounded hover:bg-tesla-black transition-colors"
            title="Open Project (.twrap)"
          >
            Open
          </button>
          <button
            onClick={handleSaveProject}
            className={`px-2 sm:px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              isDirty 
                ? 'text-white bg-tesla-red hover:bg-tesla-red/80' 
                : 'text-tesla-light bg-tesla-black/70 hover:bg-tesla-black'
            }`}
            title="Save Project"
          >
            Save
          </button>
          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageFileChange}
            className="hidden"
            aria-label="Upload image file"
            title="Upload image file"
          />
          <input
            ref={projectFileInputRef}
            type="file"
            accept={getProjectFileAccept()}
            onChange={handleProjectFileChange}
            className="hidden"
            aria-label="Upload project file"
            title="Upload project file"
          />
        </div>

        {/* Undo/Redo */}
        <div className="flex items-center gap-1 sm:gap-1.5 border-r border-tesla-dark/50 pr-2 sm:pr-3 flex-shrink-0">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="btn-icon disabled:opacity-30 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="btn-icon disabled:opacity-30 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Y)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
            </svg>
          </button>
        </div>

        {/* Project Info */}
        <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-tesla-gray flex-shrink min-w-0 overflow-hidden">
          {isEditingProjectName ? (
            <input
              ref={projectNameInputRef}
              type="text"
              value={editingName}
              onChange={handleProjectNameChange}
              onBlur={handleProjectNameBlur}
              onKeyDown={handleProjectNameKeyDown}
              className="px-2 py-0.5 text-xs sm:text-sm font-medium text-tesla-light bg-tesla-black/80 border border-tesla-red/50 rounded outline-none focus:ring-1 focus:ring-tesla-red/50 max-w-[120px] sm:max-w-[200px]"
              autoFocus
              title="Project name"
              placeholder="Project name"
            />
          ) : (
            <span 
              className="text-tesla-light font-medium truncate cursor-pointer hover:text-white transition-colors flex-shrink-0"
              title={`${projectName} (click to edit)`}
              onClick={handleProjectNameClick}
            >
              {projectName}
            </span>
          )}
          <span className="text-tesla-dark hidden xl:inline">•</span>
          <span className="text-tesla-gray whitespace-nowrap hidden xl:inline">{currentModel.name}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 sm:gap-2 ml-auto flex-shrink-0">
          <div className="relative z-[100]" ref={infoDropdownRef}>
            <button
              onClick={() => setIsInfoDropdownOpen(!isInfoDropdownOpen)}
              className="btn-icon"
              title="Information and support"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            
            {/* Dropdown Menu */}
            {isInfoDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-[#1c1c1e] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[100]">
                <button
                  onClick={handleShowInstallInstructions}
                  className="w-full px-4 py-3 text-left text-sm text-white hover:bg-white/5 transition-colors flex items-center gap-3"
                >
                  <svg className="w-4 h-4 text-tesla-red flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Install Wrap on Tesla</span>
                </button>
                <a
                  href="https://buymeacoffee.com/dtschannen"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsInfoDropdownOpen(false)}
                  className="w-full px-4 py-3 text-left text-sm text-white hover:bg-white/5 transition-colors flex items-center gap-3"
                >
                  <svg className="w-4 h-4 text-tesla-red flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                  </svg>
                  <span>Buy me a Coffee</span>
                </a>
                <a
                  href="https://github.com/dtschannen/Tesla-Wrap-Studio"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsInfoDropdownOpen(false)}
                  className="w-full px-4 py-3 text-left text-sm text-white hover:bg-white/5 transition-colors flex items-center gap-3"
                >
                  <svg className="w-4 h-4 text-tesla-red flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Help / Support</span>
                </a>
              </div>
            )}
          </div>
          <button
            onClick={onOpen3DPreview}
            disabled
            className="btn-secondary flex items-center gap-1 sm:gap-2 opacity-50 cursor-not-allowed px-2 sm:px-4"
            title="Coming Soon"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span className="hidden sm:inline">3D Preview</span>
          </button>
          <button
            onClick={handleExport}
            className="btn-primary flex items-center gap-1 sm:gap-2 px-2 sm:px-4"
            title="Export PNG"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="hidden sm:inline">Export PNG</span>
          </button>
            {/* Profile Menu (far right) */}
            <ProfileMenu />
        </div>
      </div>

      {/* New Project Dialog */}
      <NewProjectDialog 
        isOpen={isNewProjectDialogOpen} 
        onClose={() => setIsNewProjectDialogOpen(false)} 
      />

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={isUnsavedChangesDialogOpen}
        onSave={handleUnsavedSave}
        onDiscard={handleUnsavedDiscard}
        onCancel={handleUnsavedCancel}
      />

      {/* Download Confirmation Dialog */}
      <DownloadDialog
        isOpen={isDownloadDialogOpen}
        onConfirm={handleConfirmDownload}
        onCancel={handleCancelDownload}
      />

      {/* Info Dialog */}
      <InfoDialog
        isOpen={isInfoDialogOpen}
        onClose={() => setIsInfoDialogOpen(false)}
      />

      {/* Open Project Dialog */}
      <OpenProjectDialog
        isOpen={isOpenProjectDialogOpen}
        onClose={() => setIsOpenProjectDialogOpen(false)}
        onProjectLoaded={() => {
          // Project loaded successfully, dialog will close itself
        }}
      />

      {/* Feature Development Dialog */}
      <FeatureDevelopmentDialog
        isOpen={isFeatureDevelopmentDialogOpen}
        onClose={() => setIsFeatureDevelopmentDialogOpen(false)}
      />

      {/* Save Dialog */}
      <SaveDialog
        isOpen={isSaveDialogOpen}
        onClose={() => {
          setIsSaveDialogOpen(false);
          if (pendingSaveCallback) {
            pendingSaveCallback();
            setPendingSaveCallback(null);
          }
        }}
        onSuccess={() => {
          setIsSaveDialogOpen(false);
          if (pendingSaveCallback) {
            pendingSaveCallback();
            setPendingSaveCallback(null);
          }
        }}
        stageRef={stageRef}
      />

      {/* Login Dialog */}
      <LoginDialog
        isOpen={isLoginDialogOpen}
        onClose={() => setIsLoginDialogOpen(false)}
        onSuccess={() => {
          setIsLoginDialogOpen(false);
          // After login, show save dialog
          setIsSaveDialogOpen(true);
        }}
      />
    </>
  );
};
