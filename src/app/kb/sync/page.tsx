"use client";
import Link from "next/link";
import { useState, Suspense, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Upload, FolderOpen, Info, ChevronDown, ChevronUp } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { useTranslations } from '@/i18n/hooks';

function FAQ() {
  const { t } = useTranslations();
  const [open, setOpen] = useState<number | null>(null);
  const faqs = [
    {
      q: t('pages.kbSync.faq.howToSelectDirectory'),
      a: t('pages.kbSync.faq.howToSelectDirectoryAnswer')
    },
    {
      q: t('pages.kbSync.faq.resourceUsage'),
      a: t('pages.kbSync.faq.resourceUsageAnswer')
    }
  ];
  return (
    <div className="mt-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
      {faqs.map((item, i) => (
        <div key={i} className="border-b last:border-0 border-gray-100 dark:border-gray-800">
          <button
            className="w-full flex justify-between items-center px-4 py-3 text-left text-sm font-medium focus:outline-none"
            onClick={() => setOpen(open === i ? null : i)}
          >
            {item.q}
            {open === i ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {open === i && (
            <div className="px-4 pb-3 text-gray-600 dark:text-gray-300 text-sm">{item.a}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function StepBar() {
  const { t } = useTranslations();
  return (
    <div className="flex items-center justify-center gap-8 mb-8">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">1</div>
        <span className="text-xs mt-1 text-gray-700 dark:text-gray-200">{t('pages.kbSync.step1')}</span>
      </div>
      <div className="h-0.5 w-12 bg-blue-400" />
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-400 flex items-center justify-center font-bold">2</div>
        <span className="text-xs mt-1 text-gray-400">{t('pages.kbSync.step2')}</span>
      </div>
      <div className="h-0.5 w-12 bg-gray-300 dark:bg-gray-700" />
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-400 flex items-center justify-center font-bold">3</div>
        <span className="text-xs mt-1 text-gray-400">{t('pages.kbSync.step3')}</span>
      </div>
    </div>
  );
}

function KbSyncPageContent() {
  const { t } = useTranslations();
  const [selectedDirs, setSelectedDirs] = useState<string[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from');
  const kbId = searchParams.get('kb');
  useEffect(() => {
    // Clear sessionStorage when entering the first step
    sessionStorage.removeItem('syncDirs');
    sessionStorage.removeItem('syncKbId');
  }, []);
  async function handleSelectDirs() {
    try {
      // Check if in Electron environment
      if (typeof window !== 'undefined' && 'electronAPI' in window) {
        const dirs = await window.electronAPI.selectDirectories();
        if (Array.isArray(dirs)) {
          setSelectedDirs(Array.from(new Set([...selectedDirs, ...dirs])));
        }
      } else {
        alert(t('pages.kbSync.electronNotSupported'));
      }
    } catch (error) {
      console.error(t('pages.kbSync.selectDirectoryFailed'), error);
      alert(t('pages.kbSync.selectDirectoryFailed'));
    }
  }
  function handleNext() {
    if (selectedDirs.length === 0) return;
    sessionStorage.setItem('syncDirs', JSON.stringify(selectedDirs));
    if (kbId) sessionStorage.setItem('syncKbId', kbId);
    router.push(`/kb/sync/setting${kbId ? `?kb=${kbId}` : ''}`);
  }
  return (
    <div className="p-8 overflow-y-auto h-full">
      <div className="flex items-center text-sm text-gray-500 mb-2">
        <Link href="/kb" className="hover:underline">{t('pages.kb.title')}</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700 dark:text-gray-200 font-medium">{t('pages.kbSync.title')}</span>
      </div>
      <div className="max-w-2xl mx-auto">
        <StepBar />
        <Card className="mb-6">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold">{t('pages.kbSync.step1')}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                {t('pages.kbSync.description')}
              </div>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800 mb-4">
                <FolderOpen className="w-12 h-12 text-gray-400 mb-2" />
                <div className="font-medium text-gray-700 dark:text-gray-200 mb-2">{t('pages.kbSync.selectLocalDirectory')}</div>
                <div className="text-xs text-gray-400 mb-4">{t('pages.kbSync.selectDirectoryDesc')}</div>
                <Button variant="default" className="flex items-center gap-2" onClick={handleSelectDirs}>
                  <Upload className="w-4 h-4" />{t('pages.kbSync.selectDirectory')}
                </Button>
              </div>
              {selectedDirs.length > 0 && (
                <div className="w-full mb-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-4 py-2">
                  <div className="text-xs text-gray-500 dark:text-gray-300 mb-1">{t('pages.kbSync.selectedDirectories')}</div>
                  <ul className="text-xs text-gray-700 dark:text-gray-100 space-y-1">
                    {selectedDirs.map((dir, i) => (
                      <li key={i} className="break-all">{dir}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded px-4 py-2 text-xs flex items-center gap-2 mt-4">
                <Info className="w-4 h-4" />
                {t('pages.kbSync.supportedFormats')}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => router.back()} className="cursor-pointer">{t('common.buttons.cancel')}</Button>
              <Button variant="default" onClick={handleNext} disabled={selectedDirs.length === 0}>
                {t('common.buttons.next')}
              </Button>
            </div>
          </CardContent>
        </Card>
        <FAQ />
      </div>
    </div>
  );
}

export default function KbSyncPage() {
  return (
    <Suspense fallback={null}>
      <KbSyncPageContent />
    </Suspense>
  );
} 