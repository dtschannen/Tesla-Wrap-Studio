import { supabase } from '../lib/supabase'
import type { Stage } from 'konva/lib/Stage'
import type { ProjectFile } from '../editor/state/useEditorStore'
import JSZip from 'jszip'

/**
 * Export PNG from stage and return as data URL
 */
export function exportPngAsDataUrl(stage: Stage | null): Promise<string | null> {
  return new Promise((resolve) => {
    if (!stage) {
      resolve(null)
      return
    }

    // Find and temporarily hide UI elements that shouldn't be exported
    const transformer = stage.findOne('Transformer')
    
    // Store original visibility states
    const elementsToHide: Array<{ node: any; wasVisible: boolean }> = []
    
    // Hide transformer if it exists
    if (transformer) {
      elementsToHide.push({ node: transformer, wasVisible: transformer.visible() })
      transformer.visible(false)
    }
    
    // Hide brush cursor groups
    const allGroups = stage.find('Group')
    allGroups.forEach((node) => {
      const group = node as any
      if (group.listening() === false) {
        const children = group.getChildren()
        const hasCircles = children.some((child: any) => child.getClassName() === 'Circle')
        if (hasCircles && children.length >= 2) {
          elementsToHide.push({ node: group, wasVisible: group.visible() })
          group.visible(false)
        }
      }
    })
    
    // Force redraw to apply visibility changes
    stage.batchDraw()

    // Export as data URL
    const dataURL = stage.toDataURL({
      pixelRatio: 1,
      mimeType: 'image/png',
    })

    // Restore visibility of hidden elements
    elementsToHide.forEach(({ node, wasVisible }) => {
      node.visible(wasVisible)
    })
    
    // Force redraw to restore UI
    stage.batchDraw()

    resolve(dataURL)
  })
}

/**
 * Convert project to .twrap blob
 */
export async function projectToBlob(project: ProjectFile): Promise<Blob> {
  const zip = new JSZip()
  
  // Helper to convert data URL to Uint8Array
  const dataUrlToUint8Array = (dataUrl: string): Uint8Array => {
    const base64 = dataUrl.split(',')[1]
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }

  // Extract images from layers
  const images: Array<{ layerId: string; type: 'src' | 'fillImage'; dataUrl: string; filename: string }> = []
  
  const cleanedLayers = project.layers.map((layer) => {
    const cleanLayer = { ...layer }
    
    // Handle image/texture layers
    if ((layer.type === 'image' || layer.type === 'texture') && layer.src) {
      if (layer.src.startsWith('data:')) {
        const filename = `images/${layer.id}.png`
        images.push({
          layerId: layer.id,
          type: 'src',
          dataUrl: layer.src,
          filename,
        })
        cleanLayer.src = filename
      }
    }
    
    // Handle fill layers
    if (layer.type === 'fill' && layer.fillImageDataUrl) {
      if (layer.fillImageDataUrl.startsWith('data:')) {
        const filename = `images/fill-${layer.id}.png`
        images.push({
          layerId: layer.id,
          type: 'fillImage',
          dataUrl: layer.fillImageDataUrl,
          filename,
        })
        cleanLayer.fillImageDataUrl = filename
      }
    }
    
    return cleanLayer
  })

  // Create manifest
  const manifest = {
    version: '2.0',
    name: project.name,
    createdAt: project.createdAt,
    modifiedAt: new Date().toISOString(),
    modelId: project.modelId,
    baseColor: project.baseColor,
    layers: cleanedLayers,
  }
  
  // Add manifest to ZIP
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  
  // Add images folder and files
  if (images.length > 0) {
    const imagesFolder = zip.folder('images')
    if (imagesFolder) {
      for (const img of images) {
        const bytes = dataUrlToUint8Array(img.dataUrl)
        const filename = img.filename.replace('images/', '')
        imagesFolder.file(filename, bytes)
      }
    }
  }
  
  // Generate ZIP blob
  return await zip.generateAsync({ 
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  })
}

/**
 * Publish design to gallery
 */
export async function publishDesign(
  title: string,
  description: string | null,
  modelId: string,
  previewDataUrl: string,
  projectBlob: Blob,
  userId: string
): Promise<{ designId: string; error: any }> {
  if (!supabase) {
    return { designId: '', error: { message: 'Supabase not configured' } }
  }

  try {
    // Generate unique ID for design
    const designId = crypto.randomUUID()
    const previewPath = `preview/${designId}.png`
    const projectPath = `projects/${designId}.twrap`

    // Convert data URL to blob
    const response = await fetch(previewDataUrl)
    const previewBlob = await response.blob()

    // Upload preview image
    const { error: previewError } = await supabase.storage
      .from('designs')
      .upload(previewPath, previewBlob, {
        cacheControl: '3600',
        upsert: false,
      })

    if (previewError) {
      return { designId: '', error: previewError }
    }

    // Upload project file
    const { error: projectError } = await supabase.storage
      .from('designs')
      .upload(projectPath, projectBlob, {
        cacheControl: '3600',
        upsert: false,
      })

    if (projectError) {
      return { designId: '', error: projectError }
    }

    // Get public URL for preview
    const { data: previewData } = supabase.storage
      .from('designs')
      .getPublicUrl(previewPath)

    // Create design record
    const { error: dbError } = await supabase
      .from('designs')
      .insert({
        id: designId,
        user_id: userId,
        title: title.trim(),
        description: description?.trim() || null,
        model_id: modelId,
        preview_image_url: previewData.publicUrl,
        project_file_url: projectPath,
      })

    if (dbError) {
      return { designId: '', error: dbError }
    }

    return { designId, error: null }
  } catch (err) {
    return { designId: '', error: err }
  }
}

