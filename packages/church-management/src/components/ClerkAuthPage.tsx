import React, { useState } from 'react';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { Shield, UserPlus, LogIn } from 'lucide-react';

const ClerkAuthPage: React.FC = () => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-4">
      {/* Top Logo - Always visible on mobile */}
      <div className="lg:hidden w-full flex justify-center mb-8">
        <div className="flex flex-col items-center space-y-3 bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
          <img
            src="/hkm-logo.webp"
            alt="Heavenly God Kingdom Churches Logo"
            className="h-16 w-auto drop-shadow-2xl border border-white/20 rounded-lg p-2 bg-sky-100 object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">HKM Ministries</h1>
            <span className="text-green-400 text-sm font-medium">Church Management System</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left Side: Branding & Info */}
        <div className="hidden lg:flex flex-col space-y-8 text-white p-8">
          {/* Large prominent logo with fallback */}
          <div className="flex flex-col items-center lg:items-start space-y-4 mb-8">
            <div className="relative">
              <img
                src="/hkm-logo.webp"
                alt="Heavenly God Kingdom Churches Logo"
                className="h-24 w-auto drop-shadow-2xl border-2 border-green-500/30 rounded-lg p-3 bg-sky-100 object-contain"
                onError={(e) => {
                  const fallback = document.createElement('div');
                  fallback.className =
                    'h-24 w-24 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold text-2xl';
                  fallback.textContent = 'HKM';
                  e.currentTarget.parentNode?.replaceChild(fallback, e.currentTarget);
                }}
              />
            </div>
            <div className="text-center lg:text-left">
              <h1 className="text-4xl font-bold tracking-tight">HKM Ministries</h1>
              <span className="text-green-400 text-lg font-medium">Church Management System</span>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-5xl font-extrabold leading-tight">
              Church Management <span className="text-green-500">Simplified.</span>
            </h2>
            <p className="text-xl text-slate-400 max-w-lg">
              Empowering your ministry with real-time data, membership tracking, and seamless financial management on a
              secure, enterprise-grade platform.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-8">
            {[
              { label: 'Real-time Sync', icon: Shield },
              { label: 'Secure Access', icon: Shield },
              { label: 'Financial Tools', icon: Shield },
              { label: 'Member Tracking', icon: Shield },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-slate-300">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Auth Component */}
        <div className="flex flex-col items-center">
          <div className="w-full max-w-md bg-white/5 backdrop-blur-xl rounded-3xl p-1 border border-white/10 shadow-2xl">
            <div className="flex p-1 gap-1 mb-8 bg-black/20 rounded-2xl">
              <button
                onClick={() => setMode('signin')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold transition-all ${
                  mode === 'signin'
                    ? 'bg-green-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </button>
              <button
                onClick={() => setMode('signup')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold transition-all ${
                  mode === 'signup'
                    ? 'bg-green-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                Register
              </button>
            </div>

            <div className="p-4 clerk-container relative">
              {/* Subtle background logo */}
              <div className="absolute top-4 right-4 opacity-10">
                <img
                  src="/hkm-logo.webp"
                  alt="Heavenly God Kingdom Churches Logo"
                  className="h-8 w-auto object-contain"
                />
              </div>

              {mode === 'signin' ? (
                <SignIn
                  routing="hash"
                  appearance={{
                    elements: {
                      rootBox: 'w-full',
                      card: 'bg-transparent shadow-none border-none p-0',
                      headerTitle: 'text-white text-2xl font-bold',
                      headerSubtitle: 'text-slate-400',
                      socialButtonsBlockButton:
                        'bg-white/5 border-white/10 text-white hover:bg-white/10 transition-colors',
                      socialButtonsBlockButtonText: 'font-medium',
                      dividerLine: 'bg-white/10',
                      dividerText: 'text-slate-500',
                      formFieldLabel: 'text-slate-300 font-medium mb-1.5',
                      formFieldInput:
                        'bg-white/5 border-white/10 text-white focus:border-green-500 focus:ring-green-500/20 rounded-xl py-3',
                      formButtonPrimary:
                        'bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-green-900/20 transition-all',
                      footerActionText: 'text-slate-400',
                      footerActionLink: 'text-green-500 hover:text-green-400 font-bold',
                      identityPreviewText: 'text-white',
                      identityPreviewEditButtonIcon: 'text-green-500',
                    },
                  }}
                />
              ) : (
                <SignUp
                  routing="hash"
                  signInUrl="/#sign-in"
                  unsafeMetadata={{ role: 'member' }}
                  appearance={{
                    elements: {
                      rootBox: 'w-full',
                      card: 'bg-transparent shadow-none border-none p-0',
                      headerTitle: 'text-white text-2xl font-bold',
                      headerSubtitle: 'text-slate-400',
                      socialButtonsBlockButton:
                        'bg-white/5 border-white/10 text-white hover:bg-white/10 transition-colors',
                      formFieldLabel: 'text-slate-300 font-medium mb-1.5',
                      formFieldInput:
                        'bg-white/5 border-white/10 text-white focus:border-green-500 focus:ring-green-500/20 rounded-xl py-3',
                      formButtonPrimary:
                        'bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-green-900/20 transition-all',
                      footerActionText: 'text-slate-400',
                      footerActionLink: 'text-green-500 hover:text-green-400 font-bold',
                      formFieldAction__phoneNumber: 'hidden', // Attempt to hide via CSS classes
                    },
                  }}
                />
              )}
            </div>
          </div>

          <div className="mt-8 flex items-center gap-2 text-slate-500 text-sm">
            <Shield className="w-4 h-4" />
            <span>Secure Enterprise Authentication</span>
          </div>
        </div>
      </div>

      <style>{`
        .clerk-container .cl-internal-b3fm6y { display: none !important; } /* Hide powered by clerk */
        .clerk-container .cl-card { margin: 0 !important; max-width: 100% !important; }
      `}</style>
    </div>
  );
};

export default ClerkAuthPage;
