
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
    if (confidence >= 80) return 'text-green-600 dark:text-green-400';
    if (confidence >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getConfidenceBadgeColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (confidence >= 60) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center flex items-center justify-center space-x-2 text-gray-900 dark:text-gray-100">
            {result.isAI ? (
              <AlertTriangle className="h-6 w-6 text-orange-500 dark:text-orange-400" />
            ) : (
              <Shield className="h-6 w-6 text-green-500 dark:text-green-400" />
            )}
            <span>Detection Result</span>
          </DialogTitle>
          <DialogDescription className="text-center text-gray-600 dark:text-gray-400">
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
          
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
            <h4 className="font-semibold mb-2 flex items-center text-gray-900 dark:text-gray-100">
              <CheckCircle className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
              Analysis Summary
            </h4>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {result.explanation}
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Detection Sources</h4>
            <div className="flex flex-wrap gap-2">
              {result.sources.map((source, index) => (
                <Badge key={index} variant="outline" className="text-xs border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800">
                  {source}
                </Badge>
              ))}
            </div>
          </div>
          
          <Button 
            onClick={onClose} 
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 dark:from-blue-700 dark:to-purple-700 dark:hover:from-blue-800 dark:hover:to-purple-800 text-white"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ResultModal;
