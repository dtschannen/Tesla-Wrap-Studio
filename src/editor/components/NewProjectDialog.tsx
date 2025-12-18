import { useState } from 'react';
import { useEditorStore } from '../state/useEditorStore';
import { carModels } from '../../data/carModels';
import { getVehicleImageUrl } from '../../utils/assets';
import { clearSavedProject } from '../../utils/localStorageProject';

interface NewProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// Tesla factory colors only
const factoryColors = [
  { name: 'Pearl White', color: '#F5F5F5' },
  { name: 'Solid Black', color: '#1C1C1C' },
  { name: 'Midnight Silver', color: '#4A4B4D' },
  { name: 'Deep Blue', color: '#1E3A5F' },
  { name: 'Red Multi-Coat', color: '#A12830' },
  { name: 'Quicksilver', color: '#8C8C8C' },
  { name: 'Midnight Cherry', color: '#4A1C2B' },
];

export const NewProjectDialog = ({ isOpen, onClose }: NewProjectDialogProps) => {
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState('#F5F5F5');
  const [customColor, setCustomColor] = useState('#3B82F6');
  const [projectName, setProjectNameLocal] = useState('');
  
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
    
    // Clear any saved project from localStorage
    clearSavedProject();
    
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
    setSelectedColor('#F5F5F5');
    setProjectNameLocal('');
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="relative bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">New Project</h2>
            <p className="text-xs text-white/50 mt-0.5">Select a model and base color</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-5">
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
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {carModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleSelectModel(model.id)}
                  className={`group relative rounded-lg overflow-visible transition-all duration-150 focus:outline-none ${
                    selectedModelId === model.id
                      ? 'ring-2 ring-tesla-red'
                      : 'ring-1 ring-white/10 hover:ring-white/30'
                  }`}
                >
                  {/* Custom tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {model.name}
                  </div>
                  <div className="aspect-[4/3] bg-[#2c2c2e] flex items-center justify-center relative overflow-hidden rounded-t-lg">
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
                  <div className="px-1.5 py-1.5 bg-[#252527] rounded-b-lg">
                    <span className="text-[10px] font-medium text-white/70 truncate block text-center leading-tight">{model.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-xs font-medium text-white/60 mb-2">Base Color</label>
            <div className="flex gap-1.5">
              {factoryColors.map((c) => (
                <button
                  key={c.color}
                  onClick={() => handleSelectColor(c.color)}
                  className={`w-8 h-8 rounded-lg transition-all duration-150 focus:outline-none ${
                    selectedColor === c.color
                      ? 'ring-2 ring-tesla-red ring-offset-2 ring-offset-[#1c1c1e] scale-105'
                      : 'ring-1 ring-white/10 hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.color }}
                  title={c.name}
                >
                  {selectedColor === c.color && (
                    <svg 
                      className={`w-4 h-4 mx-auto ${
                        c.color === '#FFFFFF' || c.color === '#F5F5F5' || c.color === '#E8E8E8' 
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
              ))}
              {/* Custom color picker */}
              <label className="relative cursor-pointer">
                <input
                  type="color"
                  value={isCustomColor ? selectedColor : customColor}
                  onChange={(e) => handleCustomColorChange(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div 
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 ${
                    isCustomColor
                      ? 'ring-2 ring-tesla-red ring-offset-2 ring-offset-[#1c1c1e] scale-105'
                      : 'ring-1 ring-white/10 hover:scale-105'
                  }`}
                  style={{ 
                    background: isCustomColor 
                      ? selectedColor 
                      : 'conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)'
                  }}
                  title="Custom Color"
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
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3 bg-[#161618]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!selectedModelId}
            className="px-5 py-2 bg-tesla-red hover:bg-tesla-red/90 disabled:bg-white/10 disabled:text-white/30 text-white rounded-lg font-medium transition-colors text-sm disabled:cursor-not-allowed"
          >
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
};
