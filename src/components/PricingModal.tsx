
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, CreditCard } from 'lucide-react';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchase?: (plan: string) => void;
}

const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose, onPurchase }) => {
  const handlePurchase = (plan: string) => {
    onPurchase?.(plan);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            Choose Your Plan
          </DialogTitle>
          <DialogDescription className="text-center text-gray-600">
            Get more AI detection checks to analyze your content
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid md:grid-cols-3 gap-6 py-6">
          {/* Pay Per Use */}
          <div className="border rounded-lg p-6 text-center">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Pay Per Use</h3>
              <div className="text-3xl font-bold text-blue-600 mt-2">$3</div>
              <p className="text-gray-600 text-sm">15 checks</p>
            </div>
            
            <ul className="space-y-2 mb-6 text-sm text-gray-600">
              <li className="flex items-center">
                <Check className="h-4 w-4 text-green-500 mr-2" />
                15 AI detection checks
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 text-green-500 mr-2" />
                Valid for 30 days
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 text-green-500 mr-2" />
                All detection tools
              </li>
            </ul>
            
            <Button 
              onClick={() => handlePurchase('pay-per-use')}
              variant="outline"
              className="w-full"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Purchase
            </Button>
          </div>

          {/* Monthly - Updated to $12.99 */}
          <div className="border-2 border-blue-500 rounded-lg p-6 text-center">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Monthly</h3>
              <div className="text-3xl font-bold text-blue-600 mt-2">$12.99</div>
              <p className="text-gray-600 text-sm">per month</p>
            </div>
            
            <ul className="space-y-2 mb-6 text-sm text-gray-600">
              <li className="flex items-center">
                <Check className="h-4 w-4 text-green-500 mr-2" />
                Unlimited checks
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 text-green-500 mr-2" />
                All detection tools
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 text-green-500 mr-2" />
                Priority support
              </li>
            </ul>
            
            <Button 
              onClick={() => handlePurchase('monthly')}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Subscribe
            </Button>
          </div>

          {/* Yearly - Adjusted for new monthly price */}
          <div className="border rounded-lg p-6 text-center">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Yearly</h3>
              <div className="text-3xl font-bold text-blue-600 mt-2">$129</div>
              <p className="text-gray-600 text-sm">per year</p>
              <p className="text-green-600 text-xs font-medium mt-1">Save $27!</p>
            </div>
            
            <ul className="space-y-2 mb-6 text-sm text-gray-600">
              <li className="flex items-center">
                <Check className="h-4 w-4 text-green-500 mr-2" />
                Unlimited checks
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 text-green-500 mr-2" />
                All detection tools
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 text-green-500 mr-2" />
                Priority support
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 text-green-500 mr-2" />
                Annual billing discount
              </li>
            </ul>
            
            <Button 
              onClick={() => handlePurchase('yearly')}
              variant="outline"
              className="w-full"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Subscribe
            </Button>
          </div>
        </div>
        
        <div className="text-center pt-4 border-t">
          <p className="text-xs text-gray-500">
            Secure payment processing • Cancel anytime • 30-day money back guarantee
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PricingModal;
