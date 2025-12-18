import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Layer, EditorState, ToolType, BrushSettings, BrushStroke } from './editorTypes';
import { carModels } from '../../data/carModels';

interface HistorySnapshot {
  layers: Layer[];
  baseColor: string;
}

// Default brush settings (like Photoshop defaults)
const defaultBrushSettings: BrushSettings = {
  size: 20,
  color: '#000000',
  hardness: 100,
  opacity: 100,
  flow: 100,
  spacing: 25,      // 25% spacing (Photoshop default)
  smoothing: 0,     // No smoothing by default
  blendMode: 'normal',
};

// Project file format
export interface ProjectFile {
  version: string;
  name: string;
  createdAt: string;
  modifiedAt: string;
  modelId: string;
  baseColor: string;
  layers: SerializedLayer[];
}

// Serialized layer (without HTMLImageElement references)
export interface SerializedLayer {
  id: string;
  type: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  // Type-specific properties
  [key: string]: any;
}

interface EditorStore extends EditorState {
  history: HistorySnapshot[];
  historyIndex: number;
  maxHistorySize: number;
  isDirty: boolean;  // Track unsaved changes
  projectName: string;
  designId: string | null;  // Track if editing existing design from database
  
  // Actions
  addLayer: (layer: Omit<Layer, 'id'> | Record<string, any>) => void;
  updateLayer: (id: string, updates: Partial<Layer> | Record<string, any>) => void;
  deleteLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  reorderLayers: (fromIndex: number, toIndex: number) => void;
  setSelection: (id: string | null) => void;
  setBaseColor: (color: string) => void;
  setTemplateDimensions: (dimensions: { width: number; height: number }) => void;
  setTemplateImage: (image: HTMLImageElement | null) => void;
  setCurrentModelId: (modelId: string) => void;
  // Tool actions
  setActiveTool: (tool: ToolType) => void;
  setBrushSettings: (settings: Partial<BrushSettings>) => void;
  addBrushStroke: (layerId: string, stroke: BrushStroke) => void;
  // History
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  // Project management
  resetProject: () => void;
  markAsSaved: () => void;
  setProjectName: (name: string) => void;
  setDesignId: (id: string | null) => void;
  getSerializedState: () => ProjectFile;
  loadProject: (project: ProjectFile) => Promise<void>;
}

const createHistorySnapshot = (layers: Layer[], baseColor: string): HistorySnapshot => ({
  layers: layers.map(layer => ({ ...layer })),
  baseColor,
});

// Helper to load an image from a data URL
const loadImageFromSrc = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

export const useEditorStore = create<EditorStore>((set, get) => {
  const pushHistory = () => {
    const state = get();
    const snapshot = createHistorySnapshot(state.layers, state.baseColor);
    
    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(snapshot);
      
      // Limit history size
      if (newHistory.length > state.maxHistorySize) {
        newHistory.shift();
      } else {
        state.historyIndex++;
      }
      
      return {
        history: newHistory,
        historyIndex: newHistory.length - 1,
        isDirty: true,  // Mark as dirty when changes are made
      };
    });
  };

  return {
    layers: [],
    selectedLayerId: null,
    baseColor: '#ffffff',
    currentModelId: carModels[0].id,
    templateDimensions: null,
    templateImage: null,
    activeTool: 'select' as ToolType,
    brushSettings: { ...defaultBrushSettings },
    history: [createHistorySnapshot([], '#ffffff')],
    historyIndex: 0,
    maxHistorySize: 50,
    isDirty: false,
    projectName: 'Untitled Project',
    designId: null,

    addLayer: (layerData) => {
      const newLayer: Layer = {
        ...layerData,
        id: uuidv4(),
      } as Layer;
      
      set((state) => ({
        layers: [newLayer, ...state.layers],
        selectedLayerId: newLayer.id,
      }));
      
      pushHistory();
    },

    updateLayer: (id, updates) => {
      set((state) => ({
        layers: state.layers.map((layer) =>
          layer.id === id ? { ...layer, ...updates } as Layer : layer
        ),
      }));
    },

    deleteLayer: (id) => {
      set((state) => ({
        layers: state.layers.filter((layer) => layer.id !== id),
        selectedLayerId: state.selectedLayerId === id ? null : state.selectedLayerId,
      }));
      pushHistory();
    },

    duplicateLayer: (id) => {
      const state = get();
      const layer = state.layers.find((l) => l.id === id);
      if (!layer) return;

      const duplicated: Layer = {
        ...layer,
        id: uuidv4(),
        name: `${layer.name} Copy`,
        x: layer.x + 20,
        y: layer.y + 20,
      } as Layer;

      set((state) => ({
        layers: [...state.layers, duplicated],
        selectedLayerId: duplicated.id,
      }));
      pushHistory();
    },

    reorderLayers: (fromIndex, toIndex) => {
      set((state) => {
        const newLayers = [...state.layers];
        const [moved] = newLayers.splice(fromIndex, 1);
        newLayers.splice(toIndex, 0, moved);
        return { layers: newLayers };
      });
      pushHistory();
    },

    setSelection: (id) => {
      set({ selectedLayerId: id });
    },

    setBaseColor: (color) => {
      set({ baseColor: color });
      pushHistory();
    },

    setTemplateDimensions: (dimensions) => {
      set({ templateDimensions: dimensions });
    },

    setTemplateImage: (image) => {
      set({ templateImage: image });
    },

    setCurrentModelId: (modelId) => {
      set({ currentModelId: modelId });
    },

    // Tool actions
    setActiveTool: (tool) => {
      set({ activeTool: tool });
    },

    setBrushSettings: (settings) => {
      set((state) => ({
        brushSettings: { ...state.brushSettings, ...settings },
      }));
    },

    addBrushStroke: (layerId, stroke) => {
      set((state) => ({
        layers: state.layers.map((layer) => {
          if (layer.id === layerId && layer.type === 'brush') {
            return {
              ...layer,
              strokes: [...(layer as any).strokes, stroke],
            };
          }
          return layer;
        }),
      }));
      pushHistory();
    },

    undo: () => {
      const state = get();
      if (state.historyIndex > 0) {
        const snapshot = state.history[state.historyIndex - 1];
        set({
          historyIndex: state.historyIndex - 1,
          layers: snapshot.layers.map((l) => ({ ...l })),
          baseColor: snapshot.baseColor,
        });
      }
    },

    redo: () => {
      const state = get();
      if (state.historyIndex < state.history.length - 1) {
        const snapshot = state.history[state.historyIndex + 1];
        set({
          historyIndex: state.historyIndex + 1,
          layers: snapshot.layers.map((l) => ({ ...l })),
          baseColor: snapshot.baseColor,
          isDirty: true,
        });
      }
    },

    pushHistory,
    
    // Project management
    resetProject: () => {
      set({
        layers: [],
        selectedLayerId: null,
        baseColor: '#ffffff',
        history: [createHistorySnapshot([], '#ffffff')],
        historyIndex: 0,
        isDirty: false,
        projectName: 'Untitled Project',
        designId: null,
        activeTool: 'select',
      });
    },
    
    markAsSaved: () => {
      set({ isDirty: false });
    },
    
    setProjectName: (name: string) => {
      set({ projectName: name });
    },
    
    setDesignId: (id: string | null) => {
      set({ designId: id });
    },
    
    getSerializedState: (): ProjectFile => {
      const state = get();
      
      // Serialize layers, removing HTMLImageElement references
      const serializedLayers: SerializedLayer[] = state.layers.map(layer => {
        const { ...rest } = layer as any;
        // Remove non-serializable properties
        delete rest.image;
        delete rest.fillImage;
        return rest as SerializedLayer;
      });
      
      return {
        version: '1.0',
        name: state.projectName,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        modelId: state.currentModelId,
        baseColor: state.baseColor,
        layers: serializedLayers,
      };
    },
    
    loadProject: async (project: ProjectFile) => {
      // Restore layers with image loading
      const restoredLayers: Layer[] = await Promise.all(
        project.layers.map(async (serializedLayer) => {
          const layer = { ...serializedLayer } as any;
          
          // Load images for image/texture layers
          if ((layer.type === 'image' || layer.type === 'texture') && layer.src) {
            try {
              layer.image = await loadImageFromSrc(layer.src);
            } catch (e) {
              console.warn('Failed to load image for layer:', layer.name);
            }
          }
          
          // Load fill images for fill layers
          if (layer.type === 'fill' && layer.fillImageDataUrl) {
            try {
              layer.fillImage = await loadImageFromSrc(layer.fillImageDataUrl);
            } catch (e) {
              console.warn('Failed to load fill image for layer:', layer.name);
            }
          }
          
          return layer as Layer;
        })
      );
      
      set({
        layers: restoredLayers,
        selectedLayerId: null,
        baseColor: project.baseColor,
        currentModelId: project.modelId,
        history: [createHistorySnapshot(restoredLayers, project.baseColor)],
        historyIndex: 0,
        isDirty: false,
        projectName: project.name,
        activeTool: 'select',
      });
    },
  };
});

