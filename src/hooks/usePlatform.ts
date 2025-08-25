import { useState, useEffect } from 'react';

export function usePlatform() {
  const [platform, setPlatform] = useState<string>('');

  useEffect(() => {
    // 检查是否在 Electron 环境中
    if (typeof window !== 'undefined' && window.electronAPI) {
      setPlatform(window.electronAPI.platform);
    } else {
      // 在浏览器环境中通过 user agent 推测（fallback）
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
