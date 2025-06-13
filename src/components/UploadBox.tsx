
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Upload, Loader2 } from 'lucide-react';

interface UploadBoxProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  acceptedTypes: string;
  onUpload: (file: File | string) => Promise<void>;
  isAnalyzing?: boolean;
  disabled?: boolean;
}

const UploadBox: React.FC<UploadBoxProps> = ({ 
  title, 
  description, 
  icon, 
  acceptedTypes, 
  onUpload,
  isAnalyzing = false,
  disabled = false
}) => {
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [textInput, setTextInput] = useState('');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    
    const file = event.target.files?.[0];
    if (!file) return;

    setProgress(0);
    setIsComplete(false);

    // Simulate progress during analysis
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 300);

    try {
      await onUpload(file);
      setProgress(100);
      setIsComplete(true);
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      clearInterval(progressInterval);
    }
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim() || disabled) return;

    setProgress(0);
    setIsComplete(false);

    // Simulate progress during analysis
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 300);

    try {
      await onUpload(textInput);
      setProgress(100);
      setIsComplete(true);
      setTextInput('');
    } catch (error) {
      console.error('Text analysis error:', error);
    } finally {
      clearInterval(progressInterval);
    }
  };

  const isTextBox = title === 'Text';
  const showProgress = isAnalyzing || progress > 0;

  return (
    <Card className={`glass-effect p-6 upload-hover border-white/20 ${disabled ? 'opacity-50' : ''}`}>
      <div className="text-center">
        <div className="mb-4 flex justify-center text-white">
          {isComplete ? (
            <CheckCircle className="h-12 w-12 text-green-400" />
          ) : (
            <div className="h-12 w-12">{icon}</div>
          )}
        </div>
        
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-white/80 mb-4 text-sm">{description}</p>

        {showProgress ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin text-white" />
              <span className="text-white text-sm">Analyzing with AI...</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-white/70 text-xs">
              {progress <= 25 && "Connecting to AI analysis..."}
              {progress > 25 && progress <= 50 && "Processing content..."}
              {progress > 50 && progress <= 75 && "Detecting patterns..."}
              {progress > 75 && progress < 100 && "Generating results..."}
              {progress === 100 && "Analysis complete!"}
            </p>
          </div>
        ) : isComplete ? (
          <div className="text-green-400">
            <CheckCircle className="h-6 w-6 mx-auto mb-2" />
            <p className="text-sm">Analysis Complete!</p>
          </div>
        ) : isTextBox ? (
          <div className="space-y-4">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Paste your text here to analyze..."
              className="w-full p-3 rounded-lg bg-white/10 text-white placeholder:text-white/50 border border-white/20 resize-none h-24"
              disabled={disabled}
            />
            <Button 
              onClick={handleTextSubmit}
              disabled={!textInput.trim() || disabled}
              className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30 disabled:opacity-50"
            >
              <Upload className="h-4 w-4 mr-2" />
              {disabled ? 'Coming Soon' : 'Analyze Text'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <input
              type="file"
              accept={acceptedTypes}
              onChange={handleFileUpload}
              className="hidden"
              id={`upload-${title.toLowerCase()}`}
              disabled={disabled}
            />
            <label htmlFor={disabled ? '' : `upload-${title.toLowerCase()}`}>
              <Button 
                className={`w-full bg-white/20 hover:bg-white/30 text-white border border-white/30 disabled:opacity-50 ${disabled ? '' : 'cursor-pointer'}`}
                disabled={disabled}
              >
                <Upload className="h-4 w-4 mr-2" />
                {disabled ? 'Coming Soon' : `Upload ${title}`}
              </Button>
            </label>
          </div>
        )}
      </div>
    </Card>
  );
};

export default UploadBox;
