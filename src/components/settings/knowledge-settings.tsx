"use client";

import React, { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { useTranslations } from '@/i18n/hooks';
import { SYSTEM_SETTING_KEYS } from '@/lib/constants';

interface KnowledgeSettingsProps {}

export function KnowledgeSettings({}: KnowledgeSettingsProps) {
  const { t } = useTranslations();
  const [deleteWithDataCleanup, setDeleteWithDataCleanup] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load current setting from API
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/settings?key=${SYSTEM_SETTING_KEYS.DELETE_SYNC_DIR_CLEAN_DATA}`);
      
      if (response.ok) {
        const setting = await response.json();
        setDeleteWithDataCleanup(setting.value === 'true');
      } else if (response.status === 404) {
        // Setting not found, use default value
        setDeleteWithDataCleanup(true);
      } else {
        console.error('Failed to load setting:', response.statusText);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleChange = async (checked: boolean) => {
    try {
      setSaving(true);
      
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: SYSTEM_SETTING_KEYS.DELETE_SYNC_DIR_CLEAN_DATA,
          value: checked ? 'true' : 'false',
          description: 'Delete related files and vector data when removing sync directory'
        }),
      });

      if (response.ok) {
        setDeleteWithDataCleanup(checked);
      } else {
        console.error('Failed to save setting:', response.statusText);
        // Revert the change if save failed
        setDeleteWithDataCleanup(!checked);
      }
    } catch (error) {
      console.error('Error saving setting:', error);
      // Revert the change if save failed
      setDeleteWithDataCleanup(!checked);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
          {t('pages.settings.dataManagement')}
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 mr-4">
              <label className="text-sm font-medium text-gray-900 dark:text-white block mb-1">
                {t('pages.settings.deleteWithDataCleanup')}
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('pages.settings.deleteWithDataCleanupDesc')}
              </p>
            </div>
            <div className="flex items-center">
              {saving && (
                <div className="mr-3 text-sm text-gray-500 dark:text-gray-400">
                  {t('common.messages.saving')}
                </div>
              )}
              <Switch 
                checked={deleteWithDataCleanup} 
                onCheckedChange={handleToggleChange}
                disabled={saving}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
