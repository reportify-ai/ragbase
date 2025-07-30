"use client";
import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FolderOpen, Zap, Clock, Calendar, Hand, Info } from "lucide-react";
import { SidebarMenu } from "@/components/ui/menu";
import { useRouter, useSearchParams } from "next/navigation";
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
      <div className="h-0.5 w-12 bg-gray-300 dark:bg-gray-700" />
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-400 flex items-center justify-center font-bold">3</div>
        <span className="text-xs mt-1 text-gray-400">{t('pages.kbSync.step3')}</span>
      </div>
    </div>
  );
}

const DEFAULT_FILETYPES = ["pdf", "docx", "txt", "md"];

function KbSyncSettingPageContent() {
  const { t } = useTranslations();
  const [selectedDirs, setSelectedDirs] = useState<string[]>([]);
  const [kbId, setKbId] = useState<string | null>(null);
  const [syncType, setSyncType] = useState("realtime");
  const [scanSubdir, setScanSubdir] = useState(true);
  const [skipHidden, setSkipHidden] = useState(true);
  const [skipLarge, setSkipLarge] = useState(false);
  const [fileTypes, setFileTypes] = useState<string[]>(DEFAULT_FILETYPES);
  const [inputType, setInputType] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // 动态生成同步选项，使用翻译
  const syncOptions = [
    { label: t('pages.kbSync.realtimeSync'), value: "realtime", desc: t('pages.kbSync.realtimeSyncDesc'), icon: <Zap className="w-4 h-4 text-yellow-500" /> },
    { label: t('pages.kbSync.manualSync'), value: "manual", desc: t('pages.kbSync.manualSyncDesc'), icon: <Hand className="w-4 h-4 text-gray-400" /> },
  ];

  useEffect(() => {
    // 只从 sessionStorage 读取
    const sessionDirs = sessionStorage.getItem('syncDirs');
    const sessionKbId = sessionStorage.getItem('syncKbId');
    if (sessionDirs) {
      try {
        const dirs = JSON.parse(sessionDirs);
        if (Array.isArray(dirs)) setSelectedDirs(dirs);
      } catch {}
    }
    if (sessionKbId) {
      setKbId(sessionKbId);
    }
  }, [setKbId]);

  function handleAddType() {
    const t = inputType.trim().replace(/^\./, "").toLowerCase();
    if (t && !fileTypes.includes(t)) setFileTypes([...fileTypes, t]);
    setInputType("");
  }
  function handleRemoveType(t: string) {
    setFileTypes(fileTypes.filter(ft => ft !== t));
  }

  async function handleSave() {
    if (!kbId) {
      alert(t('pages.kbSync.noKbSpecified'));
      return;
    }
    setLoading(true);
    try {
      for (const dir of selectedDirs) {
        await fetch('/api/kb/sync-directories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kbId,
            dirPath: dir,
            syncType,
            recursive: scanSubdir,
            ignoreHidden: skipHidden,
            ignoreLarge: skipLarge,
            fileTypes: fileTypes.join(','),
          })
        });
      }
      router.push(`/kb/sync/finish${kbId ? `?kb=${kbId}` : ''}`);
    } catch (e) {
      alert(t('api.errors.saveFailed'));
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setSelectedDirs([]);
    router.back();
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <SidebarMenu />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex items-center text-sm text-gray-500 mb-2">
          <Link href="/kb" className="hover:underline">{t('pages.kb.title')}</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700 dark:text-gray-200 font-medium">{t('pages.kbSync.step2')}</span>
        </div>
        <StepBar />
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="pb-2">
            <span className="text-base font-semibold">{t('pages.kbSync.step2')}</span>
            <div className="text-xs text-gray-500 mt-1">{t('pages.kbSync.settingsDescription')}</div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="text-xs text-gray-500 mb-1">{t('pages.kbSync.selectedDirectories')}</div>
              {selectedDirs.length > 0 ? (
                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm">
                  <ul className="space-y-1">
                    {selectedDirs.map((dir, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 text-gray-400 mr-1" />
                        <span className="break-all">{dir}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm text-gray-400">
                  <FolderOpen className="w-4 h-4 text-gray-300 mr-1" />
                  {t('pages.kbSync.noDirectories')}
                </div>
              )}
            </div>
            <div className="mb-6">
              <div className="text-xs text-gray-500 mb-2">{t('pages.kbSync.syncFrequency')}</div>
              <div className="flex flex-col gap-2">
                {syncOptions.map(opt => (
                  <label key={opt.value} className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer border ${syncType === opt.value ? "border-blue-500 bg-blue-50 dark:bg-blue-900" : "border-gray-200 dark:border-gray-700"}`}>
                    <input type="radio" className="accent-blue-500" name="syncType" value={opt.value} checked={syncType === opt.value} onChange={() => setSyncType(opt.value)} />
                    <span className="font-medium text-sm">{opt.label}</span>
                    <span className="text-xs text-gray-400 flex-1">{opt.desc}</span>
                    {opt.icon}
                  </label>
                ))}
              </div>
            </div>
            <div className="mb-6">
              <div className="text-xs text-gray-500 mb-2">{t('pages.kbSync.advancedOptions')}</div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={scanSubdir} onChange={e => setScanSubdir(e.target.checked)} className="accent-blue-500" />
                  <span className="text-sm">{t('pages.kbSync.recursiveSubdir')}</span>
                  <span className="text-xs text-gray-400">{t('pages.kbSync.recursiveSubdirDesc')}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={skipHidden} onChange={e => setSkipHidden(e.target.checked)} className="accent-blue-500" />
                  <span className="text-sm">{t('pages.kbSync.skipHidden')}</span>
                  <span className="text-xs text-gray-400">{t('pages.kbSync.skipHiddenDesc')}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={skipLarge} onChange={e => setSkipLarge(e.target.checked)} className="accent-blue-500" />
                  <span className="text-sm">{t('pages.kbSync.skipLarge')}</span>
                  <span className="text-xs text-gray-400">{t('pages.kbSync.skipLargeDesc')}</span>
                </label>
              </div>
            </div>
            <div className="mb-6">
              <div className="text-xs text-gray-500 mb-2">{t('pages.kbSync.fileTypeFilter')}</div>
              <div className="flex flex-wrap gap-2 mb-2">
                {fileTypes.map(t => (
                  <span key={t} className="bg-blue-100 text-blue-700 rounded px-2 py-0.5 text-xs flex items-center gap-1">
                    .{t}
                    <button type="button" className="ml-1 text-blue-400 hover:text-blue-700" onClick={() => handleRemoveType(t)}>&times;</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="border rounded px-2 py-1 text-xs w-32"
                  placeholder={t('pages.kbSync.addFileTypePlaceholder')}
                  value={inputType}
                  onChange={e => setInputType(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddType(); } }}
                />
                <Button size="sm" variant="outline" type="button" onClick={handleAddType}>{t('common.buttons.add')}</Button>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-8">
              <Button variant="outline" onClick={handleBack}>{t('common.buttons.back')}</Button>
              <Button variant="default" onClick={handleSave} disabled={selectedDirs.length === 0 || loading}>
                {loading ? t('common.messages.saving') : t('common.buttons.save')}
              </Button>
            </div>
          </CardContent>
        </Card>
        <div className="max-w-2xl mx-auto mt-6">
          <div className="bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded px-4 py-2 text-xs flex items-center gap-2">
            <Info className="w-4 h-4" />
            {t('pages.kbSync.syncFrequencyInfo')}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function KbSyncSettingPage() {
  return (
    <Suspense fallback={null}>
      <KbSyncSettingPageContent />
    </Suspense>
  );
} 