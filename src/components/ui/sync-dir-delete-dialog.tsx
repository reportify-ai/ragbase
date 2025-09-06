"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useTranslations } from '@/i18n/hooks';

interface SyncDirDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  syncDirName?: string;
  cleanData: boolean;
  onCleanDataChange: (checked: boolean) => void;
  systemDefaultCleanData: boolean;
}

export function SyncDirDeleteDialog({
  isOpen,
  onClose,
  onConfirm,
  syncDirName = '',
  cleanData,
  onCleanDataChange,
  systemDefaultCleanData
}: SyncDirDeleteDialogProps) {
  const { t } = useTranslations();

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  // Prevent clicking on backdrop to close dialog
  const handleBackdropClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const getConfirmMessage = () => {
    if (cleanData) {
      return t('pages.kbSync.confirmDeleteSyncDirWithData', { name: syncDirName });
    } else {
      return t('pages.kbSync.confirmDeleteSyncDirOnly', { name: syncDirName });
    }
  };

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50"
      onClick={handleCancel}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full mx-4"
        onClick={handleBackdropClick}
      >
        {/* Title */}
        <div className="flex items-center mb-4">
          <svg className="h-6 w-6 text-red-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.502 0L4.232 15.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {t('components.modal.confirmDelete')}
          </h3>
        </div>
        
        {/* Delete option selection */}
        <div className="mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 mr-4">
              <label className="text-sm font-medium text-gray-900 dark:text-white block mb-1">
                {t('pages.settings.deleteWithDataCleanup')}
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {cleanData 
                  ? t('pages.settings.deleteWithDataOption')
                  : t('pages.settings.deleteWithoutDataOption')
                }
              </p>
              {systemDefaultCleanData && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  {t('pages.settings.systemDefaultCleanDataEnabled')}
                </p>
              )}
            </div>
            <Switch 
              checked={cleanData} 
              onCheckedChange={onCleanDataChange}
            />
          </div>
        </div>
        
        {/* Warning message */}
        <div className="mb-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                {getConfirmMessage()}
              </p>
            </div>
          </div>
        </div>
        
        {/* Buttons */}
        <div className="flex justify-end space-x-3">
          <Button
            variant="ghost"
            onClick={handleCancel}
          >
            {t('common.buttons.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
          >
            {t('common.buttons.delete')}
          </Button>
        </div>
      </div>
    </div>
  );
}
