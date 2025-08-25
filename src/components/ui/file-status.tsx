import React from 'react';
import { useTranslations } from '@/i18n/hooks';

// File status mapping
export const getFileStatusText = (status: number | null | undefined): string => {
  const { t } = useTranslations();
  
  switch (status) {
    case 0: return t('components.fileStatus.pending');
    case 1: return t('components.fileStatus.parsing');
    case 2: return t('components.fileStatus.parsed');
    case 3: return t('components.fileStatus.chunking');
    case 4: return t('components.fileStatus.chunked');
    case 5: return t('components.fileStatus.vectorizing');
    case 6: return t('components.fileStatus.completed');
    case -1: return t('components.fileStatus.failed');
    case -2: return t('components.fileStatus.vectorizationFailed');
    default: return t('components.fileStatus.unknown');
  }
};

// File status style mapping
export const getFileStatusStyle = (status: number | null | undefined): string => {
  switch (status) {
    case 0: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    case 1: return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 2: return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 3: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 4: return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 5: return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 6: return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case -1: return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case -2: return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  }
};

interface FileStatusProps {
  status: number | null | undefined;
  className?: string;
}

export const FileStatus: React.FC<FileStatusProps> = ({ status, className = '' }) => {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getFileStatusStyle(status)} ${className}`}>
      {getFileStatusText(status)}
    </span>
  );
}; 