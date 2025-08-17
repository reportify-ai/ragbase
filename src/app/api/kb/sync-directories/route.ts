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

export async function GET(req: NextRequest) {
  const kbId = Number(req.nextUrl.searchParams.get('kbId'));
  if (!kbId) return NextResponse.json({ error: 'kbId required' }, { status: 400 });
  const dirs = await getSyncDirectoriesByKbId(kbId);
  
  // For each directory, get the latest sync time
  const data = await Promise.all((dirs || []).map(async (dir: any) => {
    const latestSyncTime = await getLatestSyncTime(dir.id);
    return {
      id: dir.id,
      name: dir.dirPath.split('/').pop() || dir.dirPath,
      path: dir.dirPath,
      syncType: dir.syncType === 'realtime' ? 'Real-time Sync' : 'Manual Sync',
      last: latestSyncTime ? new Date(latestSyncTime).toLocaleString('en-US') : 'Never synced',
      status: latestSyncTime ? 'Synced' : 'Not synced',
    };
  }));
  
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  
  // Check if directory already exists
  const existingDir = await checkSyncDirectoryExists(data.kbId, data.dirPath);
  if (existingDir) {
    return NextResponse.json({ 
      error: 'Directory already exists', 
      message: `Directory "${data.dirPath}" already exists in the knowledge base, please select another directory or use the existing one` 
    }, { status: 409 });
  }
  
  const dir = await createSyncDirectory(data);

  // New: When adding a directory for the first time, write a sync log
  const now = new Date().toISOString();
  await createSyncLog({
    syncDirectoryId: dir.id,
    kbId: dir.kbId,
    startTime: now,
    endTime: now,
    status: 'success',
    totalFiles: 0,
    syncedFiles: 0,
    failedFiles: 0,
    message: 'Automatic record for first-time directory addition',
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
  try {
    const { syncDirectoryId } = await req.json();
    
    if (!syncDirectoryId) {
      return NextResponse.json({ error: 'syncDirectoryId is required' }, { status: 400 });
    }
    
    const dir = await getSyncDirectoryById(syncDirectoryId);
    if (!dir) {
      return NextResponse.json({ error: 'Sync directory not found' }, { status: 404 });
    }
    
    // Create sync log record
    const startTime = new Date().toISOString();
    const log = await createSyncLog({
      syncDirectoryId: dir.id,
      kbId: dir.kbId,
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
        message: 'Sync completed',
      });
      
      return NextResponse.json({ 
        success: true, 
        message: `Manual sync triggered for directory ${dir.dirPath}`,
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
      error: 'Manual sync failed', 
      details: (error as Error).message 
    }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const data = await req.json();
  if (!data.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  
  // If updating directory path, check for conflicts with other records
  if (data.dirPath) {
    const existingDir = await checkSyncDirectoryExistsExcludeId(data.kbId, data.dirPath, data.id);
    if (existingDir) {
      return NextResponse.json({ 
        error: 'Directory already exists', 
        message: `Directory "${data.dirPath}" already exists in the knowledge base, please select another directory or use the existing one` 
      }, { status: 409 });
    }
  }
  
  const dir = await updateSyncDirectory(data.id, data);
  return NextResponse.json(dir);
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await deleteSyncDirectory(id);
  return NextResponse.json({ success: true });
} 