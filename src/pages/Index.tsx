import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import UploadBox from '@/components/UploadBox';
import UsageModal from '@/components/UsageModal';
import ResultModal from '@/components/ResultModal';
import PricingModal from '@/components/PricingModal';
import { useAuth } from '@/contexts/AuthContext';
import { useStripeSubscription } from '@/hooks/useStripeSubscription';
import { useIPUsageTracking } from '@/hooks/useIPUsageTracking';
import { supabase } from '@/integrations/supabase/client';
import { Eye, FileText, Image as ImageIcon, LogIn, UserPlus, CreditCard, LogOut, Video } from 'lucide-react';

const Index = () => {
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const { user, signOut } = useAuth();
  
  // Use Stripe subscription tracking for authenticated users
  const { 
    subscribed, 
    subscription_tier, 
    remaining_checks: authRemainingChecks, 
    useCheck: useAuthCheck, 
    loading: authLoading,
    createCheckout,
    openCustomerPortal 
  } = useStripeSubscription();

  // Use IP-based tracking for non-authenticated users
  const {
    remainingChecks: ipRemainingChecks,
    totalChecks: ipTotalChecks,
    useCheck: useIPCheck,
    loading: ipLoading
  } = useIPUsageTracking();
  
  const { toast } = useToast();

  // Determine which tracking system to use and if user has unlimited access
  const loading = user ? authLoading : ipLoading;
  const hasUnlimitedAccess = user && subscribed && (subscription_tier === 'monthly' || subscription_tier === 'yearly');
  
  // For display purposes - handle infinity properly
  const remaining_checks = user ? 
    (hasUnlimitedAccess ? 999999 : authRemainingChecks) : 
    ipRemainingChecks;
  
  // Calculate weekly total for usage tracking (different from display total)
  let weeklyTotal;
  if (user && !hasUnlimitedAccess) {
    // For authenticated pay-per-use users, we need to calculate their weekly starting total
    // This should be 3 (free weekly) + any purchased checks they had at the start of the week
    // For now, we'll estimate this based on their current remaining checks
    // If they have more than 3 remaining, they must have purchased some
    if (authRemainingChecks > 3) {
      // They have purchased checks, so weekly total includes purchased amount
      // Estimate: current remaining + already used (assuming they started with current + some used amount)
      weeklyTotal = Math.max(authRemainingChecks + 5, 18); // Rough estimate, should be improved with better tracking
    } else {
      // They're using free checks only
      weeklyTotal = 3;
    }
  }

  // Simple total for display in buttons (not for usage bar)
  const displayTotal = user ? 
    (hasUnlimitedAccess ? 999999 : authRemainingChecks) : 
    ipTotalChecks;

  const useCheck = (): boolean => {
    // Unlimited access for active subscribers
    if (hasUnlimitedAccess) {
      return true;
    }
    
    // Use appropriate tracking system for non-unlimited users
    if (user) {
      return useAuthCheck();
    } else {
      return useIPCheck();
    }
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleUpload = async (content: File | string) => {
    console.log('handleUpload called with:', typeof content === 'string' ? 'text/url content' : 'file:', content);
    
    if (!useCheck()) {
      toast({
        title: "No checks remaining",
        description: user 
          ? subscribed 
            ? "Something went wrong with your subscription. Please contact support."
            : "You've used all your checks. Purchase more to continue!"
          : "You've used all your free checks this week. Sign up for more!",
        variant: "destructive",
      });
      // Only show usage modal for non-unlimited users
      if (!hasUnlimitedAccess) {
        setShowUsageModal(true);
      }
      return;
    }

    try {
      let requestBody: { text?: string; image?: string; video?: string; videoUrl?: string } = {};
      
      // Handle file upload vs direct text vs video URL
      if (typeof content === 'string') {
        if (content.startsWith('VIDEO_URL:')) {
          // Handle video URL - more robust processing
          const videoUrl = content.replace('VIDEO_URL:', '').trim();
          console.log('Processing video URL:', videoUrl);
          
          // Validate URL format
          try {
            new URL(videoUrl);
            requestBody.videoUrl = videoUrl;
          } catch (urlError) {
            throw new Error('Invalid video URL format');
          }
        } else {
          // Handle regular text content
          console.log('Processing text content');
          requestBody.text = content.trim();
        }
      } else {
        console.log('Processing file content, type:', content.type);
        // Handle file type - text, image, or video
        if (content.type.startsWith('image/')) {
          console.log('Converting image to base64 using FileReader');
          try {
            const base64Data = await convertFileToBase64(content);
            requestBody.image = base64Data;
            console.log('Image conversion successful, size:', base64Data.length);
          } catch (conversionError) {
            console.error('Image conversion failed:', conversionError);
            throw new Error('Failed to process image file');
          }
        } else if (content.type.startsWith('video/')) {
          console.log('Converting video to base64 using FileReader');
          try {
            const base64Data = await convertFileToBase64(content);
            requestBody.video = base64Data;
            console.log('Video conversion successful, size:', base64Data.length);
          } catch (conversionError) {
            console.error('Video conversion failed:', conversionError);
            throw new Error('Failed to process video file');
          }
        } else {
          console.log('Reading text file');
          // Handle text file
          try {
            const textContent = await content.text();
            requestBody.text = textContent.trim();
          } catch (textError) {
            throw new Error('Failed to read text file');
          }
        }
      }

      console.log('Sending request to analyze-text function');

      // Call the actual OpenAI edge function
      const { data, error } = await supabase.functions.invoke('analyze-text', {
        body: requestBody
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error('Failed to analyze content. Please try again later.');
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
        description: error instanceof Error ? error.message : "There was an error analyzing your content. Please try again.",
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

  const handlePurchase = async (plan: string) => {
    try {
      console.log('Creating checkout for plan:', plan);
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { plan }
      });

      if (error) {
        console.error('Checkout creation error:', error);
        throw new Error(error.message || 'Failed to create checkout session');
      }

      if (!data?.url) {
        throw new Error('No checkout URL received');
      }

      console.log('Checkout URL received:', data.url);
      
      // Close the pricing modal first
      setShowPricingModal(false);
      
      // Small delay to ensure modal closes before redirect
      setTimeout(() => {
        // On mobile, use window.location.href for better compatibility
        if (window.innerWidth <= 768) {
          window.location.href = data.url;
        } else {
          // On desktop, open in new tab
          window.open(data.url, '_blank');
        }
      }, 100);

      toast({
        title: "Redirecting to checkout",
        description: "Please complete your purchase in the new window.",
      });
    } catch (error) {
      console.error('Purchase error:', error);
      toast({
        title: "Checkout failed",
        description: error instanceof Error ? error.message : "Failed to create checkout session. Please try again.",
        variant: "destructive",
      });
      throw error; // Re-throw to prevent modal from closing in PricingModal
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed out",
        description: "You've been signed out successfully.",
      });
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getUsageText = () => {
    if (user && subscribed) {
      // Handle different subscription tiers properly
      if (subscription_tier === 'monthly') {
        return `Unlimited checks • Monthly plan`;
      } else if (subscription_tier === 'yearly') {
        return `Unlimited checks • Yearly plan`;
      } else {
        return `Unlimited checks`;
      }
    }
    
    if (user && subscription_tier === 'pay-per-use') {
      return `${authRemainingChecks} checks remaining • Pay-per-use`;
    }
    
    // Only show "no signup required" for non-authenticated users
    if (!user) {
      return `${remaining_checks} Free Checks left this week • No signup required`;
    }
    
    // For authenticated users without subscription
    return `${remaining_checks} Free Checks left this week`;
  };

  const shouldShowUsageButton = () => {
    // Don't show usage button for unlimited subscribers (monthly/yearly)
    return !hasUnlimitedAccess;
  };

  return (
    <div className="min-h-screen gradient-bg">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        {/* Top Navigation - Mobile Optimized */}
        <div className="flex justify-end mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            {user ? (
              <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2">
                <span className="text-white/80 text-sm text-center sm:text-left">
                  Welcome back!
                </span>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                  {(subscribed || subscription_tier === 'pay-per-use') && (
                    <Button
                      onClick={openCustomerPortal}
                      variant="outline"
                      className="bg-white/10 border-white/30 text-white hover:bg-white/20 text-sm"
                      size="sm"
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Manage Subscription</span>
                      <span className="sm:hidden">Manage</span>
                    </Button>
                  )}
                  <Button
                    onClick={handleSignOut}
                    variant="outline"
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20 text-sm"
                    size="sm"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <Button
                  asChild
                  variant="outline"
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20 text-sm"
                  size="sm"
                >
                  <Link to="/auth?mode=signin">
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign In
                  </Link>
                </Button>
                <Button
                  asChild
                  className="bg-white text-purple-600 hover:bg-white/90 text-sm"
                  size="sm"
                >
                  <Link to="/auth?mode=signup">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Sign Up
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Header - Mobile Optimized */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Is This Real Or AI?
          </h1>
          <p className="text-lg sm:text-xl text-white/80 mb-6 px-2">
            We run your content through 27 expert AI tools — and give you one simple answer.
          </p>
          {!loading && (
            <div className="flex flex-col items-center space-y-4">
              <div className="flex flex-col sm:flex-row justify-center space-y-2 sm:space-y-0 sm:space-x-4">
                {shouldShowUsageButton() && (
                  <Button
                    onClick={() => setShowUsageModal(true)}
                    variant="outline"
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20 text-sm"
                    size="sm"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    <span className="text-center">{getUsageText()}</span>
                  </Button>
                )}
                {user && !subscribed && (
                  <Button
                    onClick={handleBuyMoreChecks}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm"
                    size="sm"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Buy More Checks
                  </Button>
                )}
                {hasUnlimitedAccess && (
                  <div className="bg-white/10 border border-white/30 text-white px-4 py-2 rounded-md text-sm flex items-center">
                    <Eye className="h-4 w-4 mr-2" />
                    <span>{getUsageText()}</span>
                  </div>
                )}
              </div>
              {!user && (
                <Button
                  asChild
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm"
                  size="sm"
                >
                  <Link to="/auth?mode=signup">
                    Sign up for more checks & features
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Upload Boxes - Mobile Optimized */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 max-w-6xl mx-auto px-2 sm:px-0">
          <UploadBox
            title="Text"
            description="Analyze written content for AI generation patterns"
            icon={<FileText className="h-10 w-10 sm:h-12 sm:w-12 text-white" />}
            acceptedTypes="text/*"
            onUpload={handleUpload}
          />
          
          <UploadBox
            title="Image"
            description="Detect AI-generated or manipulated images"
            icon={<ImageIcon className="h-10 w-10 sm:h-12 sm:w-12 text-white" />}
            acceptedTypes="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/bmp,image/tiff"
            disabled={false}
            onUpload={handleUpload}
          />
          
          <UploadBox
            title="Video"
            description="Identify deepfakes and AI-generated videos"
            icon={<Video className="h-10 w-10 sm:h-12 sm:w-12 text-white" />}
            acceptedTypes="video/mp4,video/avi,video/mov,video/wmv,video/flv,video/webm,video/mkv"
            disabled={false}
            onUpload={handleUpload}
          />
        </div>

        {/* Footer */}
        <div className="text-center mt-12 sm:mt-16">
          <p className="text-white/60 text-sm">
            © 2025 A Vobius Labs Product
          </p>
          <p className="text-white/50 text-xs mt-1">
            Labs@vobius.com
          </p>
        </div>
      </div>

      {/* Modals */}
      <UsageModal
        isOpen={showUsageModal}
        onClose={() => setShowUsageModal(false)}
        remainingChecks={remaining_checks}
        totalChecks={user ? ipTotalChecks : ipTotalChecks} // Use simple total for non-auth users
        weeklyTotal={weeklyTotal} // Pass weekly total for proper usage calculation
        onUpgrade={user ? handleUpgrade : () => {}}
        isSubscribed={hasUnlimitedAccess}
      />
      
      <ResultModal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        result={analysisResult}
      />

      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        onPurchase={handlePurchase}
      />
    </div>
  );
};

export default Index;
