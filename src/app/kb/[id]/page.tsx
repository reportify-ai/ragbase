"use client";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ArrowLeft, Edit, Folder, CheckCircle2, Circle, Clock, AlertCircle, Play, RefreshCw, Trash2, Eye, FolderSync } from "lucide-react";
import { FileIcon } from "@/components/ui/file-icon";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { z } from "zod";
import { KbModal } from "@/components/ui/kb-modal";
import { FileStatus } from "@/components/ui/file-status";
import { FileOpener } from "@/components/ui/file-opener";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslations } from '@/i18n/hooks';

interface KbItem {
  id: number;
  name: string;
  description?: string;
}

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

const kbSchema = z.object({
  name: z.string().min(1, 'Please enter knowledge base name'),
  description: z.string().optional(),
});

export default function KbDetailPage() {
  const { t } = useTranslations();
  const params = useParams();
  const kbId = params?.id;
  const [files, setFiles] = useState<any[]>([]);
  const [filesTotal, setFilesTotal] = useState(0);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [filePage, setFilePage] = useState(1);
  const [jumpPage, setJumpPage] = useState<string>('');
  const pageSize = 5;

  const [syncDirs, setSyncDirs] = useState<any[]>([]);
  const [syncDirsLoading, setSyncDirsLoading] = useState(false);
  const [syncDirsError, setSyncDirsError] = useState<string | null>(null);

  const [kbName, setKbName] = useState<string>("");
  const [kbDesc, setKbDesc] = useState<string>("");
  const [kbNameLoading, setKbNameLoading] = useState(false);
  const [kbNameError, setKbNameError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editKb, setEditKb] = useState<KbItem | null>(null);

  const [syncingId, setSyncingId] = useState<number | null>(null);

  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [syncLogsLoading, setSyncLogsLoading] = useState(false);
  const [syncLogsError, setSyncLogsError] = useState<string | null>(null);
  const [syncLogsPage, setSyncLogsPage] = useState(1);
  const syncLogsPageSize = 10;

  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const AUTO_REFRESH_INTERVAL = 10000; // Auto refresh every 10 seconds
  
  const [retryingFile, setRetryingFile] = useState<number | null>(null);
  const [deletingFile, setDeletingFile] = useState<number | null>(null);
  
  // State for delete confirmation dialogs
  const [showDeleteSyncDirDialog, setShowDeleteSyncDirDialog] = useState(false);
  const [syncDirToDelete, setSyncDirToDelete] = useState<any>(null);
  const [showDeleteFileDialog, setShowDeleteFileDialog] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<number | null>(null);

  useEffect(() => {
    if (kbId) {
      setFilesLoading(true);
      setFilesError(null);
      fetch(`/api/kb/files?kbId=${kbId}&limit=${pageSize}&offset=${(filePage-1)*pageSize}`)
        .then(res => {
          if (!res.ok) throw new Error(t('api.errors.loadFilesFailed'));
          return res.json();
        })
        .then(res => {
          setFiles(res.data || []);
          setFilesTotal(res.total || 0);
        })
        .catch(e => setFilesError(e.message || t('api.errors.serverError')))
        .finally(() => setFilesLoading(false));
    } else {
      setFiles([]);
      setFilesTotal(0);
    }
  }, [kbId, filePage]);

  // Set auto refresh timer
  useEffect(() => {
    // Clear previous timer
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    
    // If there is a knowledge base ID, set auto refresh
    if (kbId) {
      refreshTimerRef.current = setInterval(() => {
        console.log(`${t('pages.kb.autoRefreshFiles')} (${AUTO_REFRESH_INTERVAL/1000}s interval)`);
        // Silent refresh, no loading state
        fetch(`/api/kb/files?kbId=${kbId}&limit=${pageSize}&offset=${(filePage-1)*pageSize}`)
          .then(res => res.json())
          .then(res => {
            setFiles(res.data || []);
            setFilesTotal(res.total || 0);
          })
          .catch(e => console.error(t('pages.kb.autoRefreshFailed'), e));
      }, AUTO_REFRESH_INTERVAL);
    }
    
    // Clear timer when component is unmounted
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [kbId, filePage]);

  useEffect(() => {
    if (kbId) {
      setSyncDirsLoading(true);
      setSyncDirsError(null);
      fetch(`/api/kb/sync-directories?kbId=${kbId}`)
        .then(res => {
          if (!res.ok) throw new Error(t('api.errors.loadSyncDirsFailed'));
          return res.json();
        })
        .then(res => {
          setSyncDirs(res.data || []);
        })
        .catch(e => setSyncDirsError(e.message || t('api.errors.serverError')))
        .finally(() => setSyncDirsLoading(false));
    } else {
      setSyncDirs([]);
    }
  }, [kbId]);

  useEffect(() => {
    if (kbId) {
      setKbNameLoading(true);
      setKbNameError(null);
      fetch('/api/kb')
        .then(res => {
          if (!res.ok) throw new Error(t('api.errors.loadKbFailed'));
          return res.json();
        })
        .then((kbs) => {
          const kb = (kbs || []).find((k: any) => String(k.id) === String(kbId));
          setKbName(kb?.name || '');
          setKbDesc(kb?.description || '');
        })
        .catch(e => setKbNameError(e.message || t('api.errors.serverError')))
        .finally(() => setKbNameLoading(false));
    } else {
      setKbName("");
      setKbDesc("");
    }
  }, [kbId]);

  useEffect(() => {
    if (kbId) {
      setSyncLogsLoading(true);
      setSyncLogsError(null);
      fetch(`/api/kb/sync-logs?kbId=${kbId}&limit=${syncLogsPageSize}&offset=${(syncLogsPage-1)*syncLogsPageSize}`)
        .then(res => {
          if (!res.ok) throw new Error(t('api.errors.loadSyncLogsFailed'));
          return res.json();
        })
        .then(res => {
          setSyncLogs(res.data || []);
        })
        .catch(e => setSyncLogsError(e.message || t('api.errors.serverError')))
        .finally(() => setSyncLogsLoading(false));
    } else {
      setSyncLogs([]);
    }
  }, [kbId, syncLogsPage]);

  const totalPages = Math.max(1, Math.ceil(filesTotal / pageSize));
  const pageNumbers = getPageNumbers(filePage, totalPages);

  // Function to refresh file list and sync directory list
  async function refreshData() {
    if (!kbId) return;
    
    // Refresh file list
    setFilesLoading(true);
    setFilesError(null);
    try {
      const filesRes = await fetch(`/api/kb/files?kbId=${kbId}&limit=${pageSize}&offset=${(filePage-1)*pageSize}`);
      if (!filesRes.ok) throw new Error(t('api.errors.loadFilesFailed'));
      const filesData = await filesRes.json();
      setFiles(filesData.data || []);
      setFilesTotal(filesData.total || 0);
    } catch (e: any) {
      setFilesError(e.message || t('api.errors.serverError'));
    } finally {
      setFilesLoading(false);
    }

    // Refresh sync directory list
    setSyncDirsLoading(true);
    setSyncDirsError(null);
    try {
      const dirsRes = await fetch(`/api/kb/sync-directories?kbId=${kbId}`);
      if (!dirsRes.ok) throw new Error(t('api.errors.loadSyncDirsFailed'));
      const dirsData = await dirsRes.json();
      setSyncDirs(dirsData.data || []);
    } catch (e: any) {
      setSyncDirsError(e.message || t('api.errors.serverError'));
    } finally {
      setSyncDirsLoading(false);
    }

    // Refresh sync history
    setSyncLogsLoading(true);
    setSyncLogsError(null);
    try {
      const logsRes = await fetch(`/api/kb/sync-logs?kbId=${kbId}&limit=${syncLogsPageSize}&offset=${(syncLogsPage-1)*syncLogsPageSize}`);
      if (!logsRes.ok) throw new Error(t('api.errors.loadSyncLogsFailed'));
      const logsData = await logsRes.json();
      setSyncLogs(logsData.data || []);
    } catch (e: any) {
      setSyncLogsError(e.message || t('api.errors.serverError'));
    } finally {
      setSyncLogsLoading(false);
    }
  }

  function handleEditClick() {
    setEditKb({ id: Number(kbId), name: kbName, description: kbDesc });
    setEditError(null);
    setEditOpen(true);
  }

  function handleJumpToPage() {
    const page = parseInt(jumpPage);
    const totalPages = Math.ceil(filesTotal / pageSize);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      setFilePage(page);
      setJumpPage(''); // Clear input box
    }
  }

  function handleEditSave(data: { id?: number; name: string; description?: string }) {
    setEditLoading(true);
    setEditError(null);
    fetch('/api/kb', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: data.id, name: data.name, description: data.description })
    })
      .then(res => {
        if (!res.ok) throw new Error(t('api.errors.saveFailed'));
        return res.json();
      })
      .then(() => {
        setKbName(data.name);
        setKbDesc(data.description || '');
        setEditOpen(false);
      })
      .catch(e => setEditError(e.message || t('api.errors.saveFailed')))
      .finally(() => setEditLoading(false));
  }

  // Show delete sync directory confirmation dialog
  function showDeleteSyncDirConfirmation(dir: any) {
    setSyncDirToDelete(dir);
    setShowDeleteSyncDirDialog(true);
  }

  // Delete sync directory
  async function handleDeleteSyncDir() {
    if (!syncDirToDelete) return;
    
    try {
      const res = await fetch('/api/kb/sync-directories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: syncDirToDelete.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('api.errors.deleteFailed'));
      
      // Refresh data after successful deletion
      await refreshData();
    } catch (e: any) {
      alert(e.message || t('api.errors.deleteFailed'));
    } finally {
      setSyncDirToDelete(null);
    }
  }

  // Show delete file confirmation dialog
  function showDeleteFileConfirmation(fileId: number) {
    setFileToDelete(fileId);
    setShowDeleteFileDialog(true);
  }

  async function handleRetryFile(fileId: number) {
    if (retryingFile) return;
    setRetryingFile(fileId);
    try {
      const response = await fetch('/api/kb/files/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: fileId }),
      });
      if (!response.ok) throw new Error(t('api.errors.retryFailed'));
      
      // Only update the status of the current file
      setFiles(prevFiles => 
        prevFiles.map(file => 
          file.id === fileId 
            ? { ...file, status: 0 } // Set status to waiting for processing (PENDING=0)
            : file
        )
      );
    } catch (error: any) {
      console.error('Failed to retry file:', error);
      alert(t('api.errors.retryFailed'));
    } finally {
      setRetryingFile(null);
    }
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
      await refreshData();
    } catch (error: any) {
      console.error(t('api.errors.deleteFailed'), error);
      alert(`${t('api.errors.deleteFailed')}: ${error.message || t('api.errors.unknownError')}`);
    } finally {
      setDeletingFile(null);
      setFileToDelete(null);
    }
  }

  return (
    <div className="p-8 overflow-y-auto h-full">
      <div className="max-w-6xl mx-auto">
          <div className="flex items-center mb-4">
            <Button asChild variant="ghost" size="icon" className="mr-2 hover:cursor-pointer">
              <Link href="/kb"><ArrowLeft className="w-5 h-5" /></Link>
            </Button>
            {kbNameLoading ? (
              <span className="text-2xl font-bold text-gray-800 dark:text-white mr-2">{t('common.messages.loading')}</span>
            ) : kbNameError ? (
              <span className="text-2xl font-bold text-red-500 mr-2">{t('api.errors.loadFailed')}</span>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mr-2">{kbName || t('pages.kb.knowledgeBase')}</h2>
                <Button size="icon" variant="ghost" onClick={handleEditClick} className="hover:cursor-pointer"><Edit className="w-4 h-4" /></Button>
              </>
            )}
          </div>
          <Card className="mb-8">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <span className="text-base font-semibold">{t('pages.kb.allFiles')}</span>
              <div className="flex gap-2 ml-4 justify-end">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    setFilesLoading(true);
                    fetch(`/api/kb/files?kbId=${kbId}&limit=${pageSize}&offset=${(filePage-1)*pageSize}`)
                      .then(res => res.json())
                      .then(res => {
                        setFiles(res.data || []);
                        setFilesTotal(res.total || 0);
                      })
                      .catch(e => setFilesError(e.message || t('api.errors.serverError')))
                      .finally(() => setFilesLoading(false));
                  }}
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
                <Button asChild size="sm" variant="outline" className="flex items-center gap-1 hover:cursor-pointer">
                  <Link href={`/kb/sync?kb=${kbId}`}><FolderSync className="w-4 h-4" />{t('pages.kb.syncDirectories')}</Link>
                </Button>
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
                  ) : files.length === 0 ? (
                    <tr><td className="text-center py-8 text-gray-400">{t('pages.kb.noFiles')}</td></tr>
                  ) : (
                    files.map((f, i) => (
                      <tr key={f.id || i} className="border-b last:border-0 dark:border-gray-800">
                        <td className="px-4 py-3">
                          {/* First row: file name */}
                          <div className="flex items-center gap-2 mb-2">
                            <FileIcon ext={f.ext || (f.name?.split('.')?.pop() || '')} />
                            <span className="font-medium">{f.name}</span>
                          </div>
                          
                          {/* Second row: size, upload time, status and operation */}
                          <div className="flex items-center text-xs text-gray-500 gap-4 ml-6">
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
                                onClick={() => handleRetryFile(f.id)}
                              >
                                {retryingFile === f.id ? (
                                  <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full"></div>
                                ) : (
                                  <Play className="w-4 h-4" />
                                )}
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={() => showDeleteFileConfirmation(f.id)}
                                disabled={deletingFile === f.id}
                                className={deletingFile === f.id ? "opacity-50 cursor-not-allowed" : "hover:cursor-pointer"}
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
                
                <span className="text-xs text-gray-400 ml-2">{t('pages.kb.totalFiles', { count: filesTotal })}</span>
              </div>
            </CardContent>
          </Card>
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-base font-semibold">{t('pages.kbSync.syncDirectorySettings')}</span>
              <Button asChild size="sm" variant="outline" className="hover:cursor-pointer">
                <Link href={`/kb/sync?step=0&kb=${kbId}`}>+ {t('pages.kbSync.addSync')}</Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {syncDirsLoading ? (
                <Card className="p-4 text-center text-gray-500">{t('common.messages.loading')}</Card>
              ) : syncDirsError ? (
                <Card className="p-4 text-center text-red-500">{syncDirsError}</Card>
              ) : syncDirs.length === 0 ? (
                <Card className="p-4 text-center text-gray-400">{t('pages.kbSync.noSyncDirectories')}</Card>
              ) : (
                syncDirs.map((dir, i) => (
                  <Card key={i} className="p-4 group">
                    <div className="flex items-center gap-2 mb-2">
                      <Folder className="w-5 h-5 text-gray-400" />
                      <span className="font-medium">{dir.name}</span>
                      <span
                        className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                          syncingId === dir.id
                            ? 'bg-blue-50 text-blue-700 animate-pulse'
                            : dir.status === t('pages.kbSync.synced')
                            ? 'bg-green-50 text-green-700'
                            : dir.status === t('pages.kbSync.manuallyPaused')
                            ? 'bg-yellow-50 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {syncingId === dir.id ? t('pages.kbSync.syncing') : dir.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mb-2 break-all">{dir.path}</div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                      <span>{t('pages.kbSync.syncType')}:{dir.syncType}</span>
                      <span>{t('pages.kbSync.lastSync')}:{dir.last}</span>
                    </div>
                    <div className="flex justify-end gap-2 mt-2">
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:cursor-pointer"
                        onClick={() => showDeleteSyncDirConfirmation(dir)}
                      >
                        {t('common.buttons.delete')}
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        disabled={!!syncingId}
                        onClick={async () => {
                          setSyncingId(dir.id);
                          try {
                            const res = await fetch('/api/kb/sync-directories', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ syncDirectoryId: dir.id })
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || t('api.errors.syncFailed'));
                            
                            // Refresh data after successful synchronization
                            await refreshData();
                          } catch (e: any) {
                            alert(e.message || t('api.errors.syncFailed'));
                          } finally {
                            setSyncingId(null);
                          }
                        }}
                      >
                        {t('pages.kbSync.syncNow')}
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
          <Card className="mb-8">
            <CardHeader className="pb-2">
              <span className="text-base font-semibold">{t('pages.kb.syncLogs')}</span>
              <div className="text-xs text-gray-500 mt-1">{t('pages.kbSync.viewAllSyncRecords')}</div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">{t('pages.kbSync.syncTime')}</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">{t('pages.kbSync.directory')}</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">{t('pages.kb.status')}</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">{t('pages.kbSync.fileStats')}</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">{t('pages.kbSync.duration')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900">
                    {syncLogsLoading ? (
                      <tr><td colSpan={5} className="text-center py-8 text-gray-500">{t('common.messages.loading')}</td></tr>
                    ) : syncLogsError ? (
                      <tr><td colSpan={5} className="text-center py-8 text-red-500">{syncLogsError}</td></tr>
                    ) : syncLogs.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-8 text-gray-400">{t('pages.kbSync.noSyncRecords')}</td></tr>
                    ) : (
                      syncLogs.map((log, i) => {
                        const startTime = new Date(log.startTime);
                        const endTime = log.endTime ? new Date(log.endTime) : null;
                        const duration = endTime ? Math.round((endTime.getTime() - startTime.getTime()) / 1000) : null;
                        
                        return (
                          <tr key={log.id || i} className="border-b last:border-0 dark:border-gray-800">
                            <td className="px-4 py-2">
                              {startTime.toLocaleString('zh-CN')}
                            </td>
                            <td className="px-4 py-2">
                              {syncDirs.find(dir => dir.id === log.syncDirectoryId)?.name || t('pages.kbSync.unknownDirectory')}
                            </td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                log.status === 'success' ? 'bg-green-50 text-green-700' :
                                log.status === 'failed' ? 'bg-red-50 text-red-700' :
                                log.status === 'running' ? 'bg-blue-50 text-blue-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {log.status === 'success' ? t('pages.kbSync.success') :
                                 log.status === 'failed' ? t('pages.kbSync.failed') :
                                 log.status === 'running' ? t('pages.kbSync.running') :
                                 log.status}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-xs">
                              {log.totalFiles > 0 ? (
                                <span>
                                  {t('pages.kbSync.total')}: {log.totalFiles} | 
                                  {t('pages.kbSync.success')}: {log.syncedFiles} | 
                                  {t('pages.kbSync.failed')}: {log.failedFiles}
                                </span>
                              ) : (
                                <span className="text-gray-400">{t('common.messages.noData')}</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-xs">
                              {duration !== null ? `${duration}${t('pages.kbSync.seconds')}` : '-'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          <KbModal
            open={editOpen}
            kb={editKb}
            onClose={() => setEditOpen(false)}
            onSave={handleEditSave}
          />
        </div>
      
      {/* Delete Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={showDeleteSyncDirDialog}
        onClose={() => setShowDeleteSyncDirDialog(false)}
        onConfirm={handleDeleteSyncDir}
        message={syncDirToDelete ? t('pages.kbSync.confirmDeleteSyncDir', { name: syncDirToDelete.name }) : ''}
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