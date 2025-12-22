import { supabase } from '../lib/supabase';
import type { ProjectFile, SerializedLayer } from '../editor/state/useEditorStore';
import { loadProjectFromFile } from './projectFile';
import JSZip from 'jszip';

export interface SavedDesign {
  id: string;
  title: string;
  description: string | null;
  model_id: string;
  preview_image_url: string;
  project_file_url: string;
  visibility: 'private' | 'public';
  published: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Save a project to Supabase Storage and database
 */
export const saveProjectToSupabase = async (
  project: ProjectFile,
  previewImageDataUrl: string,
  designId?: string, // If provided, update existing design
  options?: {
    description?: string | null;
    visibility?: 'public' | 'private';
  }
): Promise<SavedDesign> => {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  // Check authentication (with fallback refresh)
  let { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const refreshResult = await supabase.auth.refreshSession();
    if (!refreshResult.error && refreshResult.data.session) {
      session = refreshResult.data.session;
    }
  }
  if (!session) {
    throw new Error('You must be logged in to save projects');
  }

  // Convert project to ZIP blob
  const zip = new JSZip();
  
  // Extract images from layers
  const { cleanedLayers, images } = extractImages(project.layers);
  
  // Create manifest
  const manifest = {
    version: '2.0',
    name: project.name,
    createdAt: project.createdAt,
    modifiedAt: new Date().toISOString(),
    modelId: project.modelId,
    baseColor: project.baseColor,
    layers: cleanedLayers,
  };
  
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  
  // Add images
  if (images.length > 0) {
    const imagesFolder = zip.folder('images');
    if (imagesFolder) {
      for (const img of images) {
        const bytes = dataUrlToUint8Array(img.dataUrl);
        const filename = img.filename.replace('images/', '');
        imagesFolder.file(filename, bytes);
      }
    }
  }
  
  const zipBlob = await zip.generateAsync({ 
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  // Convert preview image to blob
  const previewBlob = await dataUrlToBlob(previewImageDataUrl);

  // Generate file paths - use designId if provided, otherwise generate new UUID
  const userId = session.user.id;
  const finalDesignId = designId || crypto.randomUUID();
  const projectFileName = `projects/${finalDesignId}.twrap`;
  const previewFileName = `preview/${finalDesignId}.png`;

  // Upload files to storage
  const [projectUploadResult, previewUploadResult] = await Promise.all([
    supabase.storage
      .from('designs')
      .upload(projectFileName, zipBlob, {
        cacheControl: '3600',
        upsert: true,
      }),
    supabase.storage
      .from('designs')
      .upload(previewFileName, previewBlob, {
        cacheControl: '3600',
        upsert: true,
      }),
  ]);

  if (projectUploadResult.error) throw projectUploadResult.error;
  if (previewUploadResult.error) throw previewUploadResult.error;

  // Get public URL for preview
  const { data: previewUrlData } = supabase.storage
    .from('designs')
    .getPublicUrl(previewFileName);

  // Save or update design in database
  const designData = {
    title: project.name,
    description: options?.description ?? null,
    model_id: project.modelId,
    preview_image_url: previewUrlData.publicUrl,
    project_file_url: projectFileName, // Store path, not full URL
    visibility: options?.visibility ?? 'private',
    published: true,
  };

  let savedDesign: SavedDesign;

  if (designId) {
    // Update existing design
    const { data, error } = await supabase
      .from('designs')
      .update(designData)
      .eq('id', designId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    savedDesign = data as SavedDesign;
  } else {
    // Create new design with the generated ID
    const { data, error } = await supabase
      .from('designs')
      .insert({
        id: finalDesignId,
        ...designData,
        user_id: userId,
      })
      .select()
      .single();

    if (error) throw error;
    savedDesign = data as SavedDesign;
  }

  return savedDesign;
};

/**
 * Load a project from Supabase by design ID
 */
export const loadProjectFromSupabase = async (designId: string): Promise<ProjectFile> => {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  // Check authentication (with fallback refresh)
  let { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const refreshResult = await supabase.auth.refreshSession();
    if (!refreshResult.error && refreshResult.data.session) {
      session = refreshResult.data.session;
    }
  }
  if (!session) {
    throw new Error('You must be logged in to load projects');
  }

  // Fetch design from database
  const { data: design, error: designError } = await supabase
    .from('designs')
    .select('*')
    .eq('id', designId)
    .single();

  if (designError) {
    console.error('Error fetching design from database:', designError);
    throw new Error(`Failed to load design: ${designError.message}`);
  }
  if (!design) {
    throw new Error(`Design not found with ID: ${designId}`);
  }

  // Verify user owns the design
  if (design.user_id !== session.user.id) {
    throw new Error('You do not have permission to load this design');
  }


  // Download project file from storage
  const { data: fileData, error: fileError } = await supabase.storage
    .from('designs')
    .download(design.project_file_url);

  if (fileError) {
    console.error('Error downloading project file:', fileError);
    throw new Error(`Failed to download project file: ${fileError.message}`);
  }
  if (!fileData) {
    throw new Error(`Project file not found at path: ${design.project_file_url}`);
  }

  // Convert Blob to File (Supabase Storage returns Blob, but loadProjectFromFile expects File)
  const fileName = design.project_file_url.split('/').pop() || `${designId}.twrap`;
  const file = new File([fileData], fileName, { type: 'application/zip' });

  // Load project from file
  const project = await loadProjectFromFile(file);
  return project;
};

/**
 * Get all designs for the current user
 */
export const getUserDesigns = async (): Promise<SavedDesign[]> => {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('You must be logged in');
  }

  const { data, error } = await supabase
    .from('designs')
    .select('*')
    .eq('user_id', session.user.id)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data || []) as SavedDesign[];
};

/**
 * Update design visibility
 */
export const updateDesignVisibility = async (
  designId: string,
  visibility: 'private' | 'public'
): Promise<void> => {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('You must be logged in');
  }

  const { error } = await supabase
    .from('designs')
    .update({ visibility })
    .eq('id', designId)
    .eq('user_id', session.user.id);

  if (error) throw error;
};

// Helper functions
interface ImageReference {
  layerId: string;
  type: 'src' | 'fillImage';
  dataUrl: string;
  filename: string;
}

const dataUrlToUint8Array = (dataUrl: string): Uint8Array => {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const response = await fetch(dataUrl);
  return await response.blob();
};

const extractImages = (layers: SerializedLayer[]): { cleanedLayers: SerializedLayer[]; images: ImageReference[] } => {
  const images: ImageReference[] = [];
  
  const cleanedLayers = layers.map(layer => {
    const cleanLayer = { ...layer };
    
    if ((layer.type === 'image' || layer.type === 'texture') && layer.src) {
      if (layer.src.startsWith('data:')) {
        const imageId = `img_${layer.id}_${Date.now()}.png`;
        images.push({
          layerId: layer.id,
          type: 'src',
          dataUrl: layer.src,
          filename: `images/${imageId}`,
        });
        cleanLayer.src = `images/${imageId}`;
      }
    }
    
    if (layer.type === 'fill' && layer.fillImageDataUrl) {
      const imageId = `fill_${layer.id}_${Date.now()}.png`;
      images.push({
        layerId: layer.id,
        type: 'fillImage',
        dataUrl: layer.fillImageDataUrl,
        filename: `images/${imageId}`,
      });
      cleanLayer.fillImageDataUrl = `images/${imageId}`;
    }
    
    return cleanLayer;
  });
  
  return { cleanedLayers, images };
};



