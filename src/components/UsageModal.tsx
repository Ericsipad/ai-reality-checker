
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
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface UsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  remainingChecks: number;
  totalChecks: number;
  onUpgrade?: () => void;
  isSubscribed?: boolean;
}

const UsageModal: React.FC<UsageModalProps> = ({ 
  isOpen, 
  onClose, 
  remainingChecks, 
  totalChecks,
  onUpgrade,
  isSubscribed = false
}) => {
  const { user } = useAuth();
  
  // For authenticated pay-per-use users, totalChecks represents their purchased checks
  // remainingChecks is what they have left
  // So used = totalChecks - remainingChecks
  const usedChecks = user ? (totalChecks - remainingChecks) : (totalChecks - remainingChecks);
  const progressValue = totalChecks > 0 ? (usedChecks / totalChecks) * 100 : 0;

  // Don't render the modal at all for subscribed users
  if (isSubscribed) {
    return null;
  }

  const handleUpgrade = () => {
    onClose();
    onUpgrade?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            {user ? 'Check Balance' : 'Weekly Usage'}
          </DialogTitle>
          <DialogDescription className="text-center text-gray-600">
            {user ? 'Your current AI detection checks' : 'Free checks (no signup required)'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">
              {remainingChecks}
            </div>
            <p className="text-gray-600">checks remaining</p>
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
                You've used all your {user ? '' : 'free'} checks. 
                {user 
                  ? " Purchase more to continue detecting AI content!"
                  : " Sign up to get more checks and premium features!"
                }
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
            {user ? (
              <Button 
                onClick={handleUpgrade}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                Buy More
              </Button>
            ) : (
              <Button 
                asChild
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                <Link to="/auth">
                  Sign Up
                </Link>
              </Button>
            )}
          </div>
          
          {!user && (
            <div className="text-center">
              <p className="text-xs text-gray-500">
                Sign up to get unlimited weekly checks, usage history, and premium features
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UsageModal;
