
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, Shield } from 'lucide-react';

interface ResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: {
    confidence: number;
    isAI: boolean;
    explanation: string;
    sources: string[];
  } | null;
}

const ResultModal: React.FC<ResultModalProps> = ({ isOpen, onClose, result }) => {
  if (!result) return null;

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceBadgeColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-100 text-green-800';
    if (confidence >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center flex items-center justify-center space-x-2">
            {result.isAI ? (
              <AlertTriangle className="h-6 w-6 text-orange-500" />
            ) : (
              <Shield className="h-6 w-6 text-green-500" />
            )}
            <span>Detection Result</span>
          </DialogTitle>
          <DialogDescription className="text-center text-gray-600">
            AI content analysis complete
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="text-center">
            <div className={`text-6xl font-bold mb-2 ${getConfidenceColor(result.confidence)}`}>
              {result.confidence}%
            </div>
            <Badge className={`mb-4 ${getConfidenceBadgeColor(result.confidence)}`}>
              {result.isAI ? 'Likely AI-Generated' : 'Likely Human-Created'}
            </Badge>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold mb-2 flex items-center">
              <CheckCircle className="h-4 w-4 mr-2 text-blue-600" />
              Analysis Summary
            </h4>
            <p className="text-gray-700 leading-relaxed">
              {result.explanation}
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">Detection Sources</h4>
            <div className="flex flex-wrap gap-2">
              {result.sources.map((source, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {source}
                </Badge>
              ))}
            </div>
          </div>
          
          <Button 
            onClick={onClose} 
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ResultModal;
