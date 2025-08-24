"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

import { CheckCircle2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { useTranslations } from '@/i18n/hooks';

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
        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">2</div>
        <span className="text-xs mt-1 text-gray-700 dark:text-gray-200">{t('pages.kbSync.step2')}</span>
      </div>
      <div className="h-0.5 w-12 bg-blue-400" />
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">3</div>
        <span className="text-xs mt-1 text-blue-600 font-semibold">{t('pages.kbSync.step3')}</span>
      </div>
    </div>
  );
}

function FinishPageContent() {
  const { t } = useTranslations();
  const searchParams = useSearchParams();
  const [kbId, setKbId] = useState<string | null>(null);
  
  useEffect(() => {
    // Get kbId from URL parameters first
    const urlKbId = searchParams.get('kb');
    if (urlKbId) {
      setKbId(urlKbId);
      return;
    }
    
    // Get kbId from sessionStorage second
    const sessionKbId = sessionStorage.getItem('syncKbId');
    if (sessionKbId) {
      setKbId(sessionKbId);
    }
  }, [searchParams]);
  
  return (
    <div className="max-w-2xl mx-auto">
      <StepBar />
      <Card>
        <CardHeader className="flex flex-col items-center pb-2">
          <CheckCircle2 className="w-12 h-12 text-green-500 mb-2" />
          <span className="text-xl font-bold text-gray-800 dark:text-white mb-1">{t('pages.kbSync.syncSetupComplete')}</span>
          <span className="text-sm text-gray-500 dark:text-gray-300">{t('pages.kbSync.syncSetupCompleteDesc')}</span>
        </CardHeader>
        <CardContent className="flex justify-center mt-4">
          <Button asChild variant="default">
            <Link href={kbId ? `/kb/${kbId}` : "/kb"}>{t('pages.kbSync.backToKnowledgeBase')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function KbSyncFinishPage() {
  const { t } = useTranslations();
  return (
    <div className="p-8 overflow-y-auto h-full">
      <div className="flex items-center text-sm text-gray-500 mb-2">
        <Link href="/kb" className="hover:underline">{t('pages.kb.title')}</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700 dark:text-gray-200 font-medium">{t('pages.kbSync.syncComplete')}</span>
      </div>
      <Suspense fallback={<div className="text-center py-10">{t('common.messages.loading')}</div>}>
        <FinishPageContent />
      </Suspense>
    </div>
  );
} 