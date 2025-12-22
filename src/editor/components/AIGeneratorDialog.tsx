import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useEditorStore } from '../state/useEditorStore';
import { loadImage } from '../../utils/image';

// Available AI models for generation
// All models are text-to-image - mask is applied programmatically after generation
const AI_MODELS = {
  'flux-schnell': {
    id: 'black-forest-labs/flux-schnell',
    version: null, // Uses model endpoint
    name: 'Flux Schnell',
    description: 'Fast text-to-image generation',
    mode: 'text2img',
  },
} as const;

// Using only flux-schnell model

// Style presets for AI generation - focused on UV texture/wrap patterns
const AI_STYLE_PRESETS = {
  'realistic': {
    name: 'Realistic',
    description: 'Photorealistic textures and materials',
    promptModifier: 'photorealistic texture, high detail material, seamless tileable pattern, professional quality',
  },
  'artistic': {
    name: 'Artistic',
    description: 'Creative and stylized designs',
    promptModifier: 'artistic pattern design, creative illustration style, vibrant colors, stylized texture',
  },
  'abstract': {
    name: 'Abstract',
    description: 'Abstract patterns and shapes',
    promptModifier: 'abstract geometric pattern, modern graphic design, bold shapes, seamless repeating design',
  },
  'carbon-fiber': {
    name: 'Carbon Fiber',
    description: 'Carbon fiber and technical patterns',
    promptModifier: 'carbon fiber weave texture, technical material, premium automotive material, detailed fiber pattern',
  },
  'camo': {
    name: 'Camouflage',
    description: 'Military and camo patterns',
    promptModifier: 'camouflage pattern texture, military style, organic camo shapes, seamless camo design',
  },
  'gradient': {
    name: 'Gradient',
    description: 'Smooth color gradients',
    promptModifier: 'smooth color gradient, flowing color transition, soft blended colors, elegant fade',
  },
  'metallic': {
    name: 'Metallic',
    description: 'Metallic and chrome effects',
    promptModifier: 'metallic surface texture, brushed metal, chrome reflection, shiny material finish',
  },
  'nature': {
    name: 'Nature',
    description: 'Nature-inspired designs',
    promptModifier: 'nature inspired pattern, organic texture, natural elements, botanical or animal pattern',
  },
} as const;

type AIStylePreset = keyof typeof AI_STYLE_PRESETS;

// Prompt suggestions focused on textures and patterns (not car images)
const PROMPT_SUGGESTIONS = [
  'Ironman red and gold armor plating texture',
  'Cyberpunk neon circuit board pattern',
  'Ocean waves blue gradient flowing pattern',
  'Dragon scales dark metallic texture',
  'Galaxy nebula purple and blue cosmic pattern',
  'Flames and fire orange red gradient',
  'Military digital camouflage green pattern',
  'Lightning bolts electric blue on black',
  'Honeycomb hexagon gold metallic pattern',
  'Graffiti spray paint splatter colorful',
  'Japanese cherry blossom pink floral pattern',
  'Brushed titanium silver metallic surface',
  'Carbon fiber weave black texture',
  'Matte black with subtle glossy accents',
  'Holographic rainbow iridescent surface',
  'Snake skin reptile scale pattern',
  'Liquid mercury chrome reflective surface',
  'Aurora borealis green blue flowing lights',
  'Matrix digital rain green code pattern',
  'Tiger stripes orange black bold pattern',
  'Zebra stripes black white geometric',
  'Leopard spots brown gold animal print',
  'Marble veined white gray elegant texture',
  'Wood grain oak natural brown texture',
  'Brushed aluminum silver industrial finish',
  'Copper patina green blue oxidized metal',
  'Rose gold pink metallic shimmer',
  'Chrome mirror reflective polished surface',
  'Kintsugi gold cracks on black base',
  'Geometric triangles colorful abstract',
  'Mandala intricate circular pattern',
  'Kaleidoscope colorful symmetrical pattern',
  'Watercolor paint bleeding colorful',
  'Oil slick rainbow iridescent surface',
  'Crystal facets geometric transparent',
  'Lava flow orange red molten texture',
  'Ice crystals blue white frozen pattern',
  'Desert sand dunes beige tan waves',
  'Forest moss green organic texture',
  'Stone wall gray rough natural texture',
  'Brick wall red orange masonry pattern',
  'Concrete gray industrial urban texture',
  'Fabric weave textile material texture',
  'Leather brown tan natural grain',
  'Suede soft matte velvety texture',
  'Denim blue jean fabric weave',
  'Silk smooth shiny luxurious material',
  'Velvet deep rich plush texture',
  'Satin glossy smooth reflective',
  'Mesh netting geometric grid pattern',
  'Chainmail silver metallic interlocking',
  'Rivets industrial metal studded',
  'Racing stripes bold contrasting lines',
  'Pinstripes thin elegant parallel lines',
  'Checkerboard black white squares',
  'Polka dots colorful circular pattern',
  'Stars constellation night sky pattern',
  'Sunset orange pink purple gradient',
  'Tropical palm leaves green foliage',
  'Bamboo natural tan organic texture',
  'Coral reef colorful underwater pattern',
  'Feathers iridescent peacock blue green',
  'Butterfly wings colorful symmetrical',
  'Mosaic tiles colorful geometric',
  'Stained glass colorful translucent',
  'Neon signs pink blue electric glow',
  'Laser beams colorful sci-fi lines',
  'Circuit board green copper traces',
  'Microchip silicon tech pattern',
  'Fiber optic colorful light strands',
  'Plasma energy purple blue electric',
  'Steampunk brass gears mechanical',
  'Art Deco geometric gold black',
  'Bauhaus minimalist geometric shapes',
  'Abstract expressionist colorful brushstrokes',
  'Pop art bold colorful dots',
  'Minimalist clean simple geometric',
  'Maximalist busy intricate detailed',
  'Vintage retro faded worn texture',
  'Futuristic sci-fi tech advanced',
  'Organic natural flowing curves',
  'Geometric sharp angular precise',
];

// LocalStorage key for API key
const API_KEY_STORAGE_KEY = 'replicate_api_key';

// Replicate API via Vite proxy (to bypass CORS)
const REPLICATE_API_BASE = '/api/replicate';

interface AIGeneratorDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GenerationState {
  loading: boolean;
  error: string | null;
  images: string[];
  selectedIndex: number | null;
}

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[]; // Some models return single URL, others return array
  error?: string;
}

export const AIGeneratorDialog = ({ isOpen, onClose }: AIGeneratorDialogProps) => {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<AIStylePreset>('realistic');
  const [numOutputs, setNumOutputs] = useState(4);
  const [showStyleDropdown, setShowStyleDropdown] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [state, setState] = useState<GenerationState>({
    loading: false,
    error: null,
    images: [],
    selectedIndex: null,
  });

  const { addLayer, templateImage } = useEditorStore();
  const styleDropdownRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Load API key from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (savedKey) {
      setApiKey(savedKey);
    } else {
      setShowApiKeyInput(true);
    }
  }, []);

  // Save API key to localStorage
  const saveApiKey = (key: string) => {
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
    setApiKey(key);
    setShowApiKeyInput(false);
  };

  // Convert template image to base64 data URL for API (used as mask)
  const templateBase64 = useMemo(() => {
    if (!templateImage) return null;
    
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(templateImage, 0, 0, 1024, 1024);
    return canvas.toDataURL('image/png');
  }, [templateImage]);



  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (styleDropdownRef.current && !styleDropdownRef.current.contains(event.target as Node)) {
        setShowStyleDropdown(false);
      }
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !state.loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, state.loading]);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setState({
        loading: false,
        error: null,
        images: [],
        selectedIndex: null,
      });
    }
  }, [isOpen]);

  /**
   * Build a focused prompt for generating pure 2D texture patterns
   * NO car references - just texture generation like fabric/wallpaper/material
   */
  const buildPrompt = (userPrompt: string, selectedStyle: AIStylePreset): string => {
    const preset = AI_STYLE_PRESETS[selectedStyle];
    
    // Completely remove car references - think of this as generating a fabric pattern or wallpaper
    const prompt = `Generate a flat 2D texture pattern. ${userPrompt} ${preset.promptModifier}. Seamless repeating pattern design. High resolution texture map. Flat orthographic view. No perspective. No 3D. No objects. No shapes. Just pure texture pattern filling the entire square canvas. Material texture. Surface pattern. Tileable design. Professional quality. Ultra detailed. Print ready. No cars. No vehicles. No objects. No scenes. No backgrounds. Just pure texture pattern.`;
    
    return prompt;
  };

  /**
   * Get comprehensive negative prompt to avoid unwanted outputs
   * Very explicit about NOT generating cars or 3D objects
   */
  const getNegativePrompt = (): string => {
    return 'car, vehicle, automobile, tesla, 3D, 3D render, 3D model, perspective, depth, object, shape, form, structure, wheels, tires, headlights, windows, mirrors, bumper, photograph, photo, image of car, car image, vehicle image, automotive, transportation, road, street, background, scene, environment, text, words, letters, logo, watermark, blurry, low quality, pixelated, distorted, illustration, drawing, sketch, cartoon, anime, sticker, decal, badge, wrap, vinyl wrap, car wrap, vehicle wrap';
  };

  /**
   * Apply template mask to a generated image
   */
  const applyMask = useCallback(async (imageUrl: string): Promise<string> => {
    if (!templateImage) return imageUrl;
    
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      canvas.width = 1024;
      canvas.height = 1024;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Draw the generated image
        ctx.drawImage(img, 0, 0, 1024, 1024);
        
        // Apply the template mask using destination-in
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(templateImage, 0, 0, 1024, 1024);
        
        // Export as PNG with transparency
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    });
  }, [templateImage]);

  /**
   * Sleep helper
   */
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  /**
   * Make API request with retry logic for rate limits
   */
  const fetchWithRetry = async (
    url: string, 
    options: RequestInit, 
    maxRetries: number = 3
  ): Promise<Response> => {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);
        
        if (response.status === 429) {
          // Rate limited - extract wait time from error
          const errorData = await response.json().catch(() => ({}));
          const waitMatch = errorData.detail?.match(/resets in ~(\d+)s/);
          const waitTime = waitMatch ? parseInt(waitMatch[1]) * 1000 : (attempt + 1) * 2000;
          
          console.log(`Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
          
          // Update state to show waiting
          setState(prev => ({
            ...prev,
            error: `Rate limited. Retrying in ${Math.ceil(waitTime / 1000)}s... (${attempt + 1}/${maxRetries})`,
          }));
          
          await sleep(waitTime + 500); // Add a small buffer
          continue;
        }
        
        // Clear rate limit error on success
        setState(prev => prev.error?.includes('Rate limited') ? { ...prev, error: null } : prev);
        return response;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Network error');
        if (attempt < maxRetries - 1) {
          await sleep((attempt + 1) * 1000);
        }
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  };

  /**
   * Poll for prediction completion
   */
  const pollPrediction = async (predictionId: string, token: string): Promise<ReplicatePrediction> => {
    const maxAttempts = 60; // 60 * 2s = 2 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      const response = await fetchWithRetry(
        `${REPLICATE_API_BASE}/v1/predictions/${predictionId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        },
        2 // Less retries for polling
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `API error: ${response.status}`);
      }

      const prediction: ReplicatePrediction = await response.json();

      if (prediction.status === 'succeeded') {
        return prediction;
      } else if (prediction.status === 'failed' || prediction.status === 'canceled') {
        throw new Error(prediction.error || 'Prediction failed');
      }

      // Wait 2 seconds before polling again
      await sleep(2000);
      attempts++;
    }

    throw new Error('Generation timed out. Please try again.');
  };

  /**
   * Generate designs using Replicate API via proxy
   */
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setState(prev => ({ ...prev, error: 'Please enter a prompt' }));
      return;
    }

    if (!apiKey) {
      setShowApiKeyInput(true);
      setState(prev => ({ ...prev, error: 'Please enter your Replicate API key' }));
      return;
    }

    // Template is optional - mask will be applied programmatically after generation
    if (!templateBase64) {
      setState(prev => ({ ...prev, error: 'Template image not loaded. Please wait or try a different car model.' }));
      return;
    }

    setState({
      loading: true,
      error: null,
      images: [],
      selectedIndex: null,
    });

    try {
      const modelConfig = AI_MODELS['flux-schnell'];
      
      // Build the full prompt
      const fullPrompt = buildPrompt(prompt.trim(), style);
      const negativePrompt = getNegativePrompt();
      
      console.log('Generating AI texture design:', {
        originalPrompt: prompt,
        fullPrompt,
        negativePrompt,
        style,
        model: 'flux-schnell',
        numOutputs,
        hasTemplate: !!templateBase64,
      });

      // Flux Schnell - fast text-to-image generation
      const createResponse = await fetchWithRetry(
        `${REPLICATE_API_BASE}/v1/models/${modelConfig.id}/predictions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: {
              prompt: fullPrompt,
              num_outputs: numOutputs,
              aspect_ratio: '1:1',
              output_format: 'png',
              output_quality: 100,
            },
          }),
        },
        5
      );

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}));
        if (createResponse.status === 401 || createResponse.status === 403) {
          throw new Error('Invalid API key. Please check your Replicate API key.');
        }
        throw new Error(errorData.detail || `API error: ${createResponse.status}`);
      }

      const prediction: ReplicatePrediction = await createResponse.json();

      // Poll for completion
      const completedPrediction = await pollPrediction(prediction.id, apiKey);

      if (!completedPrediction.output) {
        throw new Error('No images generated. Please try again.');
      }

      // Normalize output to array - some models return single URL, others return array
      const outputUrls: string[] = Array.isArray(completedPrediction.output)
        ? completedPrediction.output
        : [completedPrediction.output];

      if (outputUrls.length === 0) {
        throw new Error('No images generated. Please try again.');
      }

      // Process images - fetch and apply mask
      const processedImages = await Promise.all(
        outputUrls.map(async (url) => {
          try {
            // Fetch the image
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error('Failed to fetch image');
            }
            const blob = await response.blob();
            
            // Convert to data URL
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            
            // Apply mask
            return await applyMask(dataUrl);
          } catch (error) {
            console.error('Failed to process image:', error);
            return null;
          }
        })
      );

      const validImages = processedImages.filter((img): img is string => img !== null);

      if (validImages.length === 0) {
        throw new Error('Failed to process generated images. Please try again.');
      }

      setState({
        loading: false,
        error: null,
        images: validImages,
        selectedIndex: 0,
      });
    } catch (error) {
      console.error('Generation error:', error);
      
      let errorMessage = 'Generation failed. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('Invalid API') || error.message.includes('401')) {
          errorMessage = 'Invalid API key. Please check your Replicate API key.';
          setShowApiKeyInput(true);
        } else if (error.message.includes('rate limit')) {
          errorMessage = 'Rate limit reached. Please wait a moment and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
    }
  }, [prompt, style, numOutputs, apiKey, applyMask, templateBase64]);

  /**
   * Add selected image as a texture layer
   */
  const handleAddToDesign = useCallback(async () => {
    if (state.selectedIndex === null || !state.images[state.selectedIndex]) return;

    const imageUrl = state.images[state.selectedIndex];
    
    try {
      // Load the image to get the HTMLImageElement
      const image = await loadImage(imageUrl);
      
      // Add as a texture layer
      addLayer({
        type: 'texture',
        name: `AI Design: ${prompt.slice(0, 30)}...`,
        src: imageUrl,
        image,
        visible: true,
        locked: false,
        opacity: 1,
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      });

      onClose();
    } catch (error) {
      console.error('Failed to add layer:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to add design to canvas. Please try again.',
      }));
    }
  }, [state.selectedIndex, state.images, prompt, addLayer, onClose]);

  const handleSuggestionClick = (suggestion: string) => {
    setPrompt(suggestion);
    setShowSuggestions(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70"
        onClick={() => !state.loading && onClose()}
      />
      
      {/* Dialog */}
      <div 
        ref={dialogRef}
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto bg-[#1a1a1a] rounded-xl border border-white/[0.08] shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-white/[0.08] bg-[#1a1a1a]">
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <h2 className="text-base font-medium text-white">AI Texture Generator</h2>
          </div>
          <button
            onClick={() => !state.loading && onClose()}
            className="p-1.5 rounded-md hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors disabled:opacity-50"
            disabled={state.loading}
            title="Close dialog"
            aria-label="Close dialog"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* API Key Input */}
          {showApiKeyInput && (
            <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.08]">
              <label className="block text-sm font-medium text-white/80 mb-1.5">
                Replicate API Key
              </label>
              <p className="text-xs text-white/40 mb-3">
                Get your key from{' '}
                <a 
                  href="https://replicate.com/account/api-tokens" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300"
                >
                  replicate.com
                </a>
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="r8_xxxxxxxx..."
                  className="flex-1 px-3 py-2 rounded-md bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/25 focus:outline-none focus:border-white/20 text-sm"
                />
                <button
                  onClick={() => saveApiKey(apiKey)}
                  disabled={!apiKey.trim()}
                  className="px-4 py-2 rounded-md bg-white text-black font-medium text-sm hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Save
                </button>
              </div>
              {apiKey && (
                <button
                  onClick={() => setShowApiKeyInput(false)}
                  className="mt-2 text-xs text-white/40 hover:text-white/60"
                >
                  Cancel
                </button>
              )}
            </div>
          )}

          {/* Change API Key button (when key is saved) */}
          {!showApiKeyInput && apiKey && (
            <div className="flex justify-end -mt-1 -mb-2">
              <button
                onClick={() => setShowApiKeyInput(true)}
                className="text-[11px] text-white/30 hover:text-white/50"
              >
                Change API Key
              </button>
            </div>
          )}

          {/* Prompt Input */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Describe your texture
            </label>
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. carbon fiber weave, galaxy nebula, dragon scales..."
                rows={2}
                className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/25 focus:outline-none focus:border-white/20 transition-colors resize-none text-sm"
                maxLength={500}
                disabled={state.loading}
              />
            </div>
            
            {/* Suggestions */}
            <div className="relative mt-2" ref={suggestionsRef}>
              <button
                type="button"
                onClick={() => setShowSuggestions(!showSuggestions)}
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span>Ideas</span>
                <svg className={`w-3 h-3 transition-transform ${showSuggestions ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showSuggestions && (
                <div className="absolute top-full left-0 mt-1.5 w-full max-h-40 overflow-y-auto bg-[#222] border border-white/[0.08] rounded-lg shadow-xl z-50">
                  {PROMPT_SUGGESTIONS.slice(0, 30).map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full px-3 py-2 text-left text-xs text-white/60 hover:bg-white/[0.06] hover:text-white transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Style and Variations Row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Style Selector */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">
                Style
              </label>
              <div className="relative" ref={styleDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowStyleDropdown(!showStyleDropdown)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm hover:bg-white/[0.06] transition-colors"
                  disabled={state.loading}
                >
                  <span>{AI_STYLE_PRESETS[style].name}</span>
                  <svg className={`w-3.5 h-3.5 text-white/40 transition-transform ${showStyleDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showStyleDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-[#222] border border-white/[0.08] rounded-lg shadow-xl z-50 overflow-hidden max-h-52 overflow-y-auto">
                    {(Object.keys(AI_STYLE_PRESETS) as AIStylePreset[]).map((key) => (
                      <button
                        key={key}
                        onClick={() => {
                          setStyle(key);
                          setShowStyleDropdown(false);
                        }}
                        className={`w-full px-3 py-2 text-left transition-colors ${
                          style === key 
                            ? 'bg-white/[0.08] text-white' 
                            : 'text-white/60 hover:bg-white/[0.04] hover:text-white'
                        }`}
                      >
                        <div className="text-sm">{AI_STYLE_PRESETS[key].name}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Number of Variations */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">
                Variations: {numOutputs}
              </label>
              <div className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                <input
                  type="range"
                  min="1"
                  max="4"
                  value={numOutputs}
                  onChange={(e) => setNumOutputs(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
                  disabled={state.loading}
                  title="Number of variations to generate"
                  aria-label="Number of variations"
                />
              </div>
            </div>
          </div>

          {/* Error Message */}
          {state.error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-red-400 flex-1">{state.error}</p>
              <button 
                onClick={() => setState(prev => ({ ...prev, error: null }))} 
                className="text-red-400/50 hover:text-red-400"
                title="Dismiss error"
                aria-label="Dismiss error"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={state.loading || !prompt.trim() || !apiKey}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-all ${
              state.loading || !prompt.trim() || !apiKey
                ? 'bg-white/[0.06] text-white/25 cursor-not-allowed'
                : 'bg-white text-black hover:bg-white/90'
            }`}
          >
            {state.loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <span>Generate</span>
              </>
            )}
          </button>

          {/* Loading State */}
          {state.loading && (
            <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-white/[0.02] border border-white/[0.06]">
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <div className="relative w-10 h-10">
                  <div className="absolute inset-0 rounded-full border border-white/10"></div>
                  <div className="absolute inset-0 rounded-full border border-transparent border-t-white/60 animate-spin"></div>
                </div>
                <div className="text-center">
                  <p className="text-white/50 text-sm">Creating your texture...</p>
                  <p className="text-white/30 text-xs mt-0.5">~15-30 seconds</p>
                </div>
              </div>
            </div>
          )}

          {/* Generated Images Grid */}
          {state.images.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white/50">Results</span>
                <button
                  onClick={handleGenerate}
                  disabled={state.loading}
                  className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white/60 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Regenerate</span>
                </button>
              </div>
              
              <div className={`grid gap-2 ${state.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {state.images.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setState(prev => ({ ...prev, selectedIndex: index }))}
                    className={`relative aspect-square rounded-lg overflow-hidden border transition-all ${
                      state.selectedIndex === index
                        ? 'border-white/40 ring-1 ring-white/20'
                        : 'border-white/[0.08] hover:border-white/20'
                    }`}
                    title={`Select design variation ${index + 1}`}
                    aria-label={`Select design variation ${index + 1}`}
                  >
                    <img
                      src={img}
                      alt={`Generated design ${index + 1}`}
                      className="w-full h-full object-contain bg-[#111]"
                    />
                    {state.selectedIndex === index && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                        <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Add to Design Button */}
              <button
                onClick={handleAddToDesign}
                disabled={state.selectedIndex === null}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-all ${
                  state.selectedIndex === null
                    ? 'bg-white/[0.06] text-white/25 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-400'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Add to Canvas</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


