"use client";
import React, { useState } from 'react';
import { ModelList } from '@/components/settings/model-list';
import { EmbeddingList } from '@/components/settings/embedding-list';
import { SidebarMenu } from '@/components/ui/menu';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { useTranslations } from '@/i18n/hooks';

export default function SettingsPage() {
  const { t } = useTranslations();
  const [activeTab, setActiveTab] = useState('models');

  const tabs = [
    { id: 'models', label: t('pages.settings.modelSettings') },
    { id: 'knowledge', label: t('pages.settings.knowledgeSettings') },
    { id: 'app', label: t('pages.settings.appSettings') },
    { id: 'about', label: t('pages.settings.about') },
  ];

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <SidebarMenu />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{t('pages.settings.title')}</h1>
            <LanguageSwitcher />
          </div>
          
          {/* Tab switching */}
          <div className="flex space-x-8 border-b mb-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`pb-2 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          <div className="space-y-8">
            {activeTab === 'models' && (
              <>
                <ModelList />
                <EmbeddingList />
              </>
            )}
            {activeTab === 'knowledge' && (
              <div className="text-gray-500 dark:text-gray-400">
                {t('common.messages.noData')}
              </div>
            )}
            {activeTab === 'app' && (
              <div className="text-gray-500 dark:text-gray-400">
                {t('common.messages.noData')}
              </div>
            )}
            {activeTab === 'about' && (
              <div className="text-gray-500 dark:text-gray-400">
                {t('common.messages.about')}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
} 