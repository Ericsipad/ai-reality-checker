
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { validateEmail, validatePassword, sanitizeInput, authRateLimiter } from '@/utils/authValidation';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Utility to clean up auth state
const cleanupAuthState = () => {
  try {
    // Remove all Supabase auth keys from localStorage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
    
    // Remove from sessionStorage if in use
    Object.keys(sessionStorage || {}).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        sessionStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Error cleaning up auth state:', error);
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      // Input validation and sanitization
      const sanitizedEmail = sanitizeInput(email.toLowerCase());
      const sanitizedPassword = sanitizeInput(password);

      if (!validateEmail(sanitizedEmail)) {
        return { error: { message: 'Please enter a valid email address' } };
      }

      // Rate limiting
      if (!authRateLimiter.isAllowed(sanitizedEmail)) {
        const remainingTime = authRateLimiter.getRemainingTime(sanitizedEmail);
        const minutes = Math.ceil(remainingTime / (60 * 1000));
        return { 
          error: { 
            message: `Too many login attempts. Please try again in ${minutes} minutes.` 
          } 
        };
      }

      // Clean up existing state before signing in
      cleanupAuthState();
      
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (err) {
        // Continue even if this fails
        console.warn('Global sign out failed:', err);
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: sanitizedEmail,
        password: sanitizedPassword,
      });

      if (error) {
        console.error('Sign in error:', error);
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Unexpected sign in error:', error);
      return { error: { message: 'An unexpected error occurred. Please try again.' } };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      // Input validation and sanitization
      const sanitizedEmail = sanitizeInput(email.toLowerCase());
      const sanitizedPassword = sanitizeInput(password);
      const sanitizedFullName = fullName ? sanitizeInput(fullName) : '';

      if (!validateEmail(sanitizedEmail)) {
        return { error: { message: 'Please enter a valid email address' } };
      }

      const passwordValidation = validatePassword(sanitizedPassword);
      if (!passwordValidation.isValid) {
        return { 
          error: { 
            message: passwordValidation.errors.join('. ') 
          } 
        };
      }

      // Rate limiting
      if (!authRateLimiter.isAllowed(sanitizedEmail)) {
        const remainingTime = authRateLimiter.getRemainingTime(sanitizedEmail);
        const minutes = Math.ceil(remainingTime / (60 * 1000));
        return { 
          error: { 
            message: `Too many signup attempts. Please try again in ${minutes} minutes.` 
          } 
        };
      }

      // Clean up existing state before signing up
      cleanupAuthState();
      
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (err) {
        // Continue even if this fails
        console.warn('Global sign out failed:', err);
      }

      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email: sanitizedEmail,
        password: sanitizedPassword,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: sanitizedFullName,
          },
        },
      });

      if (error) {
        console.error('Sign up error:', error);
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Unexpected sign up error:', error);
      return { error: { message: 'An unexpected error occurred. Please try again.' } };
    }
  };

  const signOut = async () => {
    try {
      // Clean up auth state
      cleanupAuthState();
      
      // Attempt global sign out
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (err) {
        // Continue even if this fails
        console.warn('Global sign out failed:', err);
      }
      
      // Force page reload for a clean state
      window.location.href = '/auth';
    } catch (error) {
      console.error('Sign out error:', error);
      // Force reload even on error
      window.location.href = '/auth';
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
