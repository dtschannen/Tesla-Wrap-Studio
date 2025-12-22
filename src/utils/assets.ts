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

// Pre-load all OBJ files
const objModules = import.meta.glob('../assets/wraps/**/vehicle.obj', { 
  eager: true,
  query: '?url',
  import: 'default'
});

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
  return new URL(`../assets/wraps/${folderName}/template.png`, import.meta.url).href;
};

/**
 * Get the URL for a vehicle OBJ file
 */
export const getObjUrl = (folderName: string): string => {
  const path = `../assets/wraps/${folderName}/vehicle.obj`;
  const module = objModules[path];
  if (module && typeof module === 'string') {
    return module;
  }
  // Fallback: try direct import path
  return new URL(`../assets/wraps/${folderName}/vehicle.obj`, import.meta.url).href;
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
  return new URL(`../assets/wraps/${folderName}/vehicle_image.png`, import.meta.url).href;
};
