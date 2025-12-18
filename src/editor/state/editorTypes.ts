export type LayerType = 'background' | 'text' | 'image' | 'rect' | 'circle' | 'texture' | 'brush' | 'line' | 'star' | 'fill';

// Tool types for Photoshop-like instrument system
export type ToolType = 'select' | 'brush' | 'eraser' | 'text' | 'rectangle' | 'circle' | 'line' | 'star' | 'image' | 'texture' | 'fill';

// Individual brush stroke with its own settings (captured at time of drawing)
export interface BrushStroke {
  points: number[];      // [x1, y1, x2, y2, ...]
  color: string;
  size: number;
  hardness: number;      // 0-100, affects edge softness
  opacity: number;       // 0-1, stroke opacity
  flow: number;          // 0-100, paint flow rate
  blendMode: 'normal' | 'multiply' | 'screen' | 'overlay';
}

// Global brush settings (the current tool settings)
export interface BrushSettings {
  size: number;          // 1-500 px
  color: string;
  hardness: number;      // 0-100%
  opacity: number;       // 0-100%
  flow: number;          // 0-100%
  spacing: number;       // 1-200% (brush spacing)
  smoothing: number;    // 0-100% (stroke smoothing)
  blendMode: 'normal' | 'multiply' | 'screen' | 'overlay';
}

export interface BaseLayer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;
  opacity: number;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface BackgroundLayer extends BaseLayer {
  type: 'background';
  fill: string;
}

export interface TextLayer extends BaseLayer {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  align: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  fontStyle: 'normal' | 'italic' | 'bold' | 'bold italic';
  textDecoration: 'none' | 'underline' | 'line-through';
}

export interface ImageLayer extends BaseLayer {
  type: 'image';
  src: string;
  image?: HTMLImageElement;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
}

export interface RectLayer extends BaseLayer {
  type: 'rect';
  width: number;
  height: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
}

export interface CircleLayer extends BaseLayer {
  type: 'circle';
  radius: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface TextureLayer extends BaseLayer {
  type: 'texture';
  src: string;
  image?: HTMLImageElement;
}

export interface BrushLayer extends BaseLayer {
  type: 'brush';
  strokes: BrushStroke[];  // Array of strokes with individual settings
}

export interface LineLayer extends BaseLayer {
  type: 'line';
  points: number[];
  stroke: string;
  strokeWidth: number;
  lineCap: 'butt' | 'round' | 'square';
  lineJoin: 'miter' | 'round' | 'bevel';
  dash?: number[];        // [dashLength, gapLength] for dashed lines
  arrowStart?: boolean;   // Arrow at start point
  arrowEnd?: boolean;     // Arrow at end point
}

export interface StarLayer extends BaseLayer {
  type: 'star';
  numPoints: number;
  innerRadius: number;
  outerRadius: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface FillLayer extends BaseLayer {
  type: 'fill';
  fill: string;
  path: number[]; // Bounding box: [x, y, width, height]
  fillImageDataUrl?: string; // Pre-rendered fill image as data URL
  fillImage?: HTMLImageElement; // Loaded image for rendering
  pixelMask?: number[]; // Pixel indices for color regeneration
  maskWidth?: number; // Width of the mask
  maskHeight?: number; // Height of the mask
}

export type Layer = BackgroundLayer | TextLayer | ImageLayer | RectLayer | CircleLayer | TextureLayer | BrushLayer | LineLayer | StarLayer | FillLayer;

export interface EditorState {
  layers: Layer[];
  selectedLayerId: string | null;
  baseColor: string;
  currentModelId: string;
  templateDimensions: { width: number; height: number } | null;
  templateImage: HTMLImageElement | null;
  // Tool system
  activeTool: ToolType;
  brushSettings: BrushSettings;
}

