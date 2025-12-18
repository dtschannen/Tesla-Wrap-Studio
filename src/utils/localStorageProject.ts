import type { ProjectFile } from '../editor/state/useEditorStore';

const STORAGE_KEY = 'tesla_wrap_unsaved_project';

/**
 * Save project to localStorage (for preserving unsaved work during login)
 */
export const saveProjectToLocalStorage = (project: ProjectFile): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch (error) {
    console.error('Failed to save project to localStorage:', error);
    // If localStorage is full or unavailable, silently fail
  }
};

/**
 * Load project from localStorage
 */
export const loadProjectFromLocalStorage = (): ProjectFile | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const project = JSON.parse(stored) as ProjectFile;
    
    // Validate project structure
    if (!project.version || !project.layers || !project.modelId) {
      console.warn('Invalid project data in localStorage');
      return null;
    }

    return project;
  } catch (error) {
    console.error('Failed to load project from localStorage:', error);
    return null;
  }
};

/**
 * Clear saved project from localStorage
 */
export const clearSavedProject = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear saved project from localStorage:', error);
  }
};
