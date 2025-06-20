
import { useState, useEffect } from 'react';

export const useIOSDetection = () => {
  const [isIOS, setIsIOS] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    const isSafariApp = /safari/.test(userAgent) && !/chrome|crios|fxios/.test(userAgent);
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || 
                               (window.navigator as any).standalone === true;

    setIsIOS(isIOSDevice);
    setIsSafari(isSafariApp);
    setIsStandalone(isInStandaloneMode);
  }, []);

  return {
    isIOS,
    isSafari,
    isStandalone,
    shouldShowPrompt: isIOS && isSafari && !isStandalone
  };
};
