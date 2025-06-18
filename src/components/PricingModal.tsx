
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
import { ScrollArea } from '@/components/ui/scroll-area';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchase?: (plan: string) => void;
}

const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose, onPurchase }) => {
  const handlePurchase = async (plan: string) => {
    try {
      await onPurchase?.(plan);
      // Don't close the modal immediately - let the purchase function handle redirection
    } catch (error) {
      console.error('Purchase error:', error);
      // Only close on error
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl bg-white max-h-[90vh] p-0">
        <div className="p-6 pb-2">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">
              Choose Your Plan
            </DialogTitle>
            <DialogDescription className="text-center text-gray-600">
              Get more AI detection checks to analyze your content
            </DialogDescription>
          </DialogHeader>
        </div>
        
        <ScrollArea className="px-6 pb-6 max-h-[calc(90vh-120px)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 py-4">
            {/* Pay Per Use */}
            <div className="border rounded-lg p-4 sm:p-6 text-center">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Pay Per Use</h3>
                <div className="text-3xl font-bold text-blue-600 mt-2">$3</div>
                <p className="text-gray-600 text-sm">15 checks</p>
              </div>
              
              <ul className="space-y-2 mb-6 text-sm text-gray-600">
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  15 AI detection checks
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  Valid for 30 days
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
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

            {/* Monthly */}
            <div className="border-2 border-blue-500 rounded-lg p-4 sm:p-6 text-center">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Monthly</h3>
                <div className="text-3xl font-bold text-blue-600 mt-2">$12.99</div>
                <p className="text-gray-600 text-sm">per month</p>
              </div>
              
              <ul className="space-y-2 mb-6 text-sm text-gray-600">
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  Unlimited checks
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  All detection tools
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
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

            {/* Yearly */}
            <div className="border rounded-lg p-4 sm:p-6 text-center col-span-1 sm:col-span-2 lg:col-span-1 sm:max-w-sm sm:mx-auto lg:max-w-none lg:mx-0">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Yearly</h3>
                <div className="text-3xl font-bold text-blue-600 mt-2">$99</div>
                <p className="text-gray-600 text-sm">per year</p>
                <p className="text-green-600 text-xs font-medium mt-1">Save $56!</p>
              </div>
              
              <ul className="space-y-2 mb-6 text-sm text-gray-600">
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  Unlimited checks
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  All detection tools
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  Priority support
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
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
          
          <div className="text-center pt-4 border-t mt-4">
            <p className="text-xs text-gray-500">
              Secure payment processing • Cancel anytime • 30-day money back guarantee
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default PricingModal;
