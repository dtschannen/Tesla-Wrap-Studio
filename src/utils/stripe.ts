import { supabase } from '../lib/supabase';
import { saveProjectToLocalStorage } from './localStorageProject';
import type { ProjectFile } from '../editor/state/useEditorStore';

// Session storage key for Stripe return context
const STRIPE_RETURN_CONTEXT_KEY = 'tesla_wrap_stripe_return_context';

export interface StripeReturnContext {
  openDialog: 'ai' | null;
  timestamp: number;
}

/**
 * Save context before redirecting to Stripe
 */
export function saveStripeReturnContext(context: Omit<StripeReturnContext, 'timestamp'>, project?: ProjectFile): void {
  try {
    // Save return context to sessionStorage (survives redirect but not browser close)
    sessionStorage.setItem(STRIPE_RETURN_CONTEXT_KEY, JSON.stringify({
      ...context,
      timestamp: Date.now(),
    }));
    
    // Save project to localStorage if provided
    if (project) {
      saveProjectToLocalStorage(project);
    }
  } catch (error) {
    console.error('Failed to save Stripe return context:', error);
  }
}

/**
 * Load and clear Stripe return context
 */
export function loadStripeReturnContext(): StripeReturnContext | null {
  try {
    const stored = sessionStorage.getItem(STRIPE_RETURN_CONTEXT_KEY);
    if (!stored) return null;
    
    // Clear after reading
    sessionStorage.removeItem(STRIPE_RETURN_CONTEXT_KEY);
    
    const context = JSON.parse(stored) as StripeReturnContext;
    
    // Expire context after 30 minutes
    if (Date.now() - context.timestamp > 30 * 60 * 1000) {
      return null;
    }
    
    return context;
  } catch (error) {
    console.error('Failed to load Stripe return context:', error);
    return null;
  }
}

// Credit packages with Stripe price IDs
// These should match your Stripe Dashboard product prices
export const CREDIT_PACKAGES = [
  { 
    id: 'small', 
    credits: 10, 
    price: 1, 
    priceId: import.meta.env.VITE_STRIPE_PRICE_SMALL || 'price_small',
    popular: false 
  },
  { 
    id: 'medium', 
    credits: 50, 
    price: 4, 
    priceId: import.meta.env.VITE_STRIPE_PRICE_MEDIUM || 'price_medium',
    popular: false 
  },
  { 
    id: 'large', 
    credits: 100, 
    price: 7, 
    priceId: import.meta.env.VITE_STRIPE_PRICE_LARGE || 'price_large',
    popular: true 
  },
] as const;

export type CreditPackage = typeof CREDIT_PACKAGES[number];

/**
 * Create a Stripe Checkout session for purchasing credits
 */
export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  packageId: string
): Promise<{ url: string | null; error: string | null }> {
  if (!supabase) {
    return { url: null, error: 'Database not configured' };
  }

  const pkg = CREDIT_PACKAGES.find(p => p.id === packageId);
  if (!pkg) {
    return { url: null, error: 'Invalid package selected' };
  }

  try {
    // Call Supabase Edge Function to create checkout session
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: {
        userId,
        userEmail,
        priceId: pkg.priceId,
        credits: pkg.credits,
        packageId: pkg.id,
        successUrl: `${window.location.origin}/?payment=success&openDialog=ai`,
        cancelUrl: `${window.location.origin}/?payment=cancelled`,
      },
    });

    if (error) {
      console.error('Checkout session error:', error);
      return { url: null, error: error.message || 'Failed to create checkout session' };
    }

    if (!data?.url) {
      return { url: null, error: 'No checkout URL returned' };
    }

    return { url: data.url, error: null };
  } catch (err) {
    console.error('Checkout error:', err);
    return { url: null, error: 'Failed to initiate checkout' };
  }
}

/**
 * Verify a payment was successful (called after redirect from Stripe)
 */
export async function verifyPayment(sessionId: string): Promise<{ success: boolean; error: string | null }> {
  if (!supabase) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('verify-payment', {
      body: { sessionId },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: data?.success || false, error: null };
  } catch (err) {
    console.error('Payment verification error:', err);
    return { success: false, error: 'Failed to verify payment' };
  }
}

