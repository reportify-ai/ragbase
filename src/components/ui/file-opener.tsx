import React, { useState } from 'react';
import { Eye } from 'lucide-react';
import { Button } from './button';
import { invoke } from '@tauri-apps/api/core';

interface FileOpenerProps {
  filePath: string;
  className?: string;
  iconOnly?: boolean;
}

export const FileOpener: React.FC<FileOpenerProps> = ({ 
  filePath, 
  className = '', 
  iconOnly = false 
}) => {
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenFile = async () => {
    if (!filePath) {
      setError('File path cannot be empty');
      return;
    }

    setIsOpening(true);
    setError(null);

    try {
      // Use @tauri-apps/api invoke function
      const result = await invoke('open_file', { filePath }) as { success: boolean; error?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to open file');
      }
    } catch (err: any) {
      console.error('Error opening file:', err);
      setError(err.message || 'Failed to open file');
      
      // Show error message for 3 seconds then auto clear
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <div className={`inline-flex items-center ${className}`}>
      <Button
        size="icon"
        variant="ghost"
        onClick={handleOpenFile}
        disabled={isOpening}
        title="Open file with system default program"
        className={`${isOpening ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isOpening ? (
          <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full"></div>
        ) : (
          <Eye className="w-4 h-4" />
        )}
        {!iconOnly && <span className="ml-1">Open</span>}
      </Button>
      
      {error && (
        <div className="text-xs text-red-500 ml-2">{error}</div>
      )}
    </div>
  );
};

export default FileOpener; 