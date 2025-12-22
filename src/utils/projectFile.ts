import JSZip from 'jszip';
import type { ProjectFile, SerializedLayer } from '../editor/state/useEditorStore';

const PROJECT_FILE_EXTENSION = '.twrap';

/**
 * Convert a base64 data URL to a Uint8Array
 */
const dataUrlToUint8Array = (dataUrl: string): Uint8Array => {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

/**
 * Convert a Uint8Array to a base64 data URL
 */
const uint8ArrayToDataUrl = (bytes: Uint8Array, mimeType: string = 'image/png'): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
};

/**
 * Extract image references from layers and prepare them for ZIP storage
 */
interface ImageReference {
  layerId: string;
  type: 'src' | 'fillImage';
  dataUrl: string;
  filename: string;
}

const extractImages = (layers: SerializedLayer[]): { 
  cleanedLayers: SerializedLayer[]; 
  images: ImageReference[] 
} => {
  const images: ImageReference[] = [];
  
  const cleanedLayers = layers.map(layer => {
    const cleanLayer = { ...layer };
    
    // Handle image/texture layers
    if ((layer.type === 'image' || layer.type === 'texture') && layer.src) {
      // Check if it's a data URL (embedded image)
      if (layer.src.startsWith('data:')) {
        const filename = `images/${layer.id}.png`;
        images.push({
          layerId: layer.id,
          type: 'src',
          dataUrl: layer.src,
          filename,
        });
        // Replace data URL with filename reference
        cleanLayer.src = filename;
      }
    }
    
    // Handle fill layers
    if (layer.type === 'fill' && layer.fillImageDataUrl) {
      if (layer.fillImageDataUrl.startsWith('data:')) {
        const filename = `images/fill-${layer.id}.png`;
        images.push({
          layerId: layer.id,
          type: 'fillImage',
          dataUrl: layer.fillImageDataUrl,
          filename,
        });
        cleanLayer.fillImageDataUrl = filename;
      }
    }
    
    return cleanLayer;
  });
  
  return { cleanedLayers, images };
};

/**
 * Restore image data URLs from ZIP file references
 */
const restoreImages = async (
  layers: SerializedLayer[], 
  zip: JSZip
): Promise<SerializedLayer[]> => {
  return Promise.all(layers.map(async (layer) => {
    const restoredLayer = { ...layer };
    
    // Restore image/texture layer sources
    if ((layer.type === 'image' || layer.type === 'texture') && layer.src) {
      if (layer.src.startsWith('images/')) {
        const file = zip.file(layer.src);
        if (file) {
          const bytes = await file.async('uint8array');
          restoredLayer.src = uint8ArrayToDataUrl(bytes);
        }
      }
    }
    
    // Restore fill layer images
    if (layer.type === 'fill' && layer.fillImageDataUrl) {
      if (layer.fillImageDataUrl.startsWith('images/')) {
        const file = zip.file(layer.fillImageDataUrl);
        if (file) {
          const bytes = await file.async('uint8array');
          restoredLayer.fillImageDataUrl = uint8ArrayToDataUrl(bytes);
        }
      }
    }
    
    return restoredLayer;
  }));
};

/**
 * Project manifest stored in the ZIP
 */
interface ProjectManifest {
  version: string;
  name: string;
  createdAt: string;
  modifiedAt: string;
  modelId: string;
  baseColor: string;
  layers: SerializedLayer[];
}

/**
 * Save a project to a ZIP-based .twrap file
 */
export const saveProjectToFile = async (project: ProjectFile): Promise<void> => {
  const zip = new JSZip();
  
  // Extract images from layers
  const { cleanedLayers, images } = extractImages(project.layers);
  
  // Create manifest (project data without embedded images)
  const manifest: ProjectManifest = {
    version: '2.0', // New version for ZIP format
    name: project.name,
    createdAt: project.createdAt,
    modifiedAt: new Date().toISOString(),
    modelId: project.modelId,
    baseColor: project.baseColor,
    layers: cleanedLayers,
  };
  
  // Add manifest to ZIP
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  
  // Add images folder and files
  if (images.length > 0) {
    const imagesFolder = zip.folder('images');
    if (imagesFolder) {
      for (const img of images) {
        const bytes = dataUrlToUint8Array(img.dataUrl);
        // Get just the filename from the path
        const filename = img.filename.replace('images/', '');
        imagesFolder.file(filename, bytes);
      }
    }
  }
  
  // Generate ZIP blob
  const blob = await zip.generateAsync({ 
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
  
  // Create filename from project name
  const sanitizedName = project.name
    .replace(/[^a-zA-Z0-9\s-_]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase();
  const filename = `${sanitizedName}${PROJECT_FILE_EXTENSION}`;
  
  // Create download link
  const link = document.createElement('a');
  link.download = filename;
  link.href = URL.createObjectURL(blob);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

/**
 * Load a project from a .twrap file (supports both ZIP and legacy JSON formats)
 * Accepts both File and Blob objects for flexibility
 */
export const loadProjectFromFile = async (file: File | Blob): Promise<ProjectFile> => {
  // Only validate filename if it's a File with a name property
  const fileName = file instanceof File ? file.name : '';
  if (fileName && !fileName.endsWith(PROJECT_FILE_EXTENSION) && !fileName.endsWith('.json')) {
    throw new Error(`Invalid file type. Expected ${PROJECT_FILE_EXTENSION} or .json file.`);
  }
  
  const arrayBuffer = await file.arrayBuffer();
  
  // Try to load as ZIP first
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    // Check if it's a valid ZIP with manifest
    const manifestFile = zip.file('manifest.json');
    if (manifestFile) {
      const manifestJson = await manifestFile.async('string');
      const manifest: ProjectManifest = JSON.parse(manifestJson);
      
      // Validate manifest
      if (!manifest.version || !manifest.layers || !manifest.modelId) {
        console.error('Invalid project manifest:', manifest);
        throw new Error('Invalid project manifest: missing required fields (version, layers, or modelId).');
      }
      
      // Restore images from ZIP
      const restoredLayers = await restoreImages(manifest.layers, zip);
      
      return {
        version: manifest.version,
        name: manifest.name,
        createdAt: manifest.createdAt,
        modifiedAt: manifest.modifiedAt,
        modelId: manifest.modelId,
        baseColor: manifest.baseColor,
        layers: restoredLayers,
      };
    }
  } catch {
    // Not a valid ZIP, try legacy JSON format
  }
  
  // Fall back to legacy JSON format (v1.0)
  try {
    const text = new TextDecoder().decode(arrayBuffer);
    const project = JSON.parse(text) as ProjectFile;
    
    // Validate legacy project structure
    if (!project.version || !project.layers || !project.modelId) {
      console.error('Invalid legacy project structure:', project);
      throw new Error('Invalid project file format: missing required fields (version, layers, or modelId).');
    }
    
    return project;
  } catch (jsonError: any) {
    console.error('Failed to parse project file:', jsonError);
    throw new Error(`Failed to parse project file. The file may be corrupted or in an unsupported format. Error: ${jsonError.message}`);
  }
};

/**
 * Get the file accept string for project files
 */
export const getProjectFileAccept = (): string => {
  return `${PROJECT_FILE_EXTENSION},.json`;
};
