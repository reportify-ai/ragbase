"use client";
import Link from "next/link";
import {
  Plus,
  RefreshCw,
  Trash2,
  Play,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useState, useEffect, useRef } from "react";
import { Modal } from "@/components/ui/modal";

import { FileIcon } from "@/components/ui/file-icon";
import { z } from 'zod';
import { KbModal } from "@/components/ui/kb-modal";
import { FileStatus } from "@/components/ui/file-status";
import { FileOpener } from "@/components/ui/file-opener";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslations } from '@/i18n/hooks';

interface KbItem {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
}

function TopCards({ kbs, onEdit, onDelete }: { kbs: KbItem[]; onEdit: (kb: KbItem) => void; onDelete: (kb: KbItem) => void }) {
  const { t } = useTranslations();
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {kbs.map((c) => (
        <div key={c.id} className="group/card relative">
          <Link href={`/kb/${c.id}`} className="block">
            <Card className="relative group-hover:ring-2 group-hover:ring-blue-400 transition p-4 h-32 flex flex-col group/card">
              <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 pointer-events-none group-hover/card:opacity-100 group-hover/card:pointer-events-auto transition-opacity duration-200 z-10">
                <Button size="sm" variant="outline" className="px-2 py-1 text-xs" onClick={e => { e.preventDefault(); onEdit(c); }}>{t('common.buttons.edit')}</Button>
                <Button size="sm" variant="destructive" className="px-2 py-1 text-xs" onClick={e => { e.preventDefault(); onDelete(c); }}>{t('common.buttons.delete')}</Button>
              </div>
              <div className="flex-1 flex flex-col">
                <div className="font-medium truncate text-base" title={c.name}>{c.name}</div>
                <div className="text-xs text-gray-400 truncate mt-1" title={c.description}>{c.description || t('common.messages.noData')}</div>
              </div>
            </Card>
          </Link>
        </div>
      ))}
    </div>
  );
}

const kbSchema = z.object({
  name: z.string().min(1, '请输入知识库名称'),
  description: z.string().optional(),
});

function getPageNumbers(current: number, total: number) {
  const pages: (number | string)[] = [];
  if (total <= 5) {
    for (let i = 1; i <= total; i++) pages.push(i);
    return pages;
  }
  if (current <= 3) {
    pages.push(1, 2, 3, 4, '...', total);
    return pages;
  }
  if (current >= total - 2) {
    pages.push(1, '...', total - 3, total - 2, total - 1, total);
    return pages;
  }
  pages.push(1, '...', current - 1, current, current + 1, '...', total);
  return pages;
}

export default function KbPage() {
  const { t } = useTranslations();
  const [kbs, setKbs] = useState<KbItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingKb, setEditingKb] = useState<KbItem | null>(null);
  const [allFiles, setAllFiles] = useState<any[]>([]);
  const [allFilesTotal, setAllFilesTotal] = useState(0);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [filePage, setFilePage] = useState(1);
  const [jumpPage, setJumpPage] = useState<string>('');
  const [deletingFile, setDeletingFile] = useState<number | null>(null);
  
  // State for delete confirmation dialogs
  const [showDeleteKbDialog, setShowDeleteKbDialog] = useState(false);
  const [kbToDelete, setKbToDelete] = useState<KbItem | null>(null);
  const [showDeleteFileDialog, setShowDeleteFileDialog] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<number | null>(null);
  
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const AUTO_REFRESH_INTERVAL = 10000; // 10 seconds auto refresh once
  const pageSize = 5;

  async function fetchKbs() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/kb');
      if (!res.ok) throw new Error(t('api.errors.networkError'));
      const data = await res.json();
      setKbs(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || t('api.errors.serverError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchKbs();
  }, []);

  // Show delete kb confirmation dialog
  function showDeleteKbConfirmation(kb: KbItem) {
    setKbToDelete(kb);
    setShowDeleteKbDialog(true);
  }

  // Delete knowledge base
  async function handleDeleteKb() {
    if (!kbToDelete) return;
    
    try {
      const res = await fetch(`/api/kb`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: kbToDelete.id }),
      });
      if (!res.ok) throw new Error(t('api.errors.deleteFailed'));
      fetchKbs();
    } catch (e: any) {
      alert(e.message || t('api.errors.deleteFailed'));
    } finally {
      setKbToDelete(null);
    }
  }

  async function handleSaveKb(data: { id?: number; name: string; description?: string }) {
    try {
      if (data.id) {
        const res = await fetch(`/api/kb`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(t('api.errors.saveFailed'));
      } else {
        const res = await fetch(`/api/kb`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(t('api.errors.createFailed'));
      }
      setModalOpen(false);
      setEditingKb(null);
      fetchKbs();
    } catch (e: any) {
      alert(e.message || t('api.errors.saveFailed'));
    }
  }

  function handleEditKb(kb: KbItem) {
    setEditingKb(kb);
    setModalOpen(true);
  }

  function handleJumpToPage() {
    const page = parseInt(jumpPage);
    const totalPages = Math.ceil(allFilesTotal / pageSize);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      setFilePage(page);
      setJumpPage(''); // 清空输入框
    }
  }

  // Show delete file confirmation dialog
  function showDeleteFileConfirmation(fileId: number) {
    setFileToDelete(fileId);
    setShowDeleteFileDialog(true);
  }

  // Delete file
  async function handleDeleteFile() {
    if (!fileToDelete) return;
    
    setDeletingFile(fileToDelete);
    try {
      const response = await fetch('/api/kb/files/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: fileToDelete }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('api.errors.deleteFileFailed'));
      }
      
      // Re-fetch file list
      await fetchAllFiles();
    } catch (error: any) {
      console.error('删除文件失败:', error);
      alert(`${t('api.errors.deleteFailed')}: ${error.message || t('api.errors.unknownError')}`);
    } finally {
      setDeletingFile(null);
      setFileToDelete(null);
    }
  }

  async function fetchAllFiles() {
    setFilesLoading(true);
    setFilesError(null);
    try {
      const res = await fetch(`/api/kb/files?limit=${pageSize}&offset=${(filePage-1)*pageSize}`);
      const data = await res.json();
      setAllFiles(data.data || []);
      setAllFilesTotal(data.total || 0);
    } catch (e: any) {
      setFilesError(e.message || t('api.errors.serverError'));
    } finally {
      setFilesLoading(false);
    }
  }

  useEffect(() => {
    setFilePage(1);
  }, []);

  useEffect(() => {
    setFilesLoading(true);
    setFilesError(null);
    fetch(`/api/kb/files?limit=${pageSize}&offset=${(filePage-1)*pageSize}`)
      .then(res => res.json())
      .then(res => {
        console.log('API returned', res, 'filePage', filePage);
        setAllFiles(res.data || []);
        setAllFilesTotal(res.total || 0);
      })
      .catch(e => setFilesError(e.message || t('api.errors.serverError')))
      .finally(() => setFilesLoading(false));
  }, [filePage]);

  // Set auto refresh timer
  useEffect(() => {
    // Clear previous timer
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    
    // Set auto refresh
    refreshTimerRef.current = setInterval(() => {
      console.log(`Auto refresh file list (${AUTO_REFRESH_INTERVAL/1000} seconds)`);
      // Silent refresh, no loading state
      fetch(`/api/kb/files?limit=${pageSize}&offset=${(filePage-1)*pageSize}`)
        .then(res => res.json())
        .then(res => {
          setAllFiles(res.data || []);
          setAllFilesTotal(res.total || 0);
        })
        .catch(e => console.error('Auto refresh failed:', e));
    }, AUTO_REFRESH_INTERVAL);
    
    // Clear timer when component is unmounted
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [filePage]);

  useEffect(() => {
    console.log('allFiles', allFiles);
  }, [allFiles]);

  const totalPages = Math.max(1, Math.ceil(allFilesTotal / pageSize));
  const pageNumbers = getPageNumbers(filePage, totalPages);

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{t('pages.kb.title')}</h2>
            <Button
              size="sm"
              variant="default"
              className="flex items-center gap-1"
              onClick={() => { setEditingKb(null); setModalOpen(true); }}
            >
              <Plus className="w-4 h-4" />{t('pages.kb.createKnowledgeBase')}
            </Button>
          </div>
          {loading ? (
            <div className="text-gray-500 py-8 text-center">{t('common.messages.loading')}</div>
          ) : error ? (
            <div className="text-red-500 py-8 text-center">{error}</div>
          ) : (
            <TopCards kbs={kbs} onEdit={handleEditKb} onDelete={showDeleteKbConfirmation} />
          )}
          <Card className="mb-8">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between w-full">
                <span className="text-base font-semibold">{t('pages.kb.allFiles')}</span>
                <div className="flex gap-2 ml-4 justify-end">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={fetchAllFiles}
                    className="flex items-center gap-1"
                    disabled={filesLoading}
                  >
                    {filesLoading ? (
                      <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full"></div>
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    {t('common.buttons.refresh')}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <tbody className="bg-white dark:bg-gray-900">
                  {filesLoading ? (
                    <tr><td className="text-center py-8 text-gray-500">{t('common.messages.loading')}</td></tr>
                  ) : filesError ? (
                    <tr><td className="text-center py-8 text-red-500">{filesError}</td></tr>
                  ) : allFiles.length === 0 ? (
                    <tr><td className="text-center py-8 text-gray-400">{t('pages.kb.noFiles')}</td></tr>
                  ) : (
                    allFiles.map((f, i) => (
                      <tr key={f.id || i} className="border-b last:border-0 dark:border-gray-800">
                        <td className="px-4 py-3">
                          {/* First row: file name */}
                          <div className="flex items-center gap-2 mb-2">
                            <FileIcon ext={f.ext || (f.name?.split('.')?.pop() || '')} />
                            <span className="font-medium">{f.name}</span>
                          </div>
                          
                          {/* Second row: knowledge base, size, upload time, status and operation */}
                          <div className="flex items-center text-xs text-gray-500 gap-4 ml-6">
                            {/* Knowledge base */}
                            <div className="flex items-center gap-1">
                              <span>{t('pages.kb.knowledgeBase')}:</span>
                              <span>{f.kb_name || t('common.messages.unknown')}</span>
                            </div>
                            
                            {/* Size */}
                            <div className="flex items-center gap-1">
                              <span>{t('pages.kb.size')}:</span>
                              <span>{typeof f.size === 'number' ? (f.size / 1024 / 1024).toFixed(2) + ' MB' : f.size}</span>
                            </div>
                            
                            {/* Upload time */}
                            <div className="flex items-center gap-1">
                              <span>{t('pages.kb.uploadTime')}:</span>
                              <span>{f.created_at ? (f.created_at.split('T')[0] + ' ' + (f.created_at.split('T')[1]?.slice(0,5) || '')) : ''}</span>
                            </div>
                            
                            {/* Status */}
                            <div className="flex items-center gap-1">
                              <span>{t('pages.kb.status')}:</span>
                              <FileStatus status={f.status} />
                            </div>
                            
                            {/* Operation */}
                            <div className="flex items-center gap-1 ml-auto">
                              {f.path && (
                                <FileOpener filePath={f.path} iconOnly={true} />
                              )}
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={async () => {
                                  try {
                                    const response = await fetch('/api/kb/files/retry', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: f.id }),
                                    });
                                    if (!response.ok) throw new Error(t('api.errors.retryFailed'));
                                    const res = await fetch(`/api/kb/files?limit=${pageSize}&offset=${(filePage-1)*pageSize}`);
                                    const data = await res.json();
                                    setAllFiles(data.data || []);
                                    setAllFilesTotal(data.total || 0);
                                  } catch (error) {
                                    console.error('Retry file failed:', error);
                                    alert(t('api.errors.retryFailed'));
                                  }
                                }}
                              >
                                <Play className="w-4 h-4" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={() => showDeleteFileConfirmation(f.id)}
                                disabled={deletingFile === f.id}
                                className={deletingFile === f.id ? "opacity-50 cursor-not-allowed" : ""}
                              >
                                {deletingFile === f.id ? (
                                  <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full"></div>
                                ) : (
                                  <Trash2 className="w-4 h-4 text-red-500 hover:text-red-700" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end items-center gap-2 px-4 py-3 border-t">
                <Button size="sm" variant="ghost" onClick={() => setFilePage(p => Math.max(1, p-1))} disabled={filePage === 1}>&lt;</Button>
                {pageNumbers.map((n, i) =>
                  typeof n === 'number' ? (
                    <Button key={n} size="sm" variant={n === filePage ? 'default' : 'ghost'} onClick={() => setFilePage(n)}>{n}</Button>
                  ) : (
                    <span key={"ellipsis-"+i} className="px-2 text-gray-400">...</span>
                  )
                )}
                <Button size="sm" variant="ghost" onClick={() => setFilePage(p => Math.min(totalPages, p+1))} disabled={filePage === totalPages}>&gt;</Button>
                
                {/* Page jump input */}
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={jumpPage}
                  onChange={(e) => setJumpPage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleJumpToPage()}
                  className="w-12 h-8 text-center text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={filePage.toString()}
                  title={t('common.labels.jumpTo')}
                />
                
                <span className="text-xs text-gray-400 ml-2">{t('pages.kb.totalFiles', { count: allFilesTotal })}</span>
              </div>
            </CardContent>
          </Card>
          <KbModal open={modalOpen} kb={editingKb} onClose={() => setModalOpen(false)} onSave={handleSaveKb} />
        </div>
      </main>
      
      {/* Delete Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={showDeleteKbDialog}
        onClose={() => setShowDeleteKbDialog(false)}
        onConfirm={handleDeleteKb}
        message={kbToDelete ? t('pages.kb.confirmDeleteKb', { name: kbToDelete.name }) : ''}
        confirmText={t('common.buttons.delete')}
        cancelText={t('common.buttons.cancel')}
        confirmVariant="destructive"
      />
      
      <ConfirmDialog
        isOpen={showDeleteFileDialog}
        onClose={() => setShowDeleteFileDialog(false)}
        onConfirm={handleDeleteFile}
        message={t('pages.kb.confirmDeleteFile')}
        confirmText={t('common.buttons.delete')}
        cancelText={t('common.buttons.cancel')}
        confirmVariant="destructive"
      />
    </div>
  );
} 