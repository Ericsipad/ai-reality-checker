
import { useState, useEffect } from 'react';
import { useIOSDetection } from './useIOSDetection';

export const useAddToHomeScreen = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const { shouldShowPrompt } = useIOSDetection();

  useEffect(() => {
    // Only show on iOS Safari and not in standalone mode
    if (!shouldShowPrompt) return;

    // Check if user has already dismissed or installed
    const dismissed = localStorage.getItem('addToHomeScreenDismissed');
    const installed = localStorage.getItem('addToHomeScreenInstalled');
    
    if (dismissed || installed) return;

    // Check if this is a new user (first visit or recent signup)
    const isNewUser = !localStorage.getItem('hasVisitedBefore');
    const recentSignup = localStorage.getItem('recentSignup');
    
    if (isNewUser || recentSignup) {
      // Show prompt after a short delay
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000); // 3 second delay

      return () => clearTimeout(timer);
    }

    // Mark that user has visited before
    localStorage.setItem('hasVisitedBefore', 'true');
  }, [shouldShowPrompt]);

  const handleClose = () => {
    setShowPrompt(false);
  };

  return {
    showPrompt,
    handleClose
  };
};
