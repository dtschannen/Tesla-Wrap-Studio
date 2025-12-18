import { useState, useEffect } from 'react';
import { useEditorStore } from './state/useEditorStore';
import { carModels } from '../data/carModels';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface LayerItemProps {
  layer: any;
  index?: number;
}

const LayerItem = ({ layer }: LayerItemProps) => {
  const { selectedLayerId, setSelection, updateLayer, deleteLayer } = useEditorStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(layer.name);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: layer.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isSelected = selectedLayerId === layer.id;

  const handleNameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingName(true);
    setEditedName(layer.name);
  };

  const handleNameBlur = () => {
    if (editedName.trim() && editedName !== layer.name) {
      updateLayer(layer.id, { name: editedName.trim() });
    } else {
      setEditedName(layer.name);
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameBlur();
    } else if (e.key === 'Escape') {
      setEditedName(layer.name);
      setIsEditingName(false);
    }
  };

  // Update editedName when layer name changes externally
  useEffect(() => {
    if (!isEditingName) {
      setEditedName(layer.name);
    }
  }, [layer.name, isEditingName]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`card mb-2 cursor-pointer ${
        isSelected
          ? 'bg-gradient-to-r from-tesla-red/20 to-tesla-red/30 border-tesla-red/50 shadow-tesla-red/10'
          : 'hover:bg-tesla-black/80'
      }`}
      onClick={() => setSelection(layer.id)}
    >
      <div className="flex items-center gap-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-tesla-gray hover:text-tesla-light transition-colors p-1 rounded"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          {isEditingName ? (
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="w-full px-2 py-1 bg-tesla-black/80 border border-tesla-red/50 rounded text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/50"
              aria-label="Layer name"
              autoFocus
            />
          ) : (
            <div
              className="text-sm font-medium text-tesla-light truncate cursor-text hover:text-tesla-red/80 transition-colors"
              onClick={handleNameClick}
              title="Click to edit name"
            >
              {layer.name || 'Layer'}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateLayer(layer.id, { visible: !layer.visible });
            }}
            className="p-1.5 hover:bg-tesla-dark/50 rounded-lg transition-colors text-tesla-gray hover:text-tesla-light"
            title={layer.visible ? 'Hide' : 'Show'}
          >
            {layer.visible ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m13.42 13.42L21 21M12 12l.01.01" />
              </svg>
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateLayer(layer.id, { locked: !layer.locked });
            }}
            className="p-1.5 hover:bg-tesla-dark/50 rounded-lg transition-colors text-tesla-gray hover:text-tesla-light"
            title={layer.locked ? 'Unlock' : 'Lock'}
          >
            {layer.locked ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!layer.locked) {
                deleteLayer(layer.id);
              }
            }}
            disabled={layer.locked}
            className="p-1.5 hover:bg-tesla-red/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors text-tesla-gray hover:text-tesla-red"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export const LayersPanel = () => {
  const { layers, reorderLayers, currentModelId, baseColor, setBaseColor } = useEditorStore();
  const currentModel = carModels.find((m) => m.id === currentModelId) || carModels[0];

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = layers.findIndex((layer) => layer.id === active.id);
      const newIndex = layers.findIndex((layer) => layer.id === over.id);
      reorderLayers(oldIndex, newIndex);
    }
  };

  return (
    <div className="h-full panel rounded-l-xl flex flex-col w-64 overflow-x-hidden">
      <div className="p-4 border-b border-tesla-dark/30">
        <h2 className="text-lg font-semibold text-tesla-light flex items-center gap-2">
          <svg className="w-5 h-5 text-tesla-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Layers
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={layers.map((l) => l.id)}
            strategy={verticalListSortingStrategy}
          >
            {layers.map((layer, index) => (
              <LayerItem key={layer.id} layer={layer} index={index} />
            ))}
          </SortableContext>
        </DndContext>
        
        {/* Template Layer - Always at the bottom as the base layer */}
        <div className="card mb-2 border border-tesla-dark/30">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-tesla-light truncate">Template</div>
              <div className="text-xs text-tesla-gray truncate">{currentModel.name}</div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={baseColor}
                onChange={(e) => setBaseColor(e.target.value)}
                className="h-8 w-8 rounded-full cursor-pointer color-circle"
                style={{
                  backgroundColor: baseColor,
                  border: 'none',
                  padding: 0,
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                }}
                title="Base color"
                aria-label="Base color"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

