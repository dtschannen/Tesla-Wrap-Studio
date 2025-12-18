import { useEditorStore } from './state/useEditorStore';

const webSafeFonts = [
  'Arial',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Impact',
];

// Brush settings component
const BrushSettingsPanel = () => {
  const { activeTool, brushSettings, setBrushSettings } = useEditorStore();
  
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-tesla-gray uppercase tracking-wider">
        {activeTool === 'eraser' ? 'Eraser' : 'Brush'} Settings
      </h3>
      
      {/* Size */}
      <div>
        <label className="block text-xs font-medium text-tesla-gray mb-1.5">Size</label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="1"
            max="200"
            value={brushSettings.size}
            onChange={(e) => setBrushSettings({ size: parseInt(e.target.value) })}
            className="flex-1 h-2 bg-tesla-black rounded-lg appearance-none cursor-pointer accent-tesla-red"
          />
          <input
            type="number"
            min="1"
            max="200"
            value={brushSettings.size}
            onChange={(e) => setBrushSettings({ size: parseInt(e.target.value) || 1 })}
            className="w-16 px-2 py-1 bg-tesla-black/60 border border-tesla-dark/50 rounded text-sm text-tesla-light text-center"
          />
        </div>
      </div>

      {/* Color (only for brush) */}
      {activeTool === 'brush' && (
        <div>
          <label className="block text-xs font-medium text-tesla-gray mb-1.5">Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brushSettings.color}
              onChange={(e) => setBrushSettings({ color: e.target.value })}
              className="h-10 w-16 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg cursor-pointer"
            />
            <input
              type="text"
              value={brushSettings.color}
              onChange={(e) => setBrushSettings({ color: e.target.value })}
              className="flex-1 px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light"
            />
          </div>
        </div>
      )}

      {/* Hardness */}
      <div>
        <label className="block text-xs font-medium text-tesla-gray mb-1.5">Hardness</label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="100"
            value={brushSettings.hardness}
            onChange={(e) => setBrushSettings({ hardness: parseInt(e.target.value) })}
            className="flex-1 h-2 bg-tesla-black rounded-lg appearance-none cursor-pointer accent-tesla-red"
          />
          <span className="text-xs text-tesla-gray w-10 text-right">{brushSettings.hardness}%</span>
        </div>
      </div>

      {/* Opacity */}
      <div>
        <label className="block text-xs font-medium text-tesla-gray mb-1.5">Opacity</label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="1"
            max="100"
            value={brushSettings.opacity}
            onChange={(e) => setBrushSettings({ opacity: parseInt(e.target.value) })}
            className="flex-1 h-2 bg-tesla-black rounded-lg appearance-none cursor-pointer accent-tesla-red"
          />
          <span className="text-xs text-tesla-gray w-10 text-right">{brushSettings.opacity}%</span>
        </div>
      </div>

      {/* Flow */}
      <div>
        <label className="block text-xs font-medium text-tesla-gray mb-1.5">Flow</label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="1"
            max="100"
            value={brushSettings.flow}
            onChange={(e) => setBrushSettings({ flow: parseInt(e.target.value) })}
            className="flex-1 h-2 bg-tesla-black rounded-lg appearance-none cursor-pointer accent-tesla-red"
          />
          <span className="text-xs text-tesla-gray w-10 text-right">{brushSettings.flow}%</span>
        </div>
      </div>

      {/* Blend Mode (only for brush) */}
      {activeTool === 'brush' && (
        <div>
          <label className="block text-xs font-medium text-tesla-gray mb-1.5">Blend Mode</label>
          <select
            value={brushSettings.blendMode}
            onChange={(e) => setBrushSettings({ blendMode: e.target.value as any })}
            className="w-full px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/50"
          >
            <option value="normal">Normal</option>
            <option value="multiply">Multiply</option>
            <option value="screen">Screen</option>
            <option value="overlay">Overlay</option>
          </select>
        </div>
      )}

      {/* Brush Preview */}
      <div className="pt-3 border-t border-tesla-dark/30">
        <label className="block text-xs font-medium text-tesla-gray mb-2">Preview</label>
        <div className="flex items-center justify-center bg-white/10 rounded-lg p-4 h-20">
          <div
            className="rounded-full transition-all"
            style={{
              width: Math.min(brushSettings.size, 60),
              height: Math.min(brushSettings.size, 60),
              backgroundColor: activeTool === 'eraser' ? '#ffffff' : brushSettings.color,
              opacity: brushSettings.opacity / 100,
              boxShadow: brushSettings.hardness < 100 
                ? `0 0 ${(100 - brushSettings.hardness) / 3}px ${activeTool === 'eraser' ? '#ffffff' : brushSettings.color}`
                : 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
};

export const PropertiesPanel = () => {
  const { layers, selectedLayerId, updateLayer, baseColor, setBaseColor, activeTool } = useEditorStore();

  const selectedLayer = layers.find((l) => l.id === selectedLayerId);
  const showBrushSettings = activeTool === 'brush' || activeTool === 'eraser';

  if (!selectedLayer) {
    return (
      <div className="h-full panel rounded-r-xl flex flex-col w-80">
        <div className="p-4 border-b border-tesla-dark/30">
          <h2 className="text-lg font-semibold text-tesla-light flex items-center gap-2">
            <svg className="w-5 h-5 text-tesla-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Properties
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {showBrushSettings ? (
            <BrushSettingsPanel />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-tesla-gray">
                <svg className="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <p className="text-sm">No layer selected</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const updateProperty = (key: string, value: any) => {
    updateLayer(selectedLayer.id, { [key]: value });
  };

  return (
    <div className="h-full panel rounded-r-xl flex flex-col w-80">
        <div className="p-4 border-b border-tesla-dark/30">
          <h2 className="text-lg font-semibold text-tesla-light flex items-center gap-2">
            <svg className="w-5 h-5 text-tesla-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Properties
          </h2>
          <div className="text-sm text-tesla-gray mt-1 truncate">{selectedLayer.name}</div>
        </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Brush Settings (shown when brush or eraser tool is active) */}
        {showBrushSettings && (
          <BrushSettingsPanel />
        )}
        {/* Common Properties */}
        <div>
          <h3 className="text-xs font-semibold mb-3 text-tesla-gray uppercase tracking-wider">Common</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-tesla-gray mb-1.5">Opacity</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={selectedLayer.opacity}
                onChange={(e) => updateProperty('opacity', parseFloat(e.target.value))}
                className="w-full h-2 bg-tesla-black rounded-lg appearance-none cursor-pointer accent-tesla-red"
              />
              <div className="text-xs text-tesla-dark mt-1 text-right">
                {Math.round(selectedLayer.opacity * 100)}%
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-tesla-gray mb-1.5">X</label>
                <input
                  type="number"
                  value={Math.round(selectedLayer.x)}
                  onChange={(e) => updateProperty('x', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-tesla-red/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-tesla-gray mb-1.5">Y</label>
                <input
                  type="number"
                  value={Math.round(selectedLayer.y)}
                  onChange={(e) => updateProperty('y', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-tesla-red/50 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-tesla-gray mb-1.5">Rotation</label>
              <input
                type="number"
                value={Math.round(selectedLayer.rotation)}
                onChange={(e) => updateProperty('rotation', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-tesla-red/50 transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-tesla-gray mb-1.5">Scale X</label>
                <input
                  type="number"
                  step="0.1"
                  value={selectedLayer.scaleX}
                  onChange={(e) => updateProperty('scaleX', parseFloat(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-tesla-red/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-tesla-gray mb-1.5">Scale Y</label>
                <input
                  type="number"
                  step="0.1"
                  value={selectedLayer.scaleY}
                  onChange={(e) => updateProperty('scaleY', parseFloat(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-tesla-red/50 transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Type-specific Properties */}
        {selectedLayer.type === 'text' && (
          <div>
            <h3 className="text-xs font-semibold mb-3 text-tesla-gray uppercase tracking-wider">Text</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-tesla-gray mb-1.5">Text</label>
                <textarea
                  value={selectedLayer.text}
                  onChange={(e) => updateProperty('text', e.target.value)}
                  className="w-full px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-tesla-red/50 transition-all resize-none"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-tesla-gray mb-1.5">Font Size</label>
                <input
                  type="number"
                  value={selectedLayer.fontSize}
                  onChange={(e) => updateProperty('fontSize', parseInt(e.target.value) || 12)}
                  className="w-full px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-tesla-red/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-tesla-gray mb-1.5">Font Family</label>
                <select
                  value={selectedLayer.fontFamily}
                  onChange={(e) => updateProperty('fontFamily', e.target.value)}
                  className="w-full px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-tesla-red/50 transition-all"
                >
                  {webSafeFonts.map((font) => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-tesla-gray mb-1.5">Color</label>
                <input
                  type="color"
                  value={selectedLayer.fill}
                  onChange={(e) => updateProperty('fill', e.target.value)}
                  className="w-full h-10 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg cursor-pointer"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-tesla-gray mb-1.5">Align</label>
                  <select
                    value={selectedLayer.align}
                    onChange={(e) => updateProperty('align', e.target.value as any)}
                    className="w-full px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-tesla-red/50 transition-all"
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-tesla-gray mb-1.5">Vertical Align</label>
                  <select
                    value={selectedLayer.verticalAlign}
                    onChange={(e) => updateProperty('verticalAlign', e.target.value as any)}
                    className="w-full px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-tesla-red/50 transition-all"
                  >
                    <option value="top">Top</option>
                    <option value="middle">Middle</option>
                    <option value="bottom">Bottom</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-tesla-gray mb-1.5">Font Style</label>
                  <select
                    value={selectedLayer.fontStyle}
                    onChange={(e) => updateProperty('fontStyle', e.target.value as any)}
                    className="w-full px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-tesla-red/50 transition-all"
                  >
                    <option value="normal">Normal</option>
                    <option value="italic">Italic</option>
                    <option value="bold">Bold</option>
                    <option value="bold italic">Bold Italic</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-tesla-gray mb-1.5">Decoration</label>
                  <select
                    value={selectedLayer.textDecoration}
                    onChange={(e) => updateProperty('textDecoration', e.target.value as any)}
                    className="w-full px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-tesla-red/50 transition-all"
                  >
                    <option value="none">None</option>
                    <option value="underline">Underline</option>
                    <option value="line-through">Line Through</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedLayer.type === 'rect' && (
          <div>
            <h3 className="text-xs font-semibold mb-3 text-tesla-gray uppercase tracking-wider">Rectangle</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-tesla-gray mb-1.5">Width</label>
                  <input
                    type="number"
                    value={Math.round(selectedLayer.width)}
                    onChange={(e) => updateProperty('width', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-tesla-red/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-tesla-gray mb-1.5">Height</label>
                  <input
                    type="number"
                    value={Math.round(selectedLayer.height)}
                    onChange={(e) => updateProperty('height', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-tesla-red/50 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-tesla-gray mb-1.5">Fill</label>
                <input
                  type="color"
                  value={selectedLayer.fill}
                  onChange={(e) => updateProperty('fill', e.target.value)}
                  className="w-full h-10 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-tesla-gray mb-1.5">Stroke</label>
                <input
                  type="color"
                  value={selectedLayer.stroke || '#000000'}
                  onChange={(e) => updateProperty('stroke', e.target.value)}
                  className="w-full h-10 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg cursor-pointer"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-tesla-gray mb-1.5">Stroke Width</label>
                  <input
                    type="number"
                    value={selectedLayer.strokeWidth || 0}
                    onChange={(e) => updateProperty('strokeWidth', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-tesla-red/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-tesla-gray mb-1.5">Corner Radius</label>
                  <input
                    type="number"
                    value={selectedLayer.cornerRadius || 0}
                    onChange={(e) => updateProperty('cornerRadius', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-tesla-red/50 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedLayer.type === 'circle' && (
          <div>
            <h3 className="text-xs font-semibold mb-3 text-tesla-gray uppercase tracking-wider">Circle</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-tesla-gray mb-1.5">Radius</label>
                <input
                  type="number"
                  value={Math.round(selectedLayer.radius)}
                  onChange={(e) => updateProperty('radius', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-tesla-red/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-tesla-gray mb-1.5">Fill</label>
                <input
                  type="color"
                  value={selectedLayer.fill}
                  onChange={(e) => updateProperty('fill', e.target.value)}
                  className="w-full h-10 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-tesla-gray mb-1.5">Stroke</label>
                <input
                  type="color"
                  value={selectedLayer.stroke || '#000000'}
                  onChange={(e) => updateProperty('stroke', e.target.value)}
                  className="w-full h-10 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-tesla-gray mb-1.5">Stroke Width</label>
                <input
                  type="number"
                  value={selectedLayer.strokeWidth || 0}
                  onChange={(e) => updateProperty('strokeWidth', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-tesla-red/50 transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {selectedLayer.type === 'image' && (
          <div>
            <h3 className="text-xs font-semibold mb-3 text-tesla-gray uppercase tracking-wider">Image</h3>
            <div className="space-y-2">
              <div className="text-xs text-tesla-gray bg-tesla-black/40 p-3 rounded-lg">
                <div className="font-medium text-tesla-light mb-1">File</div>
                <div className="truncate">{selectedLayer.name}</div>
              </div>
              {selectedLayer.image && (
                <div className="text-xs text-tesla-gray bg-tesla-black/40 p-3 rounded-lg">
                  <div className="font-medium text-tesla-light mb-1">Dimensions</div>
                  <div>{selectedLayer.image.width} × {selectedLayer.image.height}px</div>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedLayer.type === 'line' && (
          <div>
            <h3 className="text-xs font-semibold mb-3 text-tesla-gray uppercase tracking-wider">Line</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-tesla-gray mb-1.5">Stroke Color</label>
                <input
                  type="color"
                  value={selectedLayer.stroke}
                  onChange={(e) => updateProperty('stroke', e.target.value)}
                  className="w-full h-10 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-tesla-gray mb-1.5">Stroke Width</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={selectedLayer.strokeWidth}
                  onChange={(e) => updateProperty('strokeWidth', parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-tesla-red/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-tesla-gray mb-1.5">Line Cap</label>
                <select
                  value={selectedLayer.lineCap || 'round'}
                  onChange={(e) => updateProperty('lineCap', e.target.value as any)}
                  className="w-full px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-tesla-red/50 transition-all"
                >
                  <option value="butt">Butt</option>
                  <option value="round">Round</option>
                  <option value="square">Square</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-tesla-gray mb-1.5">Line Join</label>
                <select
                  value={selectedLayer.lineJoin || 'round'}
                  onChange={(e) => updateProperty('lineJoin', e.target.value as any)}
                  className="w-full px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-tesla-red/50 transition-all"
                >
                  <option value="miter">Miter</option>
                  <option value="round">Round</option>
                  <option value="bevel">Bevel</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedLayer.arrowStart || false}
                    onChange={(e) => updateProperty('arrowStart', e.target.checked)}
                    className="w-4 h-4 rounded border-tesla-dark/50 bg-tesla-black/60 text-tesla-red focus:ring-tesla-red/50"
                  />
                  <span className="text-xs text-tesla-gray">Arrow Start</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedLayer.arrowEnd || false}
                    onChange={(e) => updateProperty('arrowEnd', e.target.checked)}
                    className="w-4 h-4 rounded border-tesla-dark/50 bg-tesla-black/60 text-tesla-red focus:ring-tesla-red/50"
                  />
                  <span className="text-xs text-tesla-gray">Arrow End</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {selectedLayer.type === 'star' && (
          <div>
            <h3 className="text-xs font-semibold mb-3 text-tesla-gray uppercase tracking-wider">Star</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-tesla-gray mb-1.5">Points</label>
                <input
                  type="number"
                  min="3"
                  max="50"
                  value={selectedLayer.numPoints}
                  onChange={(e) => updateProperty('numPoints', parseInt(e.target.value) || 5)}
                  className="w-full px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-tesla-red/50 transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-tesla-gray mb-1.5">Inner Radius</label>
                  <input
                    type="number"
                    min="1"
                    value={Math.round(selectedLayer.innerRadius)}
                    onChange={(e) => updateProperty('innerRadius', parseFloat(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-tesla-red/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-tesla-gray mb-1.5">Outer Radius</label>
                  <input
                    type="number"
                    min="1"
                    value={Math.round(selectedLayer.outerRadius)}
                    onChange={(e) => updateProperty('outerRadius', parseFloat(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-tesla-red/50 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-tesla-gray mb-1.5">Fill</label>
                <input
                  type="color"
                  value={selectedLayer.fill}
                  onChange={(e) => updateProperty('fill', e.target.value)}
                  className="w-full h-10 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-tesla-gray mb-1.5">Stroke</label>
                <input
                  type="color"
                  value={selectedLayer.stroke || '#000000'}
                  onChange={(e) => updateProperty('stroke', e.target.value)}
                  className="w-full h-10 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-tesla-gray mb-1.5">Stroke Width</label>
                <input
                  type="number"
                  min="0"
                  value={selectedLayer.strokeWidth || 0}
                  onChange={(e) => updateProperty('strokeWidth', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-tesla-red/50 transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {selectedLayer.type === 'brush' && (
          <div>
            <h3 className="text-xs font-semibold mb-3 text-tesla-gray uppercase tracking-wider">Brush Layer</h3>
            <div className="space-y-2">
              <div className="text-xs text-tesla-gray bg-tesla-black/40 p-3 rounded-lg">
                <div className="font-medium text-tesla-light mb-1">Strokes</div>
                <div>{(selectedLayer as any).strokes?.length || 0} stroke(s)</div>
              </div>
              <button
                onClick={() => updateProperty('strokes', [])}
                className="w-full px-3 py-2 bg-tesla-red/20 border border-tesla-red/50 rounded-lg text-sm text-tesla-red hover:bg-tesla-red/30 transition-colors"
              >
                Clear All Strokes
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Base Car Color */}
      <div className="p-4 border-t border-tesla-dark/30">
        <h3 className="text-xs font-semibold mb-3 text-tesla-gray uppercase tracking-wider">Base Color</h3>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={baseColor}
            onChange={(e) => setBaseColor(e.target.value)}
            className="h-10 w-16 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg cursor-pointer"
          />
          <input
            type="text"
            value={baseColor}
            onChange={(e) => setBaseColor(e.target.value)}
            className="flex-1 px-3 py-2 bg-tesla-black/60 border border-tesla-dark/50 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-tesla-red/50 transition-all"
          />
        </div>
      </div>

    </div>
  );
};

