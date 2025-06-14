import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import UploadBox from '@/components/UploadBox';
import UsageModal from '@/components/UsageModal';
import ResultModal from '@/components/ResultModal';
import PricingModal from '@/components/PricingModal';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseUsageTracking } from '@/hooks/useSupabaseUsageTracking';
import { useIPUsageTracking } from '@/hooks/useIPUsageTracking';
import { supabase } from '@/integrations/supabase/client';
import { Eye, FileText, Image as ImageIcon, LogIn, UserPlus, CreditCard, LogOut } from 'lucide-react';

const Index = () => {
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const { user, signOut } = useAuth();
  
  // Use different tracking hooks based on auth status
  const authenticatedTracking = useSupabaseUsageTracking();
  const anonymousTracking = useIPUsageTracking();
  
  // Choose the appropriate tracking system
  const tracking = user ? authenticatedTracking : anonymousTracking;
  const { remainingChecks, totalChecks, useCheck, loading } = tracking;
  
  const { toast } = useToast();

  const handleUpload = async (content: File | string) => {
    console.log('handleUpload called with:', typeof content === 'string' ? 'text content' : 'file:', content);
    
    if (!useCheck()) {
      toast({
        title: "No checks remaining",
        description: user 
          ? "You've used all your free checks this week. Upgrade to continue!"
          : "You've used all your free checks this week. Sign up for more!",
        variant: "destructive",
      });
      setShowUsageModal(true);
      return;
    }

    try {
      let requestBody: { text?: string; image?: string } = {};
      
      // Handle file upload vs direct text
      if (typeof content === 'string') {
        console.log('Processing text content');
        requestBody.text = content;
      } else {
        console.log('Processing file content, type:', content.type);
        // Handle file type - text or image
        if (content.type.startsWith('image/')) {
          console.log('Converting image to base64');
          // Convert image to base64
          const arrayBuffer = await content.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          requestBody.image = `data:${content.type};base64,${base64}`;
        } else {
          console.log('Reading text file');
          // Handle text file
          const textContent = await content.text();
          requestBody.text = textContent;
        }
      }

      console.log('Sending request to analyze-text function');

      // Call the actual OpenAI edge function
      const { data, error } = await supabase.functions.invoke('analyze-text', {
        body: requestBody
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error('Failed to analyze content');
      }

      console.log('AI analysis result:', data);
      
      setAnalysisResult(data);
      setShowResultModal(true);
      
      toast({
        title: "Analysis complete!",
        description: `Detection confidence: ${data.confidence}%`,
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis failed",
        description: "There was an error analyzing your content. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleBuyMoreChecks = () => {
    setShowPricingModal(true);
  };

  const handleUpgrade = () => {
    setShowPricingModal(true);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed out",
        description: "You've been signed out successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen gradient-bg">
      <div className="container mx-auto px-4 py-8">
        {/* Top Navigation */}
        <div className="flex justify-end mb-8">
          <div className="flex space-x-2">
            {user ? (
              <div className="flex items-center space-x-2">
                <span className="text-white/80 text-sm">
                  Welcome back!
                </span>
                <Button
                  onClick={handleSignOut}
                  variant="outline"
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            ) : (
              <>
                <Button
                  asChild
                  variant="outline"
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                >
                  <Link to="/auth">
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign In
                  </Link>
                </Button>
                <Button
                  asChild
                  className="bg-white text-purple-600 hover:bg-white/90"
                >
                  <Link to="/auth">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Sign Up
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            Is This Real Or AI?
          </h1>
          <p className="text-xl text-white/80 mb-6">
            We run your content through 27 expert AI tools — and give you one easy verdict.
          </p>
          {!loading && (
            <div className="flex flex-col items-center space-y-4">
              <div className="flex justify-center space-x-4">
                <Button
                  onClick={() => setShowUsageModal(true)}
                  variant="outline"
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {remainingChecks} Free Checks left • No signup required
                </Button>
                {user && (
                  <Button
                    onClick={handleBuyMoreChecks}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Buy More Checks
                  </Button>
                )}
              </div>
              {!user && (
                <Button
                  asChild
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                >
                  <Link to="/auth">
                    Sign up for more checks & features
                  </Link>
                </Button>
              )}
            </div>
          )}
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
            acceptedTypes="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/bmp,image/tiff"
            disabled={false}
            onUpload={handleUpload}
          />
          
          <UploadBox
            title="Video"
            description="Identify deepfakes and AI-generated videos"
            icon={<Eye className="h-12 w-12 text-white" />}
            acceptedTypes="video/*"
            disabled={true}
            onUpload={handleUpload}
          />
        </div>

        {/* Footer */}
        <div className="text-center mt-16">
          <p className="text-white/60 text-sm">
            © 2025 A Vobius Labs Product
          </p>
        </div>
      </div>

      {/* Modals */}
      <UsageModal
        isOpen={showUsageModal}
        onClose={() => setShowUsageModal(false)}
        remainingChecks={remainingChecks}
        totalChecks={totalChecks}
        onUpgrade={user ? handleUpgrade : () => {}}
      />
      
      <ResultModal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        result={analysisResult}
      />

      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
      />
    </div>
  );
};

export default Index;
