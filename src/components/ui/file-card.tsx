import React from 'react';
import { Card, CardContent } from './card';
import { FileIcon } from './file-icon';
import { FileStatus } from './file-status';
import { FileOpener } from './file-opener';
import { Button } from './button';
import { Play, Trash2 } from 'lucide-react';

interface FileCardProps {
  file: {
    id: number;
    name: string;
    path?: string;
    ext?: string;
    size?: number;
    created_at?: string;
    status?: number;
    kb_name?: string;
  };
  onRetry?: (id: number) => void;
  onDelete?: (id: number) => void;
  retryingFile?: number | null;
  deletingFile?: number | null;
  className?: string;
}

export const FileCard: React.FC<FileCardProps> = ({
  file,
  onRetry,
  onDelete,
  retryingFile,
  deletingFile,
  className = '',
}) => {
  const fileExt = file.ext || (file.name?.split('.')?.pop() || '');
  
  return (
    <Card className={`hover:shadow-md transition-shadow duration-200 ${className}`}>
      <CardContent className="p-4">
        {/* 第一行：文件名称 */}
        <div className="flex items-center gap-2 mb-3">
          <FileIcon ext={fileExt} />
          <span className="font-medium truncate">{file.name}</span>
        </div>
        
        {/* 第二行：信息和操作 */}
        <div className="flex items-center text-xs text-gray-500 gap-3">
          {/* 知识库 */}
          {file.kb_name && (
            <div className="flex items-center gap-1">
              <span>知识库:</span>
              <span>{file.kb_name}</span>
            </div>
          )}
          
          {/* 大小 */}
          {typeof file.size === 'number' && (
            <div className="flex items-center gap-1">
              <span>大小:</span>
              <span>{(file.size / 1024 / 1024).toFixed(2) + ' MB'}</span>
            </div>
          )}
          
          {/* 上传时间 */}
          {file.created_at && (
            <div className="flex items-center gap-1">
              <span>上传时间:</span>
              <span>{file.created_at.split('T')[0] + ' ' + (file.created_at.split('T')[1]?.slice(0,5) || '')}</span>
            </div>
          )}
          
          {/* 状态 */}
          {typeof file.status !== 'undefined' && (
            <div className="flex items-center gap-1">
              <span>状态:</span>
              <FileStatus status={file.status} />
            </div>
          )}
          
          {/* 操作 */}
          <div className="flex items-center gap-1 ml-auto">
            {file.status === 6 && file.path && (
              <FileOpener filePath={file.path} iconOnly={true} />
            )}
            
            {onRetry && (
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={() => onRetry(file.id)}
                disabled={retryingFile === file.id || file.status === 6}
                className={retryingFile === file.id ? "opacity-50 cursor-not-allowed" : ""}
              >
                {retryingFile === file.id ? (
                  <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full"></div>
                ) : (
                  <Play className="w-4 h-4 text-green-500 hover:text-green-700" />
                )}
              </Button>
            )}
            
            {onDelete && (
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={() => onDelete(file.id)}
                disabled={deletingFile === file.id}
                className={deletingFile === file.id ? "opacity-50 cursor-not-allowed" : ""}
              >
                {deletingFile === file.id ? (
                  <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full"></div>
                ) : (
                  <Trash2 className="w-4 h-4 text-red-500 hover:text-red-700" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FileCard; 