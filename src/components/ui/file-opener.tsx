import React, { useState } from 'react';
import { Eye } from 'lucide-react';
import { Button } from './button';

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
      setError('文件路径不能为空');
      return;
    }

    setIsOpening(true);
    setError(null);

    try {
      // 检查 electronAPI 是否可用
      if (!window.electronAPI) {
        throw new Error('非 Electron 环境，无法打开文件');
      }

      const result = await window.electronAPI.openFile(filePath);
      
      if (!result.success) {
        throw new Error(result.error || '打开文件失败');
      }
    } catch (err: any) {
      console.error('打开文件出错:', err);
      setError(err.message || '打开文件失败');
      
      // 显示错误提示 3 秒后自动清除
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
        title="用系统默认程序打开文件"
        className={`${isOpening ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isOpening ? (
          <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full"></div>
        ) : (
          <Eye className="w-4 h-4" />
        )}
        {!iconOnly && <span className="ml-1">打开</span>}
      </Button>
      
      {error && (
        <div className="text-xs text-red-500 ml-2">{error}</div>
      )}
    </div>
  );
};

export default FileOpener; 