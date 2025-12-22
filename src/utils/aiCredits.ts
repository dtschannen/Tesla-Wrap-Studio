import { supabase } from '../lib/supabase';

export interface UserCredits {
  credits: number;
  purchased: number;
  used: number;
}

/**
 * Get user's current AI texture credits
 */
export async function getUserCredits(userId: string): Promise<UserCredits | null> {
  if (!supabase) {
    console.error('Supabase not configured');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('ai_texture_credits, ai_texture_credits_purchased, ai_texture_credits_used')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching credits:', error);
      return null;
    }

    return {
      credits: data?.ai_texture_credits ?? 0,
      purchased: data?.ai_texture_credits_purchased ?? 0,
      used: data?.ai_texture_credits_used ?? 0,
    };
  } catch (error) {
    console.error('Error fetching credits:', error);
    return null;
  }
}

/**
 * Check if user has available credits
 */
export async function checkHasCredits(userId: string): Promise<boolean> {
  const credits = await getUserCredits(userId);
  return credits ? credits.credits > 0 : false;
}

/**
 * Deduct one credit after successful generation
 */
export async function deductCredit(userId: string): Promise<boolean> {
  if (!supabase) {
    console.error('Supabase not configured');
    return false;
  }

  try {
    // Use a transaction-like approach: check credits first, then deduct
    const { data: currentData, error: fetchError } = await supabase
      .from('profiles')
      .select('ai_texture_credits, ai_texture_credits_used')
      .eq('id', userId)
      .single();

    if (fetchError || !currentData) {
      console.error('Error fetching current credits:', fetchError);
      return false;
    }

    if (currentData.ai_texture_credits <= 0) {
      return false;
    }

    // Deduct credit and increment used count atomically
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        ai_texture_credits: currentData.ai_texture_credits - 1,
        ai_texture_credits_used: (currentData.ai_texture_credits_used ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .eq('ai_texture_credits', currentData.ai_texture_credits); // Optimistic locking

    if (updateError) {
      console.error('Error deducting credit:', updateError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deducting credit:', error);
    return false;
  }
}

/**
 * Add purchased credits to user account
 */
export async function addCredits(userId: string, amount: number): Promise<boolean> {
  if (!supabase) {
    console.error('Supabase not configured');
    return false;
  }

  if (amount <= 0) {
    console.error('Invalid credit amount');
    return false;
  }

  try {
    // Get current values
    const { data: currentData, error: fetchError } = await supabase
      .from('profiles')
      .select('ai_texture_credits, ai_texture_credits_purchased')
      .eq('id', userId)
      .single();

    if (fetchError || !currentData) {
      console.error('Error fetching current credits:', fetchError);
      return false;
    }

    // Add credits atomically
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        ai_texture_credits: (currentData.ai_texture_credits ?? 0) + amount,
        ai_texture_credits_purchased: (currentData.ai_texture_credits_purchased ?? 0) + amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error adding credits:', updateError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error adding credits:', error);
    return false;
  }
}

