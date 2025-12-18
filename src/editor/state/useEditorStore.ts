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

interface EditorStore extends EditorState {
  history: HistorySnapshot[];
  historyIndex: number;
  maxHistorySize: number;
  
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
}

const createHistorySnapshot = (layers: Layer[], baseColor: string): HistorySnapshot => ({
  layers: layers.map(layer => ({ ...layer })),
  baseColor,
});

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
        });
      }
    },

    pushHistory,
  };
});

