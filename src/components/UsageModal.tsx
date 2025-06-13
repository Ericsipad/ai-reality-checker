
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface UsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  remainingChecks: number;
  totalChecks: number;
}

const UsageModal: React.FC<UsageModalProps> = ({ 
  isOpen, 
  onClose, 
  remainingChecks, 
  totalChecks 
}) => {
  const usedChecks = totalChecks - remainingChecks;
  const progressValue = (usedChecks / totalChecks) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            Weekly Usage
          </DialogTitle>
          <DialogDescription className="text-center text-gray-600">
            Track your free AI detection checks
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">
              {remainingChecks}
            </div>
            <p className="text-gray-600">checks remaining this week</p>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Used: {usedChecks}</span>
              <span>Total: {totalChecks}</span>
            </div>
            <Progress value={progressValue} className="h-3" />
          </div>
          
          {remainingChecks === 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600 text-sm text-center">
                You've used all your free checks this week. 
                Upgrade to continue detecting AI content!
              </p>
            </div>
          )}
          
          <div className="flex space-x-2">
            <Button 
              onClick={onClose} 
              variant="outline" 
              className="flex-1"
            >
              Close
            </Button>
            <Button 
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              Upgrade
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UsageModal;
