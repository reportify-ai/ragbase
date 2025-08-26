import { useState, useEffect } from 'react';

export function usePlatform() {
  const [platform, setPlatform] = useState<string>('');

  useEffect(() => {
    // Check if running in Electron environment
    if (typeof window !== 'undefined' && window.electronAPI) {
      setPlatform(window.electronAPI.platform);
    } else {
      // Detect platform via user agent in browser environment (fallback)
      const userAgent = navigator.userAgent.toLowerCase();
      if (userAgent.includes('win')) {
        setPlatform('win32');
      } else if (userAgent.includes('linux')) {
        setPlatform('linux');
      } else if (userAgent.includes('mac')) {
        setPlatform('darwin');
      } else {
        setPlatform('unknown');
      }
    }
  }, []);

  return {
    platform,
    isWindows: platform === 'win32',
    isLinux: platform === 'linux',
    isMacOS: platform === 'darwin',
    isWindowsOrLinux: platform === 'win32' || platform === 'linux',
  };
}
