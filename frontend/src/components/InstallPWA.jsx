import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

const InstallPWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      toast.success('App installed!');
    }
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 z-50 bg-gradient-to-r from-red-700 to-black text-white rounded-2xl p-4 shadow-2xl flex items-center gap-3">
      <span className="text-2xl">🎮</span>
      <div className="flex-1">
        <p className="font-bold text-sm">Install Ludo Cash Play</p>
        <p className="text-xs text-white/70">Play faster from home screen</p>
      </div>
      <button
        onClick={handleInstall}
        className="bg-white text-red-700 px-4 py-2 rounded-xl font-bold text-sm"
      >
        Install
      </button>
      <button
        onClick={() => setShowBanner(false)}
        className="text-white/70 text-xl font-bold leading-none"
      >
        ×
      </button>
    </div>
  );
};

export default InstallPWA;
