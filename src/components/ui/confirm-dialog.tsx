"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { useTranslations } from '@/i18n/hooks';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "default" | "destructive";
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  confirmVariant = "destructive"
}: ConfirmDialogProps) {
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

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50"
      onClick={handleCancel}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-6 max-w-xs w-full mx-4"
        onClick={handleBackdropClick}
      >
        {/* Title - only show if provided */}
        {title && (
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            {title}
          </h3>
        )}
        
        {/* Message */}
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {message}
        </p>
        
        {/* Buttons */}
        <div className="flex justify-end space-x-3">
          <Button
            variant="ghost"
            onClick={handleCancel}
          >
            {cancelText || t('common.buttons.cancel')}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={handleConfirm}
          >
            {confirmText || t('common.buttons.confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
