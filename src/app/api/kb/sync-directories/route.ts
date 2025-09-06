import { NextRequest, NextResponse } from 'next/server';
import {
  getSyncDirectoriesByKbId,
  getSyncDirectoryById,
  createSyncDirectory,
  updateSyncDirectory,
  deleteSyncDirectory,
  checkSyncDirectoryExists,
  checkSyncDirectoryExistsExcludeId,
  getLatestSyncTime,
} from './db';
import { createScanFilesTask, createRealtimeScanTask } from '../../../tasks/sync';
import { createSyncLog, updateSyncLog } from '../sync-logs/db';
import { createServerTranslator } from '@/lib/server-i18n';

export async function GET(req: NextRequest) {
  const t = await createServerTranslator(req);
  
  const kbId = Number(req.nextUrl.searchParams.get('kbId'));
  if (!kbId) {
    return NextResponse.json({ error: t.t('api.errors.kbIdRequired') }, { status: 400 });
  }
  
  const dirs = await getSyncDirectoriesByKbId(kbId);
  
  // For each directory, get the latest sync time
  const data = await Promise.all((dirs || []).map(async (dir: any) => {
    const latestSyncTime = await getLatestSyncTime(dir.id);
    return {
      id: dir.id,
      name: dir.dirPath.split('/').pop() || dir.dirPath,
      path: dir.dirPath,
      syncType: dir.syncType === 'realtime' ? 'Real-time sync' : 'Manual sync',
      last: latestSyncTime || null,
      status: latestSyncTime ? 'Synced' : 'Not synced',
    };
  }));
  
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const t = await createServerTranslator(req);
  const data = await req.json();
  
  // Check if directory already exists
  const existingDir = await checkSyncDirectoryExists(data.kbId, data.dirPath);
  if (existingDir) {
    return NextResponse.json({ 
      error: t.t('api.errors.directoryAlreadyExists'), 
      message: t.t('api.errors.directoryExistsMessage', { dirPath: data.dirPath })
    }, { status: 409 });
  }
  
  const dir = await createSyncDirectory(data);

  // New: When adding a directory for the first time, write a sync log
  const now = new Date().toISOString();
  await createSyncLog({
    syncDirectoryId: dir.id,
    kbId: dir.kbId,
    dirPath: dir.dirPath,
    dirName: dir.dirPath.split('/').pop() || dir.dirPath,
    startTime: now,
    endTime: now,
    status: 'success',
    totalFiles: 0,
    syncedFiles: 0,
    failedFiles: 0,
    message: t.t('api.messages.firstTimeAddingDirectory'),
  });

  await createScanFilesTask({
    scanPath: dir.dirPath,
    syncDirectoryId: dir.id,
  })();

  if (dir.syncType === 'realtime') {
    console.log('[SyncDirectories] Creating realtime scan task for directory:', dir.dirPath);
    createRealtimeScanTask(dir.dirPath, dir.id, dir.kbId)();
  }
  return NextResponse.json(dir);
}

export async function PATCH(req: NextRequest) {
  const t = await createServerTranslator(req);
  
  try {
    const { syncDirectoryId } = await req.json();
    
    if (!syncDirectoryId) {
      return NextResponse.json({ error: t.t('api.errors.syncDirectoryIdRequired') }, { status: 400 });
    }
    
    const dir = await getSyncDirectoryById(syncDirectoryId);
    if (!dir) {
      return NextResponse.json({ error: t.t('api.errors.syncDirectoryNotFound') }, { status: 404 });
    }
    
    // Create sync log record
    const startTime = new Date().toISOString();
    const log = await createSyncLog({
      syncDirectoryId: dir.id,
      kbId: dir.kbId,
      dirPath: dir.dirPath,
      dirName: dir.dirPath.split('/').pop() || dir.dirPath,
      startTime,
      status: 'running',
      totalFiles: 0,
      syncedFiles: 0,
      failedFiles: 0,
    });
    
    try {
      await createScanFilesTask({
        scanPath: dir.dirPath,
        syncDirectoryId: dir.id,
      })();
      
      // Update log to success status
      await updateSyncLog(log.id, {
        endTime: new Date().toISOString(),
        status: 'success',
        message: t.t('api.messages.syncCompleted'),
      });
      
      return NextResponse.json({ 
        success: true, 
        message: t.t('api.messages.manualSyncTriggered', { dirPath: dir.dirPath }),
        logId: log.id,
      });
    } catch (error) {
      // Update log to failed status
      await updateSyncLog(log.id, {
        endTime: new Date().toISOString(),
        status: 'failed',
        message: (error as Error).message,
      });
      
      throw error;
    }
  } catch (error) {
    console.error('Manual sync folder failed:', error);
    return NextResponse.json({ 
      error: t.t('api.errors.manualSyncFailed'), 
      details: (error as Error).message 
    }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const t = await createServerTranslator(req);
  const data = await req.json();
  
  if (!data.id) {
    return NextResponse.json({ error: t.t('api.errors.idRequired') }, { status: 400 });
  }
  
  // If updating directory path, check for conflicts with other records
  if (data.dirPath) {
    const existingDir = await checkSyncDirectoryExistsExcludeId(data.kbId, data.dirPath, data.id);
    if (existingDir) {
      return NextResponse.json({ 
        error: t.t('api.errors.directoryAlreadyExists'), 
        message: t.t('api.errors.directoryExistsMessage', { dirPath: data.dirPath })
      }, { status: 409 });
    }
  }
  
  const dir = await updateSyncDirectory(data.id, data);
  return NextResponse.json(dir);
}

export async function DELETE(req: NextRequest) {
  const t = await createServerTranslator(req);
  
  try {
    const { id, cleanData } = await req.json();
    
    if (!id) {
      return NextResponse.json({ error: t.t('api.errors.idRequired') }, { status: 400 });
    }

    let deletionResult = null;

    // If cleanData is explicitly set or system setting is enabled, clean up related data
    if (cleanData) {
      // Get sync directory info to get knowledge base ID
      const syncDirInfo = await getSyncDirectoryById(id);
      if (!syncDirInfo) {
        return NextResponse.json({ error: t.t('api.errors.syncDirectoryNotFound') }, { status: 404 });
      }

      console.log(`[DeleteSyncDirectory] Cleaning data for sync directory ${id} in KB ${syncDirInfo.kbId}`);
      
      // Import DocumentDB here to avoid circular imports
      const { DocumentDB } = await import('@/lib/document/db');
      
      // Delete all files and related data from this sync directory
      deletionResult = await DocumentDB.deleteFilesBySyncDirectoryId(id, syncDirInfo.kbId);
      
      console.log(`[DeleteSyncDirectory] Data cleanup completed:`, deletionResult);
    }

    // Delete the sync directory record
    await deleteSyncDirectory(id);
    
    console.log(`[DeleteSyncDirectory] Sync directory ${id} deleted successfully`);

    const response: any = { 
      success: true, 
      message: t.t('api.messages.syncDirectoryDeletedSuccessfully') 
    };

    // Include deletion statistics if data was cleaned
    if (deletionResult) {
      response.deletionResult = deletionResult;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to delete sync directory:', error);
    return NextResponse.json(
      { 
        error: t.t('api.errors.deleteSyncDirectoryFailed'), 
        details: error instanceof Error ? error.message : t.t('api.errors.unknownError') 
      },
      { status: 500 }
    );
  }
} 