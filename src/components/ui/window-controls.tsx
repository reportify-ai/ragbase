"use client";
import { usePlatform } from '@/hooks/usePlatform';
import { Minus, Square, X } from 'lucide-react';

export function WindowControls() {
  const { platform } = usePlatform();

  // Only show custom window control buttons on Windows/Linux, not on macOS
  if (platform === 'darwin') return null;

  const handleMinimize = () => {
    if (window.electronAPI) {
      window.electronAPI.minimizeWindow();
    }
  };

  const handleMaximize = () => {
    if (window.electronAPI) {
      window.electronAPI.maximizeWindow();
    }
  };

  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.closeWindow();
    }
  };

  return (
    <div className="flex items-center space-x-1 absolute top-1 right-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <button
        onClick={handleMinimize}
        className="w-6 h-6 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 rounded"
      >
        <Minus className="w-3 h-3" />
      </button>
      <button
        onClick={handleMaximize}
        className="w-6 h-6 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 rounded"
      >
        <Square className="w-3 h-3" />
      </button>
      <button
        onClick={handleClose}
        className="w-6 h-6 flex items-center justify-center hover:bg-red-500 hover:text-white rounded"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
