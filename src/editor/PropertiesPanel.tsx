import { useEditorStore } from './state/useEditorStore';
import { useEffect, useState, type ReactNode } from 'react';
import { 
  ChevronDown, 
  Move, 
  Type, 
  Square, 
  Circle, 
  Image, 
  Minus, 
  Star,
  Paintbrush,
  Droplet,
  Layers
} from 'lucide-react';

// Comprehensive font list organized by category
const fontCategories = {
  'Sans Serif': [
    'Arial', 'Helvetica', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Segoe UI',
    'Open Sans', 'Roboto', 'Lato', 'Montserrat', 'Poppins', 'Nunito',
    'Raleway', 'Inter', 'Source Sans Pro', 'Ubuntu', 'Oswald', 'Quicksand',
    'Rubik', 'Work Sans', 'Fira Sans', 'Barlow', 'DM Sans', 'Manrope', 'Outfit',
  ],
  'Serif': [
    'Times New Roman', 'Georgia', 'Palatino Linotype', 'Book Antiqua',
    'Garamond', 'Playfair Display', 'Merriweather', 'Lora', 'PT Serif',
    'Noto Serif', 'Libre Baskerville', 'Crimson Text', 'Bitter',
    'Cormorant Garamond', 'EB Garamond', 'Spectral', 'Source Serif Pro',
  ],
  'Display': [
    'Impact', 'Anton', 'Bebas Neue', 'Righteous', 'Alfa Slab One', 'Russo One',
    'Black Ops One', 'Bangers', 'Bungee', 'Permanent Marker', 'Orbitron',
    'Press Start 2P', 'Audiowide', 'Racing Sans One', 'Teko', 'Kanit',
    'Staatliches', 'Bowlby One SC',
  ],
  'Handwriting': [
    'Comic Sans MS', 'Brush Script MT', 'Pacifico', 'Dancing Script', 'Satisfy',
    'Caveat', 'Indie Flower', 'Sacramento', 'Great Vibes', 'Kaushan Script',
    'Lobster', 'Lobster Two', 'Courgette', 'Cookie', 'Allura', 'Alex Brush',
  ],
  'Monospace': [
    'Courier New', 'Consolas', 'Monaco', 'Lucida Console', 'Roboto Mono',
    'Source Code Pro', 'Fira Code', 'JetBrains Mono', 'IBM Plex Mono',
    'Space Mono', 'Inconsolata',
  ],
};

// Google Fonts that need to be loaded
const googleFonts = [
  'Open Sans', 'Roboto', 'Lato', 'Montserrat', 'Poppins', 'Nunito', 'Raleway', 'Inter',
  'Source Sans Pro', 'Ubuntu', 'Oswald', 'Quicksand', 'Rubik', 'Work Sans', 'Fira Sans',
  'Barlow', 'DM Sans', 'Manrope', 'Outfit', 'Playfair Display', 'Merriweather', 'Lora',
  'PT Serif', 'Noto Serif', 'Libre Baskerville', 'Crimson Text', 'Bitter', 'Cormorant Garamond',
  'EB Garamond', 'Spectral', 'Source Serif Pro', 'Anton', 'Bebas Neue', 'Righteous',
  'Alfa Slab One', 'Russo One', 'Black Ops One', 'Bangers', 'Bungee', 'Permanent Marker',
  'Orbitron', 'Press Start 2P', 'Audiowide', 'Racing Sans One', 'Teko', 'Kanit', 'Staatliches',
  'Bowlby One SC', 'Pacifico', 'Dancing Script', 'Satisfy', 'Caveat', 'Indie Flower',
  'Sacramento', 'Great Vibes', 'Kaushan Script', 'Lobster', 'Lobster Two', 'Courgette',
  'Cookie', 'Allura', 'Alex Brush', 'Roboto Mono', 'Source Code Pro', 'Fira Code',
  'JetBrains Mono', 'IBM Plex Mono', 'Space Mono', 'Inconsolata',
];

const loadGoogleFonts = () => {
  const link = document.getElementById('google-fonts-link');
  if (!link) {
    const fontFamilies = googleFonts.map(f => f.replace(/ /g, '+')).join('&family=');
    const linkElement = document.createElement('link');
    linkElement.id = 'google-fonts-link';
    linkElement.rel = 'stylesheet';
    linkElement.href = `https://fonts.googleapis.com/css2?family=${fontFamilies}&display=swap`;
    document.head.appendChild(linkElement);
  }
};

// ============================================================================
// REUSABLE UI COMPONENTS
// ============================================================================

interface CollapsibleSectionProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}

const CollapsibleSection = ({ title, icon, children, defaultOpen = true }: CollapsibleSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border border-tesla-dark/30 rounded-xl overflow-hidden bg-tesla-black/20">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-tesla-dark/20 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-tesla-gray">{icon}</span>
          <span className="text-sm font-medium text-tesla-light">{title}</span>
        </div>
        <ChevronDown 
          className={`w-4 h-4 text-tesla-gray transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>
      <div className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-4 pb-4 pt-1 space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
};

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const ColorPicker = ({ label, value, onChange }: ColorPickerProps) => (
  <div className="space-y-2">
    <label className="text-xs font-medium text-tesla-gray">{label}</label>
    <div className="flex items-center gap-2">
      <div className="relative">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          aria-label={label}
          title={label}
        />
        <div 
          className="w-10 h-10 rounded-lg border-2 border-tesla-dark/50 shadow-inner cursor-pointer hover:border-tesla-gray/50 transition-colors"
          style={{ backgroundColor: value }}
        />
      </div>
      <input
        type="text"
        value={value.toUpperCase()}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-3 py-2.5 bg-tesla-black/50 border border-tesla-dark/40 rounded-lg text-sm text-tesla-light font-mono uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-tesla-red/40 focus:border-tesla-red/40 transition-all"
        aria-label={`${label} hex value`}
        placeholder="#000000"
      />
    </div>
  </div>
);

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  showInput?: boolean;
  hint?: string;
}

const SliderControl = ({ label, value, min, max, step = 1, unit = '', onChange, showInput = false, hint }: SliderControlProps) => {
  const percentage = ((value - min) / (max - min)) * 100;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-tesla-gray">{label}</label>
        <span className="text-xs font-medium text-tesla-light bg-tesla-dark/40 px-2 py-0.5 rounded-md">
          {value}{unit}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative flex-1 h-2">
          <div className="absolute inset-0 bg-tesla-dark/60 rounded-full" />
          <div 
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-tesla-red/80 to-tesla-red rounded-full transition-all"
            style={{ width: `${percentage}%` }}
          />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label={label}
            title={`${label}: ${value}${unit}`}
          />
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg border-2 border-tesla-red transition-all pointer-events-none"
            style={{ left: `calc(${percentage}% - 8px)` }}
          />
        </div>
        {showInput && (
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value) || min)}
            className="w-16 px-2 py-1.5 bg-tesla-black/50 border border-tesla-dark/40 rounded-lg text-sm text-tesla-light text-center focus:outline-none focus:ring-2 focus:ring-tesla-red/40 transition-all"
            aria-label={`${label} value`}
            title={label}
          />
        )}
      </div>
      {hint && <p className="text-xs text-tesla-dark">{hint}</p>}
    </div>
  );
};

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

const NumberInput = ({ label, value, onChange, min, max, step = 1, unit }: NumberInputProps) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-tesla-gray">{label}</label>
    <div className="relative">
      <input
        type="number"
        value={Math.round(value * 100) / 100}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step}
        className="w-full px-3 py-2.5 bg-tesla-black/50 border border-tesla-dark/40 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/40 focus:border-tesla-red/40 transition-all pr-8"
        aria-label={label}
        title={label}
        placeholder="0"
      />
      {unit && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-tesla-dark">{unit}</span>
      )}
    </div>
  </div>
);

interface SelectInputProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

const SelectInput = ({ label, value, options, onChange }: SelectInputProps) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-tesla-gray">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2.5 bg-tesla-black/50 border border-tesla-dark/40 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/40 focus:border-tesla-red/40 transition-all appearance-none cursor-pointer"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.25rem' }}
      aria-label={label}
      title={label}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

interface ToggleButtonGroupProps {
  label: string;
  value: string;
  options: { value: string; label: string; icon?: ReactNode }[];
  onChange: (value: string) => void;
}

const ToggleButtonGroup = ({ label, value, options, onChange }: ToggleButtonGroupProps) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-tesla-gray">{label}</label>
    <div className="flex gap-1 p-1 bg-tesla-black/40 rounded-lg">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-all ${
            value === opt.value 
              ? 'bg-tesla-red text-white shadow-sm' 
              : 'text-tesla-gray hover:text-tesla-light hover:bg-tesla-dark/30'
          }`}
        >
          {opt.icon || opt.label}
        </button>
      ))}
    </div>
  </div>
);

// ============================================================================
// FILL SETTINGS PANEL
// ============================================================================

const FillSettingsPanel = () => {
  const { brushSettings, setBrushSettings } = useEditorStore();
  
  return (
    <CollapsibleSection title="Fill Settings" icon={<Droplet className="w-4 h-4" />}>
      <ColorPicker
        label="Fill Color"
        value={brushSettings.color}
        onChange={(color) => setBrushSettings({ color })}
      />
    </CollapsibleSection>
  );
};

// ============================================================================
// BRUSH SETTINGS PANEL
// ============================================================================

const BrushSettingsPanel = () => {
  const { activeTool, brushSettings, setBrushSettings } = useEditorStore();
  
  return (
    <CollapsibleSection title="Brush Settings" icon={<Paintbrush className="w-4 h-4" />}>
      {/* Brush Preview */}
      <div className="flex items-center justify-center bg-gradient-to-br from-tesla-dark/30 to-tesla-black/30 rounded-xl p-6 h-24 relative overflow-hidden border border-tesla-dark/20">
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `linear-gradient(45deg, #D7DCDD 25%, transparent 25%), linear-gradient(-45deg, #D7DCDD 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #D7DCDD 75%), linear-gradient(-45deg, transparent 75%, #D7DCDD 75%)`,
            backgroundSize: '8px 8px',
            backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
          }}
        />
        <div
          className="rounded-full transition-all relative z-10"
          style={{
            width: Math.min(brushSettings.size / 3, 80),
            height: Math.min(brushSettings.size / 3, 80),
            backgroundColor: brushSettings.color,
            opacity: brushSettings.opacity / 100,
            boxShadow: brushSettings.hardness < 100 
              ? `0 0 ${(100 - brushSettings.hardness) / 2}px ${brushSettings.color}`
              : 'none',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        />
      </div>

      <SliderControl
        label="Size"
        value={brushSettings.size}
        min={1}
        max={500}
        unit="px"
        onChange={(size) => setBrushSettings({ size })}
        showInput
      />

      {activeTool === 'brush' && (
        <ColorPicker
          label="Color"
          value={brushSettings.color}
          onChange={(color) => setBrushSettings({ color })}
        />
      )}

      <SliderControl
        label="Hardness"
        value={brushSettings.hardness}
        min={0}
        max={100}
        unit="%"
        onChange={(hardness) => setBrushSettings({ hardness })}
      />

      <SliderControl
        label="Opacity"
        value={brushSettings.opacity}
        min={1}
        max={100}
        unit="%"
        onChange={(opacity) => setBrushSettings({ opacity })}
      />

      <SliderControl
        label="Flow"
        value={brushSettings.flow}
        min={1}
        max={100}
        unit="%"
        onChange={(flow) => setBrushSettings({ flow })}
      />

      <SliderControl
        label="Spacing"
        value={brushSettings.spacing || 25}
        min={1}
        max={200}
        unit="%"
        onChange={(spacing) => setBrushSettings({ spacing })}
        hint="Controls brush stamp spacing along stroke"
      />

      <SliderControl
        label="Smoothing"
        value={brushSettings.smoothing || 0}
        min={0}
        max={100}
        unit="%"
        onChange={(smoothing) => setBrushSettings({ smoothing })}
        hint="Reduces jitter for smoother strokes"
      />

      {activeTool === 'brush' && (
        <SelectInput
          label="Blend Mode"
          value={brushSettings.blendMode}
          options={[
            { value: 'normal', label: 'Normal' },
            { value: 'multiply', label: 'Multiply' },
            { value: 'screen', label: 'Screen' },
            { value: 'overlay', label: 'Overlay' },
          ]}
          onChange={(blendMode) => setBrushSettings({ blendMode: blendMode as any })}
        />
      )}
    </CollapsibleSection>
  );
};

// ============================================================================
// TRANSFORM SECTION
// ============================================================================

interface TransformSectionProps {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  onUpdate: (key: string, value: any) => void;
}

const TransformSection = ({ x, y, rotation, scaleX, scaleY, opacity, onUpdate }: TransformSectionProps) => (
  <CollapsibleSection title="Transform" icon={<Move className="w-4 h-4" />}>
    {/* Position */}
    <div className="grid grid-cols-2 gap-3">
      <NumberInput label="X Position" value={x} onChange={(v) => onUpdate('x', v)} unit="px" />
      <NumberInput label="Y Position" value={y} onChange={(v) => onUpdate('y', v)} unit="px" />
    </div>

    {/* Size/Scale */}
    <div className="grid grid-cols-2 gap-3">
      <NumberInput label="Scale X" value={scaleX} onChange={(v) => onUpdate('scaleX', v)} step={0.1} />
      <NumberInput label="Scale Y" value={scaleY} onChange={(v) => onUpdate('scaleY', v)} step={0.1} />
    </div>

    {/* Rotation */}
    <div className="flex items-end gap-3">
      <div className="flex-1">
        <NumberInput label="Rotation" value={rotation} onChange={(v) => onUpdate('rotation', v)} unit="°" />
      </div>
      <div className="flex gap-1 pb-0.5">
        {[-90, -45, 0, 45, 90].map((angle) => (
          <button
            key={angle}
            onClick={() => onUpdate('rotation', angle)}
            className={`w-8 h-8 text-xs font-medium rounded-lg transition-all ${
              Math.round(rotation) === angle
                ? 'bg-tesla-red text-white'
                : 'bg-tesla-dark/40 text-tesla-gray hover:bg-tesla-dark/60 hover:text-tesla-light'
            }`}
          >
            {angle}°
          </button>
        ))}
      </div>
    </div>

    {/* Opacity */}
    <SliderControl
      label="Opacity"
      value={Math.round(opacity * 100)}
      min={0}
      max={100}
      unit="%"
      onChange={(v) => onUpdate('opacity', v / 100)}
    />
  </CollapsibleSection>
);

// ============================================================================
// MAIN PROPERTIES PANEL
// ============================================================================

export const PropertiesPanel = () => {
  const { layers, selectedLayerId, updateLayer, activeTool } = useEditorStore();
  
  useEffect(() => {
    loadGoogleFonts();
  }, []);

  const selectedLayer = layers.find((l) => l.id === selectedLayerId);
  const showBrushSettings = activeTool === 'brush';
  const showFillSettings = activeTool === 'fill';

  // No layer selected state
  if (!selectedLayer) {
    return (
      <div className="h-full panel rounded-xl flex flex-col w-80 overflow-hidden shadow-lg">
        <div className="p-4 border-b border-tesla-dark/30">
          <h2 className="text-lg font-semibold text-tesla-light flex items-center gap-2">
            <Layers className="w-5 h-5 text-tesla-gray" />
            Properties
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin space-y-4">
          {showFillSettings ? (
            <FillSettingsPanel />
          ) : showBrushSettings ? (
            <BrushSettingsPanel />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 rounded-2xl bg-tesla-dark/20 flex items-center justify-center mb-4">
                <Layers className="w-10 h-10 text-tesla-dark/60" />
              </div>
              <p className="text-sm text-tesla-gray mb-1">No layer selected</p>
              <p className="text-xs text-tesla-dark">Select a layer to edit its properties</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const updateProperty = (key: string, value: any) => {
    updateLayer(selectedLayer.id, { [key]: value });
  };

  // Get layer type icon
  const getLayerIcon = () => {
    switch (selectedLayer.type) {
      case 'text': return <Type className="w-5 h-5" />;
      case 'rect': return <Square className="w-5 h-5" />;
      case 'circle': return <Circle className="w-5 h-5" />;
      case 'image': return <Image className="w-5 h-5" />;
      case 'line': return <Minus className="w-5 h-5" />;
      case 'star': return <Star className="w-5 h-5" />;
      case 'brush': return <Paintbrush className="w-5 h-5" />;
      case 'fill': return <Droplet className="w-5 h-5" />;
      default: return <Layers className="w-5 h-5" />;
    }
  };

  return (
    <div className="h-full panel rounded-xl flex flex-col w-80 overflow-hidden shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-tesla-dark/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-tesla-red/10 flex items-center justify-center text-tesla-red">
            {getLayerIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-tesla-light truncate">{selectedLayer.name}</h2>
            <p className="text-xs text-tesla-gray capitalize">{selectedLayer.type} Layer</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {/* Tool Settings (when brush/fill tool active) */}
        {showFillSettings && <FillSettingsPanel />}
        {showBrushSettings && <BrushSettingsPanel />}

        {/* Fill Layer - Simple view */}
        {selectedLayer.type === 'fill' ? (
          <CollapsibleSection title="Fill" icon={<Droplet className="w-4 h-4" />}>
            <ColorPicker
              label="Fill Color"
              value={selectedLayer.fill}
              onChange={(v) => updateProperty('fill', v)}
            />
          </CollapsibleSection>
        ) : (
          <>
            {/* Text Properties - shown FIRST for text layers */}
            {selectedLayer.type === 'text' && (
              <CollapsibleSection title="Text" icon={<Type className="w-4 h-4" />}>
                {/* Text Content */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-tesla-gray">Content</label>
                  <textarea
                    value={selectedLayer.text}
                    onChange={(e) => updateProperty('text', e.target.value)}
                    className="w-full px-3 py-2.5 bg-tesla-black/50 border border-tesla-dark/40 rounded-lg text-sm text-tesla-light placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-tesla-red/40 focus:border-tesla-red/40 transition-all resize-none"
                    rows={3}
                    aria-label="Text content"
                    placeholder="Enter your text..."
                  />
                </div>

                {/* Font Family with Preview */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-tesla-gray">Font Family</label>
                  <select
                    value={selectedLayer.fontFamily}
                    onChange={(e) => updateProperty('fontFamily', e.target.value)}
                    className="w-full px-3 py-2.5 bg-tesla-black/50 border border-tesla-dark/40 rounded-lg text-sm text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red/40 transition-all"
                    style={{ fontFamily: selectedLayer.fontFamily }}
                    aria-label="Font family"
                    title="Font family"
                  >
                    {Object.entries(fontCategories).map(([category, fonts]) => (
                      <optgroup key={category} label={category}>
                        {fonts.map((font) => (
                          <option key={font} value={font} style={{ fontFamily: font }}>
                            {font}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <div 
                    className="p-3 bg-tesla-dark/20 rounded-lg text-center border border-tesla-dark/20"
                    style={{ fontFamily: selectedLayer.fontFamily, fontSize: '16px' }}
                  >
                    <span className="text-tesla-light">The quick brown fox</span>
                  </div>
                </div>

                {/* Font Size */}
                <SliderControl
                  label="Font Size"
                  value={selectedLayer.fontSize}
                  min={8}
                  max={200}
                  unit="px"
                  onChange={(v) => updateProperty('fontSize', v)}
                  showInput
                />

                {/* Text Color */}
                <ColorPicker
                  label="Text Color"
                  value={selectedLayer.fill}
                  onChange={(v) => updateProperty('fill', v)}
                />

                {/* Alignment */}
                <div className="grid grid-cols-2 gap-3">
                  <ToggleButtonGroup
                    label="Horizontal"
                    value={selectedLayer.align}
                    options={[
                      { value: 'left', label: 'L' },
                      { value: 'center', label: 'C' },
                      { value: 'right', label: 'R' },
                    ]}
                    onChange={(v) => updateProperty('align', v)}
                  />
                  <ToggleButtonGroup
                    label="Vertical"
                    value={selectedLayer.verticalAlign}
                    options={[
                      { value: 'top', label: 'T' },
                      { value: 'middle', label: 'M' },
                      { value: 'bottom', label: 'B' },
                    ]}
                    onChange={(v) => updateProperty('verticalAlign', v)}
                  />
                </div>

                {/* Style */}
                <div className="grid grid-cols-2 gap-3">
                  <SelectInput
                    label="Style"
                    value={selectedLayer.fontStyle}
                    options={[
                      { value: 'normal', label: 'Normal' },
                      { value: 'italic', label: 'Italic' },
                      { value: 'bold', label: 'Bold' },
                      { value: 'bold italic', label: 'Bold Italic' },
                    ]}
                    onChange={(v) => updateProperty('fontStyle', v)}
                  />
                  <SelectInput
                    label="Decoration"
                    value={selectedLayer.textDecoration}
                    options={[
                      { value: 'none', label: 'None' },
                      { value: 'underline', label: 'Underline' },
                      { value: 'line-through', label: 'Strikethrough' },
                    ]}
                    onChange={(v) => updateProperty('textDecoration', v)}
                  />
                </div>
              </CollapsibleSection>
            )}

            {/* Rectangle Properties */}
            {selectedLayer.type === 'rect' && (
              <CollapsibleSection title="Rectangle" icon={<Square className="w-4 h-4" />}>
                <div className="grid grid-cols-2 gap-3">
                  <NumberInput label="Width" value={selectedLayer.width} onChange={(v) => updateProperty('width', v)} unit="px" />
                  <NumberInput label="Height" value={selectedLayer.height} onChange={(v) => updateProperty('height', v)} unit="px" />
                </div>

                <ColorPicker label="Fill" value={selectedLayer.fill} onChange={(v) => updateProperty('fill', v)} />
                
                <ColorPicker label="Stroke" value={selectedLayer.stroke || '#000000'} onChange={(v) => updateProperty('stroke', v)} />

                <div className="grid grid-cols-2 gap-3">
                  <NumberInput label="Stroke Width" value={selectedLayer.strokeWidth || 0} onChange={(v) => updateProperty('strokeWidth', v)} unit="px" />
                  <NumberInput label="Corner Radius" value={selectedLayer.cornerRadius || 0} onChange={(v) => updateProperty('cornerRadius', v)} unit="px" />
                </div>
              </CollapsibleSection>
            )}

            {/* Circle Properties */}
            {selectedLayer.type === 'circle' && (
              <CollapsibleSection title="Circle" icon={<Circle className="w-4 h-4" />}>
                <NumberInput label="Radius" value={selectedLayer.radius} onChange={(v) => updateProperty('radius', v)} unit="px" />
                
                <ColorPicker label="Fill" value={selectedLayer.fill} onChange={(v) => updateProperty('fill', v)} />
                
                <ColorPicker label="Stroke" value={selectedLayer.stroke || '#000000'} onChange={(v) => updateProperty('stroke', v)} />

                <NumberInput label="Stroke Width" value={selectedLayer.strokeWidth || 0} onChange={(v) => updateProperty('strokeWidth', v)} unit="px" />
              </CollapsibleSection>
            )}

            {/* Image Properties */}
            {selectedLayer.type === 'image' && (
              <CollapsibleSection title="Image" icon={<Image className="w-4 h-4" />}>
                <div className="space-y-3">
                  <div className="p-3 bg-tesla-dark/20 rounded-lg border border-tesla-dark/20">
                    <div className="text-xs text-tesla-gray mb-1">File</div>
                    <div className="text-sm text-tesla-light truncate">{selectedLayer.name}</div>
                  </div>
                  
                  {selectedLayer.image && (
                    <div className="p-3 bg-tesla-dark/20 rounded-lg border border-tesla-dark/20">
                      <div className="text-xs text-tesla-gray mb-1">Dimensions</div>
                      <div className="text-sm text-tesla-light">
                        {selectedLayer.image.width} × {selectedLayer.image.height}px
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <label className="flex items-center gap-3 cursor-pointer p-3 bg-tesla-dark/20 rounded-lg border border-tesla-dark/20 hover:border-tesla-dark/40 transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedLayer.useTemplateMask || false}
                        onChange={(e) => updateProperty('useTemplateMask', e.target.checked)}
                        className="w-4 h-4 rounded border-tesla-dark/50 bg-tesla-black/60 text-tesla-red focus:ring-tesla-red/50 focus:ring-offset-0"
                      />
                      <div className="flex-1">
                        <span className="text-sm text-tesla-light block">Use Template Mask</span>
                        <span className="text-xs text-tesla-dark">Clip image to vehicle shape</span>
                      </div>
                    </label>
                  </div>

                  {selectedLayer.useTemplateMask && (
                    <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                      <p className="text-xs text-yellow-400">
                        💡 Transform handles disabled. Use position/scale controls to adjust.
                      </p>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            )}

            {/* Line Properties */}
            {selectedLayer.type === 'line' && (
              <CollapsibleSection title="Line" icon={<Minus className="w-4 h-4" />}>
                <ColorPicker label="Stroke Color" value={selectedLayer.stroke} onChange={(v) => updateProperty('stroke', v)} />
                
                <SliderControl
                  label="Stroke Width"
                  value={selectedLayer.strokeWidth}
                  min={1}
                  max={100}
                  unit="px"
                  onChange={(v) => updateProperty('strokeWidth', v)}
                  showInput
                />

                <div className="grid grid-cols-2 gap-3">
                  <SelectInput
                    label="Line Cap"
                    value={selectedLayer.lineCap || 'round'}
                    options={[
                      { value: 'butt', label: 'Butt' },
                      { value: 'round', label: 'Round' },
                      { value: 'square', label: 'Square' },
                    ]}
                    onChange={(v) => updateProperty('lineCap', v)}
                  />
                  <SelectInput
                    label="Line Join"
                    value={selectedLayer.lineJoin || 'round'}
                    options={[
                      { value: 'miter', label: 'Miter' },
                      { value: 'round', label: 'Round' },
                      { value: 'bevel', label: 'Bevel' },
                    ]}
                    onChange={(v) => updateProperty('lineJoin', v)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-tesla-gray">Arrows</label>
                  <div className="flex gap-2">
                    <label className="flex-1 flex items-center gap-2 cursor-pointer p-3 bg-tesla-dark/20 rounded-lg border border-tesla-dark/20 hover:border-tesla-dark/40 transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedLayer.arrowStart || false}
                        onChange={(e) => updateProperty('arrowStart', e.target.checked)}
                        className="w-4 h-4 rounded border-tesla-dark/50 bg-tesla-black/60 text-tesla-red focus:ring-tesla-red/50"
                      />
                      <span className="text-xs text-tesla-light">Start</span>
                    </label>
                    <label className="flex-1 flex items-center gap-2 cursor-pointer p-3 bg-tesla-dark/20 rounded-lg border border-tesla-dark/20 hover:border-tesla-dark/40 transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedLayer.arrowEnd || false}
                        onChange={(e) => updateProperty('arrowEnd', e.target.checked)}
                        className="w-4 h-4 rounded border-tesla-dark/50 bg-tesla-black/60 text-tesla-red focus:ring-tesla-red/50"
                      />
                      <span className="text-xs text-tesla-light">End</span>
                    </label>
                  </div>
                </div>
              </CollapsibleSection>
            )}

            {/* Star Properties */}
            {selectedLayer.type === 'star' && (
              <CollapsibleSection title="Star" icon={<Star className="w-4 h-4" />}>
                <SliderControl
                  label="Points"
                  value={selectedLayer.numPoints}
                  min={3}
                  max={50}
                  onChange={(v) => updateProperty('numPoints', Math.round(v))}
                  showInput
                />

                <div className="grid grid-cols-2 gap-3">
                  <NumberInput label="Inner Radius" value={selectedLayer.innerRadius} onChange={(v) => updateProperty('innerRadius', v)} unit="px" />
                  <NumberInput label="Outer Radius" value={selectedLayer.outerRadius} onChange={(v) => updateProperty('outerRadius', v)} unit="px" />
                </div>

                <ColorPicker label="Fill" value={selectedLayer.fill} onChange={(v) => updateProperty('fill', v)} />
                
                <ColorPicker label="Stroke" value={selectedLayer.stroke || '#000000'} onChange={(v) => updateProperty('stroke', v)} />

                <NumberInput label="Stroke Width" value={selectedLayer.strokeWidth || 0} onChange={(v) => updateProperty('strokeWidth', v)} unit="px" />
              </CollapsibleSection>
            )}

            {/* Brush Layer Properties */}
            {selectedLayer.type === 'brush' && (
              <CollapsibleSection title="Brush Layer" icon={<Paintbrush className="w-4 h-4" />}>
                <div className="p-3 bg-tesla-dark/20 rounded-lg border border-tesla-dark/20">
                  <div className="text-xs text-tesla-gray mb-1">Strokes</div>
                  <div className="text-sm text-tesla-light">
                    {(selectedLayer as any).strokes?.length || 0} stroke(s)
                  </div>
                </div>
                <button
                  onClick={() => updateProperty('strokes', [])}
                  className="w-full px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-all"
                >
                  Clear All Strokes
                </button>
              </CollapsibleSection>
            )}

            {/* Transform Section - Always last */}
            <TransformSection
              x={selectedLayer.x}
              y={selectedLayer.y}
              rotation={selectedLayer.rotation}
              scaleX={selectedLayer.scaleX}
              scaleY={selectedLayer.scaleY}
              opacity={selectedLayer.opacity}
              onUpdate={updateProperty}
            />
          </>
        )}
      </div>
    </div>
  );
};
