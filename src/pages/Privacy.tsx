
import React from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Privacy = () => {
  return (
    <div className="min-h-screen gradient-bg">
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-4xl">
        {/* Back Button */}
        <div className="mb-6">
          <Button
            asChild
            variant="outline"
            className="bg-white/10 border-white/30 text-white hover:bg-white/20"
          >
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
          </Button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Privacy Policy
          </h1>
          <p className="text-white/80">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Content */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 sm:p-8 text-white space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">Information We Collect</h2>
            <p className="text-white/90 leading-relaxed">
              IsThisRealOrAI only keeps your email address for subscription tracking and login services. 
              We do not keep any content that is uploaded for checks. All uploaded content is processed 
              temporarily and immediately deleted after analysis.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">How We Use Your Information</h2>
            <ul className="text-white/90 leading-relaxed space-y-2 list-disc list-inside">
              <li>Email addresses are used solely for account authentication and subscription management</li>
              <li>Usage tracking helps us monitor service limits and prevent abuse</li>
              <li>Payment information is processed securely through Stripe and not stored on our servers</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Data Retention</h2>
            <p className="text-white/90 leading-relaxed">
              We retain your email address and account information only as long as your account is active. 
              All uploaded content (text, images, videos) is processed in real-time and immediately deleted 
              after analysis - we do not store any of your uploaded content.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Cookies and Tracking</h2>
            <p className="text-white/90 leading-relaxed">
              We use cookies and local storage to maintain your login session and track usage limits. 
              These are essential for the service to function properly. We do not use third-party 
              tracking cookies for advertising purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Third-Party Services</h2>
            <p className="text-white/90 leading-relaxed">
              We use Supabase for authentication and database services, and Stripe for payment processing. 
              These services have their own privacy policies and security measures in place.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Your Rights</h2>
            <p className="text-white/90 leading-relaxed">
              You have the right to access, update, or delete your account information at any time. 
              You can also request a copy of your data or ask us to delete your account entirely.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Contact Us</h2>
            <p className="text-white/90 leading-relaxed">
              If you have any questions about this Privacy Policy or your data, please contact us at:{' '}
              <a href="mailto:Labs@vobius.com" className="text-blue-300 hover:text-blue-200 underline">
                Labs@vobius.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
