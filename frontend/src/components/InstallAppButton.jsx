import React, { useState, useEffect } from 'react';

const InstallAppButton = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);
    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleClick = async () => {
    if (isIOS) { setShowIOSHelp(true); return; }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else {
      setShowIOSHelp(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="w-full py-3 bg-gradient-to-r from-red-700 to-black text-white rounded-xl font-bold flex items-center justify-center gap-2"
      >
        📲 Download App
      </button>

      {showIOSHelp && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowIOSHelp(false)}>
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-3">Install MyAkadda App</h3>
            <p className="text-sm text-gray-700 mb-2">On iPhone (Safari):</p>
            <ol className="text-sm text-gray-700 space-y-1 mb-3">
              <li>1. Tap the Share button (box with arrow)</li>
              <li>2. Scroll down and tap "Add to Home Screen"</li>
              <li>3. Tap "Add"</li>
            </ol>
            <p className="text-sm text-gray-700 mb-2">On Android (Chrome):</p>
            <ol className="text-sm text-gray-700 space-y-1 mb-4">
              <li>1. Tap the menu (3 dots)</li>
              <li>2. Tap "Add to Home Screen" / "Install app"</li>
            </ol>
            <button onClick={() => setShowIOSHelp(false)} className="w-full py-2 bg-gray-900 text-white rounded-xl font-bold">Got it</button>
          </div>
        </div>
      )}
    </>
  );
};

export default InstallAppButton;
