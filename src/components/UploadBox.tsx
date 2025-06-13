
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
}

const UploadBox: React.FC<UploadBoxProps> = ({ 
  title, 
  description, 
  icon, 
  acceptedTypes, 
  onUpload 
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [textInput, setTextInput] = useState('');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setProgress(0);
    setIsComplete(false);

    // Simulate API calls with progress
    const steps = ['TheHive.ai', 'Originality.ai', 'Sensity.ai', 'GPT Analysis'];
    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setProgress((i + 1) * 25);
    }

    await onUpload(file);
    setIsComplete(true);
    setIsUploading(false);
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;

    setIsUploading(true);
    setProgress(0);
    setIsComplete(false);

    const steps = ['TheHive.ai', 'Originality.ai', 'Sensity.ai', 'GPT Analysis'];
    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setProgress((i + 1) * 25);
    }

    await onUpload(textInput);
    setIsComplete(true);
    setIsUploading(false);
    setTextInput('');
  };

  const isTextBox = title === 'Text';

  return (
    <Card className="glass-effect p-6 upload-hover border-white/20">
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

        {isUploading ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin text-white" />
              <span className="text-white text-sm">Analyzing with AI...</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-white/70 text-xs">
              {progress === 25 && "Checking with TheHive.ai..."}
              {progress === 50 && "Verifying with Originality.ai..."}
              {progress === 75 && "Scanning with Sensity.ai..."}
              {progress === 100 && "Generating final analysis..."}
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
            />
            <Button 
              onClick={handleTextSubmit}
              disabled={!textInput.trim()}
              className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30"
            >
              <Upload className="h-4 w-4 mr-2" />
              Analyze Text
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
            />
            <label htmlFor={`upload-${title.toLowerCase()}`}>
              <Button className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30 cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                Upload {title}
              </Button>
            </label>
          </div>
        )}
      </div>
    </Card>
  );
};

export default UploadBox;
