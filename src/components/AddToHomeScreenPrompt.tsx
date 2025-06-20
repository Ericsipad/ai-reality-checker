
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Plus, Share, Home } from 'lucide-react';
import { useIOSDetection } from '@/hooks/useIOSDetection';

interface AddToHomeScreenPromptProps {
  onClose: () => void;
}

const AddToHomeScreenPrompt: React.FC<AddToHomeScreenPromptProps> = ({ onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  const handleClose = () => {
    setIsVisible(false);
    onClose();
    // Remember that user dismissed the prompt
    localStorage.setItem('addToHomeScreenDismissed', 'true');
  };

  const handleInstall = () => {
    // Mark as installed (user followed instructions)
    localStorage.setItem('addToHomeScreenInstalled', 'true');
    handleClose();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="bg-white rounded-lg shadow-lg border p-4 animate-in slide-in-from-bottom-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center space-x-2">
            <Home className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Add to Home Screen</h3>
          </div>
          <Button
            onClick={handleClose}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <p className="text-sm text-gray-600 mb-4">
          Install this app on your iPhone for quick access and a better experience!
        </p>
        
        <div className="space-y-3">
          <div className="flex items-center space-x-3 text-sm">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-medium">1</span>
            </div>
            <div className="flex items-center space-x-1">
              <span>Tap</span>
              <Share className="h-4 w-4 text-blue-600" />
              <span className="font-medium">Share</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 text-sm">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-medium">2</span>
            </div>
            <div className="flex items-center space-x-1">
              <span>Select</span>
              <Plus className="h-4 w-4 text-blue-600" />
              <span className="font-medium">Add to Home Screen</span>
            </div>
          </div>
        </div>
        
        <div className="flex space-x-2 mt-4">
          <Button
            onClick={handleInstall}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            size="sm"
          >
            Got it!
          </Button>
          <Button
            onClick={handleClose}
            variant="outline"
            size="sm"
          >
            Maybe later
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AddToHomeScreenPrompt;
