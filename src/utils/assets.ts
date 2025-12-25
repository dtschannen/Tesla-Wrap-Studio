/**
 * Get asset URLs for wrap templates and 3D models
 * Assets are located in src/assets/wraps/{folderName}/
 * 
 * In Vite, assets in src/ need to be imported or accessed via a special path
 */

// Pre-load all template images using Vite's glob import
// Note: Paths must be relative to the project root
const templateModules = import.meta.glob('../assets/wraps/**/template.png', { 
  eager: true,
  query: '?url',
  import: 'default'
});

// Pre-load all GLTF/GLB files (look in 3D subfolder or root) - same pattern as template images
const gltfModules = import.meta.glob('../assets/wraps/**/3D/*.{gltf,glb}', { 
  eager: true,
  query: '?url',
  import: 'default'
});

// Also check for GLB files in model root (for new Godot-extracted models)  
const glbModules = import.meta.glob('../assets/wraps/**/*.glb', { 
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>;

// Pre-load all vehicle preview images
const vehicleImageModules = import.meta.glob('../assets/wraps/**/vehicle_image.png', { 
  eager: true,
  query: '?url',
  import: 'default'
});

/**
 * Get the URL for a template image
 */
export const getTemplateUrl = (folderName: string): string => {
  const path = `../assets/wraps/${folderName}/template.png`;
  const module = templateModules[path];
  if (module && typeof module === 'string') {
    return module;
  }
  // Fallback: try direct import path
  console.warn(`Template not found: ${path}, trying fallback`);
  // In development, Vite serves from project root
  return new URL(`../assets/wraps/${folderName}/template.png`, import.meta.url).href;
};

/**
 * Get the URL for a vehicle preview image
 */
export const getVehicleImageUrl = (folderName: string): string => {
  const path = `../assets/wraps/${folderName}/vehicle_image.png`;
  const module = vehicleImageModules[path];
  if (module && typeof module === 'string') {
    return module;
  }
  // Fallback: try direct import path
  console.warn(`Vehicle image not found: ${path}, trying fallback`);
  return new URL(`../assets/wraps/${folderName}/vehicle_image.png`, import.meta.url).href;
};

/**
 * Get the URL for a vehicle GLTF file
 * Returns null if no GLTF file exists for this model
 */
// Direct import for modely GLB to ensure Vite processes it correctly
let modelyGlbUrl: string | null = null;
try {
  // This import will be processed by Vite and give us the correct URL
  modelyGlbUrl = new URL('../assets/wraps/modely/Y_High/ModelY_High.glb', import.meta.url).href;
} catch (e) {
  console.warn('[GLTF] Could not create URL for modely GLB:', e);
}

export const getGltfUrl = (folderName: string): string | null => {
  // Priority 1: For modely, use the new Y_High GLB file  
  if (folderName === 'modely') {
    // NOTE: GLB files in src/assets have issues with Vite's ?url processing
    // The glob returns /src/ paths which don't work in browser
    // 
    // SOLUTION OPTIONS:
    // 1. Move GLB to public/ folder (simplest)
    // 2. Use dynamic import (more complex)
    // 3. Restart dev server (might help if glob cache is stale)
    
    // Try glob URL first
    const globKey = '../assets/wraps/modely/Y_High/ModelY_High.glb';
    if (glbModules[globKey] && typeof glbModules[globKey] === 'string') {
      let globUrl = glbModules[globKey];
      console.log(`[GLTF] Glob URL: ${globUrl}`);
      
      // If URL has /src/, Vite isn't processing it - this is the bug
      if (globUrl.includes('/src/')) {
        console.warn('[GLTF] ⚠️  Glob returned /src/ path - this indicates Vite asset processing issue');
        console.warn('[GLTF] 💡 Try: 1) Restart dev server, or 2) Move GLB to public/ folder');
        // Return it anyway - maybe the viewer can handle it differently
        return globUrl;
      }
      return globUrl;
    }
    
    // Fallback
    if (modelyGlbUrl) {
      return modelyGlbUrl;
    }
  }
  
  // Fallback: try glob modules for other models
  for (const [globPath, module] of Object.entries(glbModules)) {
    if (globPath.includes(`/${folderName}/`) && globPath.endsWith('.glb')) {
      if (module && typeof module === 'string') {
        console.log(`[GLTF] Found GLB via glob: ${globPath} -> ${module}`);
        return module;
      }
    }
  }
  
  // Priority 2: Look for any .gltf/.glb file in the 3D subfolder
  for (const [globPath, module] of Object.entries(gltfModules)) {
    if (globPath.includes(`/${folderName}/3D/`)) {
      // The glob with ?url should return the URL string directly (like template images)
      if (module && typeof module === 'string') {
        let url = module;
        console.log(`[GLTF] Found via 3D subfolder: ${globPath} -> ${url}`);
        return url;
      }
      console.warn(`[GLTF] Module for ${globPath} is not a string:`, typeof module, module);
    }
  }
  
  // Fallback: try to construct a path manually (check for GLB first, then GLTF)
  console.warn(`[GLTF] Glob didn't find file, trying fallback paths`);
  const fallbackFilenames = ['ModelY_High.glb', 'ModelY_High.gltf', 'vehicle.glb', 'vehicle.gltf', 'model.glb', 'model.gltf'];
  const fallbackFolders = folderName === 'modely' 
    ? [`${folderName}/Y_High`, folderName]
    : [folderName];
  
  for (const fallbackFolder of fallbackFolders) {
    for (const filename of fallbackFilenames) {
      const path = `/src/assets/wraps/${fallbackFolder}/${filename}`;
      console.log(`[GLTF] Trying fallback path: ${path}`);
      // Try this path - if it doesn't exist, Vite will handle the error
      return path;
    }
  }
  
  console.error(`[GLTF] No GLTF/GLB file found for ${folderName}`);
  console.log(`[GLTF] Available glob paths:`, Object.keys(gltfModules).concat(Object.keys(glbModules)));
  return null;
};
