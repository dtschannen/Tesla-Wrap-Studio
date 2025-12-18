import { useEffect } from 'react';
import type { Stage as StageType } from 'konva/lib/Stage';
import { useEditorStore } from '../state/useEditorStore';

interface FillToolProps {
  stageRef: React.RefObject<StageType | null>;
}

// Flood fill algorithm to find connected pixels
// Uses alpha-based filling to properly fill template regions including anti-aliased edges
const floodFill = (
  imageData: ImageData,
  startX: number,
  startY: number,
  width: number,
  height: number
): Set<number> => {
  const filledPixels = new Set<number>();
  const visited = new Set<number>();
  const stack: Array<[number, number]> = [[startX, startY]];
  
  // Very low threshold to include ALL pixels that are part of the template
  // This ensures anti-aliased edge pixels are included (they have partial alpha)
  const alphaThreshold = 1; // Include pixels with even tiny alpha
  
  const getPixelIndex = (x: number, y: number) => (y * width + x) * 4;
  
  const hasAlpha = (x: number, y: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const idx = getPixelIndex(x, y);
    return imageData.data[idx + 3] >= alphaThreshold;
  };
  
  // Check if start position is valid (has alpha)
  if (!hasAlpha(startX, startY)) return filledPixels;
  
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    const pixelIdx = getPixelIndex(x, y);
    
    // Skip if already visited
    if (visited.has(pixelIdx)) continue;
    visited.add(pixelIdx);
    
    // Check if this pixel has alpha (is part of template)
    if (!hasAlpha(x, y)) continue;
    
    // Add to filled pixels
    filledPixels.add(pixelIdx);
    
    // Add 4-connected neighbors (cardinal directions only for cleaner region detection)
    if (x > 0) stack.push([x - 1, y]);
    if (x < width - 1) stack.push([x + 1, y]);
    if (y > 0) stack.push([x, y - 1]);
    if (y < height - 1) stack.push([x, y + 1]);
  }
  
  return filledPixels;
};

// Convert filled pixels to a data URL image with the fill color
const createFillImage = (
  filledPixels: Set<number>,
  fillColorHex: string,
  width: number,
  height: number
): string => {
  // Create offscreen canvas
  const offCanvas = document.createElement('canvas');
  offCanvas.width = width;
  offCanvas.height = height;
  const ctx = offCanvas.getContext('2d');
  if (!ctx) return '';
  
  // Parse fill color
  const fillColorMatch = fillColorHex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  const r = fillColorMatch ? parseInt(fillColorMatch[1], 16) : 0;
  const g = fillColorMatch ? parseInt(fillColorMatch[2], 16) : 0;
  const b = fillColorMatch ? parseInt(fillColorMatch[3], 16) : 0;
  
  // Create image data
  const imageData = ctx.createImageData(width, height);
  
  // Fill the pixels
  filledPixels.forEach((pixelIdx) => {
    imageData.data[pixelIdx] = r;
    imageData.data[pixelIdx + 1] = g;
    imageData.data[pixelIdx + 2] = b;
    imageData.data[pixelIdx + 3] = 255; // Full opacity
  });
  
  ctx.putImageData(imageData, 0, 0);
  return offCanvas.toDataURL('image/png');
};

export const FillTool = ({ stageRef }: FillToolProps) => {
  const { activeTool, templateImage, addLayer, brushSettings } = useEditorStore();
  
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || activeTool !== 'fill' || !templateImage) return;
    
    const handleClick = async () => {
      // Get the pointer position relative to the stage
      const pos = stage.getPointerPosition();
      if (!pos) return;
      
      // Get click position in canvas coordinates (0-1024)
      const x = Math.floor(pos.x);
      const y = Math.floor(pos.y);
      
      // Create a temporary canvas to read pixel data from template
      const canvas = document.createElement('canvas');
      canvas.width = templateImage.width;
      canvas.height = templateImage.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Draw template image to canvas
      ctx.drawImage(templateImage, 0, 0);
      
      // Get pixel data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Get the alpha at click position to check if it's part of template
      const pixelIdx = (y * canvas.width + x) * 4;
      const clickedAlpha = imageData.data[pixelIdx + 3];
      
      // If clicking on transparent area (outside template), don't fill
      if (clickedAlpha < 1) return;
      
      // Get fill color from brush settings
      const fillColorHex = brushSettings.color;
      
      // Perform flood fill - finds all connected pixels with alpha
      const filledPixels = floodFill(
        imageData,
        x,
        y,
        canvas.width,
        canvas.height
      );
      
      if (filledPixels.size === 0) return;
      
      // Calculate bounding box for path
      let minX = canvas.width;
      let minY = canvas.height;
      let maxX = 0;
      let maxY = 0;
      
      filledPixels.forEach((pixelIdx) => {
        const px = (pixelIdx / 4) % canvas.width;
        const py = Math.floor((pixelIdx / 4) / canvas.width);
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      });
      
      const bboxWidth = maxX - minX + 1;
      const bboxHeight = maxY - minY + 1;
      const path = [minX, minY, bboxWidth, bboxHeight];
      
      // Create cropped image for bounding box only
      // Adjust pixel indices to be relative to bounding box
      const croppedPixelIndices: number[] = [];
      const getPixelIndex = (px: number, py: number, w: number) => (py * w + px) * 4;
      
      filledPixels.forEach((pixelIdx) => {
        const px = (pixelIdx / 4) % canvas.width;
        const py = Math.floor((pixelIdx / 4) / canvas.width);
        // Convert to bounding box relative coordinates
        const relX = px - minX;
        const relY = py - minY;
        const relIdx = getPixelIndex(relX, relY, bboxWidth);
        croppedPixelIndices.push(relIdx);
      });
      
      // Create cropped fill image (only bounding box area)
      const fillImageDataUrl = createFillImage(
        new Set(croppedPixelIndices),
        fillColorHex,
        bboxWidth,
        bboxHeight
      );
      if (!fillImageDataUrl) return;
      
      // Create fill layer
      const { layers } = useEditorStore.getState();
      let index = 1;
      while (layers.some((l) => l.name === `Fill ${index}`)) {
        index += 1;
      }
      
      addLayer({
        type: 'fill',
        name: `Fill ${index}`,
        fill: fillColorHex,
        path,
        fillImageDataUrl, // Store the cropped image data URL
        pixelMask: croppedPixelIndices, // Store pixel indices relative to bounding box
        maskWidth: bboxWidth,
        maskHeight: bboxHeight,
        visible: true,
        locked: false,
        opacity: 1,
        x: minX, // Position at bounding box origin
        y: minY,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      });
    };
    
    stage.on('click', handleClick);
    stage.on('tap', handleClick);
    
    // Change cursor
    const container = stage.container();
    if (container) {
      container.style.cursor = 'crosshair';
    }
    
    return () => {
      stage.off('click', handleClick);
      stage.off('tap', handleClick);
      
      if (container) {
        container.style.cursor = 'default';
      }
    };
  }, [stageRef, activeTool, templateImage, addLayer, brushSettings]);
  
  return null;
};
