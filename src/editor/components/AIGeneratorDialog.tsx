import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore } from '../state/useEditorStore';
import { loadImage } from '../../utils/image';
import { useAuth } from '../../contexts/AuthContext';
import { getUserCredits, deductCredit } from '../../utils/aiCredits';
import type { UserCredits } from '../../utils/aiCredits';
import { createCheckoutSession, CREDIT_PACKAGES, saveStripeReturnContext } from '../../utils/stripe';
import { saveProjectToLocalStorage, saveUIState } from '../../utils/localStorageProject';
import { supabase } from '../../lib/supabase';

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

// Replicate API via Supabase Edge Function (secure, server-side)
const REPLICATE_EDGE_FUNCTION = 'replicate-api';

interface AIGeneratorDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GeneratedImage {
  original: string;  // Unmasked image for adding to canvas
  preview: string;   // Masked image for preview
}

interface GenerationState {
  loading: boolean;
  error: string | null;
  images: GeneratedImage[];
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
  const [showStyleDropdown, setShowStyleDropdown] = useState(false);
  
  // Always generate 4 variations
  const numOutputs = 4;
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchasePackageId, setPurchasePackageId] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);
  const [showNoCreditsView, setShowNoCreditsView] = useState(false);
  const [state, setState] = useState<GenerationState>({
    loading: false,
    error: null,
    images: [],
    selectedIndex: null,
  });

  const { user } = useAuth();
  const { addLayer, templateImage, getSerializedState } = useEditorStore();
  const styleDropdownRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

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
      setShowNoCreditsView(false);
      setShowTopUp(false);
    }
  }, [isOpen]);

  // Track previous user state to detect logout (not initial open)
  const prevUserRef = useRef(user);
  
  // Fetch credits when dialog opens and user is logged in
  useEffect(() => {
    if (isOpen && user) {
      setLoadingCredits(true);
      getUserCredits(user.id)
        .then((userCredits) => {
          setCredits(userCredits);
          setLoadingCredits(false);
        })
        .catch((error) => {
          console.error('Error loading credits:', error);
          setLoadingCredits(false);
        });
    } else if (isOpen && !user && prevUserRef.current) {
      // Only close if user was logged in and now logged out (not on initial open)
      onClose();
    }
    // Update previous user reference
    prevUserRef.current = user;
  }, [isOpen, user, onClose]);

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
   * Poll for prediction completion via Supabase Edge Function
   */
  const pollPrediction = async (predictionId: string): Promise<ReplicatePrediction> => {
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    const maxAttempts = 60; // 60 * 2s = 2 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      // Use the Edge Function to poll prediction status
      const { data, error } = await supabase.functions.invoke(
        REPLICATE_EDGE_FUNCTION,
        {
          method: 'POST',
          body: { action: 'poll', predictionId },
        }
      );

      if (error) {
        throw new Error(error.message || `API error: ${error}`);
      }

      const prediction = data as ReplicatePrediction;

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
    if (!user) {
      setState(prev => ({ ...prev, error: 'Please log in to generate textures' }));
      onClose();
      return;
    }

    if (!prompt.trim()) {
      setState(prev => ({ ...prev, error: 'Please enter a prompt' }));
      return;
    }

    if (!supabase) {
      setState(prev => ({ ...prev, error: 'AI service is not configured. Please contact support.' }));
      return;
    }

    // Check if user has credits - show purchase view if none
    if (!credits || credits.credits <= 0) {
      setShowNoCreditsView(true);
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
      
      // Flux Schnell - fast text-to-image generation via Supabase Edge Function
      const { data: predictionData, error: createError } = await supabase.functions.invoke(
        REPLICATE_EDGE_FUNCTION,
        {
          method: 'POST',
          body: {
            action: 'create',
            model: modelConfig.id,
            input: {
              prompt: fullPrompt,
              num_outputs: numOutputs,
              aspect_ratio: '1:1',
              output_format: 'png',
              output_quality: 100,
            },
          },
        }
      );

      if (createError) {
        if (createError.message?.includes('401') || createError.message?.includes('403')) {
          throw new Error('AI service authentication failed. Please contact support.');
        }
        throw new Error(createError.message || 'Failed to create prediction');
      }

      const prediction = predictionData as ReplicatePrediction;

      if (!prediction || !prediction.id) {
        throw new Error('Invalid response from AI service');
      }

      // Poll for completion
      const completedPrediction = await pollPrediction(prediction.id);

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

      // Process images - fetch and create both original and masked preview
      const processedImages = await Promise.all(
        outputUrls.map(async (url) => {
          try {
            // Fetch the image
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error('Failed to fetch image');
            }
            const blob = await response.blob();
            
            // Convert to data URL (original unmasked image)
            const originalDataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            
            // Apply mask for preview only
            const previewDataUrl = await applyMask(originalDataUrl);
            
            return {
              original: originalDataUrl,
              preview: previewDataUrl,
            };
          } catch (error) {
            console.error('Failed to process image:', error);
            return null;
          }
        })
      );

      const validImages = processedImages.filter((img): img is GeneratedImage => img !== null);

      if (validImages.length === 0) {
        throw new Error('Failed to process generated images. Please try again.');
      }

      // Deduct credit after successful generation
      if (user) {
        const creditDeducted = await deductCredit(user.id);
        if (creditDeducted) {
          // Refresh credits display
          const updatedCredits = await getUserCredits(user.id);
          setCredits(updatedCredits);
        } else {
        }
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
          errorMessage = 'AI service authentication failed. Please contact support.';
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
  }, [prompt, style, applyMask, templateBase64, user, credits, onClose]);

  /**
   * Add selected image as a texture layer (uses original unmasked image for editing flexibility)
   */
  const handleAddToDesign = useCallback(async () => {
    if (state.selectedIndex === null || !state.images[state.selectedIndex]) return;

    // Use original (unmasked) image so user can move/adjust it in the editor
    const imageUrl = state.images[state.selectedIndex].original;
    
    try {
      // Load the image to get the HTMLImageElement
      const image = await loadImage(imageUrl);
      
      // Add as a texture layer
      addLayer({
        type: 'texture',
        name: 'AI Texture',
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

  // Handle direct purchase from inline packages
  const handlePurchase = async (packageId: string) => {
    if (!user) {
      setPurchaseError('Please log in to purchase credits');
      return;
    }

    setPurchaseLoading(true);
    setPurchasePackageId(packageId);
    setPurchaseError(null);

    try {
      const { url, error: checkoutError } = await createCheckoutSession(
        user.id,
        user.email || '',
        packageId
      );

      if (checkoutError) {
        setPurchaseError(checkoutError);
        setPurchaseLoading(false);
        setPurchasePackageId(null);
        return;
      }

      if (url) {
        // Save context and project before redirecting to Stripe
        const project = getSerializedState();
        saveProjectToLocalStorage(project);
        saveUIState({ openDialog: 'ai', zoom: 1, autoFit: true });
        saveStripeReturnContext({ openDialog: 'ai' }, project);
        
        // Redirect to Stripe Checkout
        window.location.href = url;
      } else {
        setPurchaseError('Failed to create checkout session');
        setPurchaseLoading(false);
        setPurchasePackageId(null);
      }
    } catch (err) {
      console.error('Purchase error:', err);
      setPurchaseError('An error occurred. Please try again.');
      setPurchaseLoading(false);
      setPurchasePackageId(null);
    }
  };

  // Check for payment success/cancel on mount (after Stripe redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    
    if (paymentStatus === 'success') {
      // Clear the URL parameter
      window.history.replaceState({}, '', window.location.pathname);
      // Refresh credits
      if (user) {
        getUserCredits(user.id).then(setCredits);
      }
    } else if (paymentStatus === 'cancelled') {
      // Clear the URL parameter
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [user]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop with blur */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => !state.loading && onClose()}
      />
      
      {/* Dialog */}
      <div 
        ref={dialogRef}
        className="relative w-full max-w-md max-h-[85vh] overflow-hidden bg-gradient-to-b from-[#1f1f23] to-[#16161a] rounded-2xl border border-white/10 shadow-2xl shadow-black/50"
      >
        {/* Decorative gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
        
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-[#1f1f23]/95 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">AI Texture Generator</h2>
              {loadingCredits ? (
                <span className="text-xs text-white/40">Loading credits...</span>
              ) : credits !== null ? (
                <span className={`text-xs ${credits.credits > 0 ? 'text-purple-400' : 'text-red-400'}`}>
                  {credits.credits} credit{credits.credits !== 1 ? 's' : ''} remaining
                </span>
              ) : null}
            </div>
          </div>
          <button
            onClick={() => !state.loading && onClose()}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.08] text-white/40 hover:text-white transition-all disabled:opacity-50"
            disabled={state.loading}
            title="Close dialog"
            aria-label="Close dialog"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Scrollable content */}
        <div className="overflow-y-auto max-h-[calc(85vh-80px)]">

          {/* Show purchase UI when no credits (either initially or after trying to generate) */}
          {!loadingCredits && (showNoCreditsView || (credits !== null && credits.credits === 0 && state.images.length === 0)) ? (
            <div className="p-6 space-y-6">
              {/* No Credits Message */}
              <div className="text-center py-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-white text-lg font-semibold mb-2">No Credits Remaining</h3>
                <p className="text-white/50 text-sm">Purchase credits to generate AI textures</p>
              </div>

              {/* Purchase Error */}
              {purchaseError && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-400 flex-1">{purchaseError}</p>
                </div>
              )}

              {/* Credit Packages - Direct to Stripe */}
              <div className="space-y-3" data-purchase-section>
                {CREDIT_PACKAGES.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => handlePurchase(pkg.id)}
                    disabled={purchaseLoading}
                    className={`group w-full p-4 rounded-xl border-2 transition-all text-left ${
                      pkg.popular
                        ? 'border-purple-500/60 bg-gradient-to-r from-purple-500/10 to-blue-500/10'
                        : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                    } ${purchaseLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.99]'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-white font-semibold text-base">{pkg.credits} credits</span>
                          {pkg.popular && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-full uppercase tracking-wide">
                              Best Value
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-white/40 mt-1">
                          ${(pkg.price / pkg.credits).toFixed(2)} per credit
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {purchaseLoading && purchasePackageId === pkg.id ? (
                          <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                        ) : (
                          <span className="text-2xl font-bold text-white">${pkg.price}</span>
                        )}
                        <svg className={`w-5 h-5 text-white/30 transition-transform ${purchaseLoading ? '' : 'group-hover:translate-x-1'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Info & Secure Payment */}
              <div className="flex flex-col items-center gap-2 pt-2">
                <p className="text-xs text-white/50">1 Credit = 1 Texture Generated</p>
                <div className="flex items-center gap-2 text-white/30">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="text-xs">Secure payment via Stripe</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-5">
            {/* Prompt Input */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Describe your texture
              </label>
              <div className="relative">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. carbon fiber weave, galaxy nebula, dragon scales..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.07] transition-all resize-none text-sm leading-relaxed"
                  maxLength={500}
                  disabled={state.loading}
                />
                <div className="absolute bottom-2.5 right-3 text-[10px] text-white/20">
                  {prompt.length}/500
                </div>
              </div>
              
              {/* Suggestions */}
              <div className="relative mt-3" ref={suggestionsRef}>
                <button
                  type="button"
                  onClick={() => setShowSuggestions(!showSuggestions)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/70 hover:bg-white/[0.05] transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span>Need inspiration?</span>
                  <svg className={`w-3.5 h-3.5 transition-transform ${showSuggestions ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showSuggestions && (
                  <div className="absolute top-full left-0 mt-2 w-full max-h-48 overflow-y-auto bg-[#252529] border border-white/[0.1] rounded-xl shadow-xl z-50">
                    {PROMPT_SUGGESTIONS.slice(0, 30).map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="w-full px-4 py-2.5 text-left text-sm text-white/60 hover:bg-white/[0.06] hover:text-white transition-colors first:rounded-t-xl last:rounded-b-xl"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Style Selector */}
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">
                Style
              </label>
              <div className="relative" ref={styleDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowStyleDropdown(!showStyleDropdown)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white text-sm hover:bg-white/[0.07] hover:border-white/[0.15] transition-all"
                  disabled={state.loading}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-purple-400" />
                    <span>{AI_STYLE_PRESETS[style].name}</span>
                  </div>
                  <svg className={`w-4 h-4 text-white/40 transition-transform ${showStyleDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showStyleDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-full bg-[#252529] border border-white/[0.1] rounded-xl shadow-xl z-50 overflow-hidden max-h-56 overflow-y-auto">
                    {(Object.keys(AI_STYLE_PRESETS) as AIStylePreset[]).map((key) => (
                      <button
                        key={key}
                        onClick={() => {
                          setStyle(key);
                          setShowStyleDropdown(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left transition-all flex items-center gap-2.5 ${
                          style === key 
                            ? 'bg-purple-500/20 text-white' 
                            : 'text-white/60 hover:bg-white/[0.06] hover:text-white'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${style === key ? 'bg-purple-400' : 'bg-white/20'}`} />
                        <span className="text-sm">{AI_STYLE_PRESETS[key].name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Error Message */}
            {state.error && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-400 flex-1">{state.error}</p>
                <button 
                  onClick={() => setState(prev => ({ ...prev, error: null }))} 
                  className="text-red-400/50 hover:text-red-400 transition-colors"
                  title="Dismiss error"
                  aria-label="Dismiss error"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={state.loading || !prompt.trim()}
              className={`w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-semibold text-sm transition-all ${
                state.loading || !prompt.trim()
                  ? 'bg-white/[0.06] text-white/25 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-400 hover:to-blue-400 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {state.loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  <span>Generate Textures</span>
                  {credits && credits.credits > 0 && (
                    <span className="ml-1 px-2 py-0.5 rounded-full bg-white/20 text-xs">1 credit</span>
                  )}
                </>
              )}
            </button>

            {/* Loading State */}
            {state.loading && (
              <div className="relative aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-purple-500/5 to-blue-500/5 border border-white/[0.08]">
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-2 border-purple-500/20"></div>
                    <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-500 animate-spin"></div>
                    <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-blue-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                  </div>
                  <div className="text-center">
                    <p className="text-white/70 text-sm font-medium">Creating your textures...</p>
                    <p className="text-white/40 text-xs mt-1">This usually takes 15-30 seconds</p>
                  </div>
                </div>
                {/* Animated background */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-pulse" />
              </div>
            )}

            {/* Generated Images Grid */}
            {state.images.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white/70">Choose a variation</span>
                  <button
                    onClick={handleGenerate}
                    disabled={state.loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white hover:bg-white/[0.06] transition-all disabled:opacity-50"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Regenerate</span>
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {state.images.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => setState(prev => ({ ...prev, selectedIndex: index }))}
                      className={`group relative aspect-square rounded-xl overflow-hidden transition-all ${
                        state.selectedIndex === index
                          ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-[#1f1f23]'
                          : 'ring-1 ring-white/[0.1] hover:ring-white/[0.2]'
                      }`}
                      title={`Select design variation ${index + 1}`}
                      aria-label={`Select design variation ${index + 1}`}
                    >
                      <img
                        src={img.preview}
                        alt={`Generated design ${index + 1}`}
                        className="w-full h-full object-contain bg-[#0a0a0c]"
                      />
                      {/* Hover overlay */}
                      <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity ${
                        state.selectedIndex === index ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`} />
                      {/* Selection indicator */}
                      {state.selectedIndex === index && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center shadow-lg">
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                      {/* Variation number */}
                      <div className={`absolute bottom-2 left-2 px-2 py-0.5 rounded-md text-xs font-medium transition-opacity ${
                        state.selectedIndex === index 
                          ? 'bg-purple-500/80 text-white opacity-100' 
                          : 'bg-black/50 text-white/70 opacity-0 group-hover:opacity-100'
                      }`}>
                        #{index + 1}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Add to Design Button */}
                <button
                  onClick={handleAddToDesign}
                  disabled={state.selectedIndex === null}
                  className={`w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-semibold text-sm transition-all ${
                    state.selectedIndex === null
                      ? 'bg-white/[0.06] text-white/25 cursor-not-allowed'
                      : 'bg-white text-black hover:bg-white/90 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Add to Canvas</span>
                </button>
              </div>
            )}

            {/* Top Up Credits Section */}
            <div className="pt-4 mt-4 border-t border-white/[0.06]" data-purchase-section>
              <button
                onClick={() => setShowTopUp(!showTopUp)}
                className="w-full flex items-center justify-between py-2 text-sm text-white/50 hover:text-white/70 transition-colors"
              >
                <span>Need more credits?</span>
                <svg className={`w-4 h-4 transition-transform ${showTopUp ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showTopUp && (
                <div className="mt-3 space-y-2.5">
                  {purchaseError && (
                    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-xs text-red-400 flex-1">{purchaseError}</p>
                    </div>
                  )}
                  {CREDIT_PACKAGES.map((pkg) => (
                    <button
                      key={pkg.id}
                      onClick={() => handlePurchase(pkg.id)}
                      disabled={purchaseLoading}
                      className={`group w-full p-3 rounded-xl border transition-all text-left ${
                        pkg.popular
                          ? 'border-purple-500/40 bg-purple-500/5'
                          : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04]'
                      } ${purchaseLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.01] active:scale-[0.99]'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="text-white text-sm font-medium">{pkg.credits} credits</span>
                          {pkg.popular && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-full">
                              BEST
                            </span>
                          )}
                          <span className="text-xs text-white/30">${(pkg.price / pkg.credits).toFixed(2)}/credit</span>
                        </div>
                        {purchaseLoading && purchasePackageId === pkg.id ? (
                          <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                        ) : (
                          <span className="text-sm font-semibold text-white">${pkg.price}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};


