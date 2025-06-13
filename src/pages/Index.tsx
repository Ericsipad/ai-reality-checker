import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import UploadBox from '@/components/UploadBox';
import UsageModal from '@/components/UsageModal';
import ResultModal from '@/components/ResultModal';
import { useUsageTracking } from '@/hooks/useUsageTracking';
import { Eye, FileText, Image as ImageIcon } from 'lucide-react';

const Index = () => {
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const { remainingChecks, totalChecks, useCheck } = useUsageTracking();
  const { toast } = useToast();

  // Mock analysis results
  const generateMockResult = () => {
    const results = [
      {
        confidence: 87,
        isAI: true,
        explanation: "This content shows several indicators of AI generation, including repetitive sentence structures, unnatural word choices, and lack of personal voice. The writing style is consistent with large language model outputs, particularly in its formal tone and generic phrasing patterns.",
        sources: ["TheHive.ai", "Originality.ai", "GPT Analysis"]
      },
      {
        confidence: 92,
        isAI: false,
        explanation: "This appears to be authentic human-created content. The writing exhibits natural variations in sentence length, personal anecdotes, and spontaneous thought patterns typical of human expression. No significant AI-generation markers were detected across our analysis tools.",
        sources: ["TheHive.ai", "Originality.ai", "Sensity.ai", "GPT Analysis"]
      },
      {
        confidence: 76,
        isAI: true,
        explanation: "Moderate confidence that this is AI-generated content. While some elements appear natural, the overall structure and certain phrase patterns suggest algorithmic generation. The content lacks the inconsistencies and personal touches typically found in human writing.",
        sources: ["Originality.ai", "GPT Analysis"]
      }
    ];
    
    return results[Math.floor(Math.random() * results.length)];
  };

  const handleUpload = async (content: File | string) => {
    if (!useCheck()) {
      toast({
        title: "No checks remaining",
        description: "You've used all your free checks this week. Upgrade to continue!",
        variant: "destructive",
      });
      setShowUsageModal(true);
      return;
    }

    // Simulate API processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const result = generateMockResult();
    setAnalysisResult(result);
    setShowResultModal(true);
    
    toast({
      title: "Analysis complete!",
      description: `Detection confidence: ${result.confidence}%`,
    });
  };

  return (
    <div className="min-h-screen gradient-bg">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            IsThisRealOrAI
          </h1>
          <p className="text-xl text-white/80 mb-6">
            Using 27 paid AI detection APIs to confidently determine the authenticity of your content
          </p>
          <div className="flex justify-center space-x-4">
            <Button
              onClick={() => setShowUsageModal(true)}
              variant="outline"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              <Eye className="h-4 w-4 mr-2" />
              {remainingChecks} checks left
            </Button>
          </div>
        </div>

        {/* Upload Boxes */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <UploadBox
            title="Text"
            description="Analyze written content for AI generation patterns"
            icon={<FileText className="h-12 w-12 text-white" />}
            acceptedTypes="text/*"
            onUpload={handleUpload}
          />
          
          <UploadBox
            title="Image"
            description="Detect AI-generated or manipulated images"
            icon={<ImageIcon className="h-12 w-12 text-white" />}
            acceptedTypes="image/*"
            onUpload={handleUpload}
          />
          
          <UploadBox
            title="Video"
            description="Identify deepfakes and AI-generated videos"
            icon={<Eye className="h-12 w-12 text-white" />}
            acceptedTypes="video/*"
            onUpload={handleUpload}
          />
        </div>

        {/* Footer */}
        <div className="text-center mt-16">
          <p className="text-white/60 text-sm">
            Powered by TheHive.ai, Originality.ai, Sensity.ai, and OpenAI GPT
          </p>
        </div>
      </div>

      {/* Modals */}
      <UsageModal
        isOpen={showUsageModal}
        onClose={() => setShowUsageModal(false)}
        remainingChecks={remainingChecks}
        totalChecks={totalChecks}
      />
      
      <ResultModal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        result={analysisResult}
      />
    </div>
  );
};

export default Index;
