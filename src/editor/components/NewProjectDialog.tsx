import { useState } from 'react';
import { useEditorStore } from '../state/useEditorStore';
import { carModels } from '../../data/carModels';
import { getVehicleImageUrl } from '../../utils/assets';
import { clearAllSavedState } from '../../utils/localStorageProject';
import Tooltip from '@mui/material/Tooltip';

interface NewProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// Tesla factory colors only - Official Tesla paint colors
const factoryColors = [
  { name: 'Pearl White Multi-Coat', color: '#F5F5F0' },
  { name: 'Midnight Silver Metallic', color: '#636B6F' },
  { name: 'Deep Blue Metallic', color: '#0A1F44' },
  { name: 'Solid Black', color: '#000000' },
  { name: 'Red Multi-Coat', color: '#A21B1F' },
  { name: 'Quicksilver', color: '#A6A6A6' },
  { name: 'Midnight Cherry Red', color: '#3B0A0A' },
];

export const NewProjectDialog = ({ isOpen, onClose }: NewProjectDialogProps) => {
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState('#F5F5F0'); // Pearl White Multi-Coat
  const [customColor, setCustomColor] = useState('#3B82F6');
  const [projectName, setProjectNameLocal] = useState('');

  const selectedColorName =
    factoryColors.find(c => c.color === selectedColor)?.name || 'Custom Color';
  
  const { setCurrentModelId, setBaseColor, resetProject, setProjectName } = useEditorStore();

  const handleSelectModel = (modelId: string) => {
    setSelectedModelId(modelId);
  };

  const handleSelectColor = (color: string) => {
    setSelectedColor(color);
  };

  const handleCustomColorChange = (color: string) => {
    setCustomColor(color);
    setSelectedColor(color);
  };

  const isCustomColor = !factoryColors.some(c => c.color === selectedColor);

  const handleCreate = () => {
    if (!selectedModelId) return;
    
    // Clear all saved state from localStorage (project + UI state)
    clearAllSavedState();
    
    // Reset project (clears all layers and history)
    resetProject();
    
    // Set the new model and color
    setCurrentModelId(selectedModelId);
    setBaseColor(selectedColor);
    
    // Set project name
    const name = projectName.trim() || 'New Project';
    setProjectName(name);
    
    // Reset dialog state
    setSelectedModelId(null);
    setSelectedColor('#F5F5F0'); // Pearl White Multi-Coat as default
    setProjectNameLocal('');
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-4 sm:px-6 border-b border-white/10 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-white">New Project</h2>
            <p className="text-xs text-white/50 mt-0.5">Select a model and base color</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Close dialog"
            aria-label="Close dialog"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:p-6 space-y-5 sm:space-y-6">
          {/* Project Name */}
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">Project Name</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectNameLocal(e.target.value)}
              placeholder="New Project"
              className="w-full px-3 py-2 bg-[#2c2c2e] border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-transparent"
            />
          </div>
          
          {/* Model Selection */}
          <div>
            <label className="block text-xs font-medium text-white/60 mb-2">Tesla Model</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {carModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleSelectModel(model.id)}
                  className={`group relative rounded-xl overflow-hidden transition-all duration-150 focus:outline-none text-left h-full ${
                    selectedModelId === model.id
                      ? 'ring-2 ring-tesla-red shadow-[0_10px_30px_-10px_rgba(239,68,68,0.45)]'
                      : 'ring-1 ring-white/10 hover:ring-white/30'
                  }`}
                  title={model.name}
                >
                  <div className="aspect-[4/3] bg-[#2c2c2e] flex items-center justify-center relative overflow-hidden">
                    <img
                      src={getVehicleImageUrl(model.folderName)}
                      alt={model.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    {selectedModelId === model.id && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-tesla-red rounded-full flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="px-2 py-2 bg-[#252527]">
                    <span className="text-[11px] sm:text-xs font-medium text-white/80 truncate block leading-tight" aria-hidden>
                      {model.name}
                    </span>
                    <span className="sr-only">Select {model.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-xs font-medium text-white/60 mb-2">Base Color</label>
            <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
              {factoryColors.map((c) => (
                <Tooltip key={c.color} title={c.name} placement="top" arrow>
                  <button
                    onClick={() => handleSelectColor(c.color)}
                    className={`w-10 h-10 rounded-xl transition-all duration-150 focus:outline-none ${
                      selectedColor === c.color
                        ? 'ring-2 ring-tesla-red ring-offset-2 ring-offset-[#1c1c1e] scale-105'
                        : 'ring-1 ring-white/10 hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.color }}
                    aria-label={c.name}
                  >
                    {selectedColor === c.color && (
                      <svg
                        className={`w-4 h-4 mx-auto ${
                          c.color === '#FFFFFF' || c.color === '#F5F5F5' || c.color === '#F5F5F0' || c.color === '#E8E8E8' || c.color === '#A6A6A6'
                            ? 'text-black/50'
                            : 'text-white/90'
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </Tooltip>
              ))}
              {/* Custom color picker */}
              <Tooltip title="Custom Color" placement="top" arrow>
                <label className="relative cursor-pointer">
                  <input
                    type="color"
                    value={isCustomColor ? selectedColor : customColor}
                    onChange={(e) => handleCustomColorChange(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    aria-label="Custom color"
                  />
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 ${
                      isCustomColor
                        ? 'ring-2 ring-tesla-red ring-offset-2 ring-offset-[#1c1c1e] scale-105'
                        : 'ring-1 ring-white/10 hover:scale-105'
                    }`}
                    style={{
                      background: isCustomColor
                        ? selectedColor
                        : 'conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)'
                    }}
                  >
                    {isCustomColor ? (
                      <svg className="w-4 h-4 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <div className="w-3 h-3 bg-[#1c1c1e] rounded-full" />
                    )}
                  </div>
                </label>
              </Tooltip>
              <span className="text-xs text-white/60 ml-1 sm:ml-2">{selectedColorName}</span>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-4 py-4 sm:px-6 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 bg-[#161618]">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!selectedModelId}
            className="w-full sm:w-auto px-5 py-2 bg-tesla-red hover:bg-tesla-red/90 disabled:bg-white/10 disabled:text-white/30 text-white rounded-lg font-medium transition-colors text-sm disabled:cursor-not-allowed"
          >
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
};
