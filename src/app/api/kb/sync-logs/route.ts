import { NextRequest, NextResponse } from 'next/server';
import {
  getSyncLogsByDirectoryId,
  getSyncLogsByKbId,
  createSyncLog,
  getSyncLogsCount,
} from './db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const syncDirectoryId = searchParams.get('syncDirectoryId');
    const kbId = searchParams.get('kbId');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    let data: any[] = [];
    let total = 0;

    if (syncDirectoryId) {
      data = await getSyncLogsByDirectoryId(Number(syncDirectoryId), limit, offset);
      total = await getSyncLogsCount(Number(syncDirectoryId));
    } else if (kbId) {
      data = await getSyncLogsByKbId(Number(kbId), limit, offset);
      total = await getSyncLogsCount(undefined, Number(kbId));
    } else {
      return NextResponse.json({ error: 'syncDirectoryId or kbId is required' }, { status: 400 });
    }

    return NextResponse.json({
      data: data.map(log => ({
        id: log.id,
        syncDirectoryId: log.syncDirectoryId,
        kbId: log.kbId,
        dirPath: log.dirPath,
        dirName: log.dirName,
        startTime: log.startTime,
        endTime: log.endTime,
        status: log.status,
        totalFiles: log.totalFiles,
        syncedFiles: log.syncedFiles,
        failedFiles: log.failedFiles,
        message: log.message,
        createdAt: log.createdAt,
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Get sync logs failed:', error);
    return NextResponse.json({ 
      error: 'Failed to get sync logs', 
      details: (error as Error).message 
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    
    if (!data.syncDirectoryId || !data.startTime || !data.status) {
      return NextResponse.json({ 
        error: 'syncDirectoryId, startTime, and status are required' 
      }, { status: 400 });
    }

    const log = await createSyncLog({
      syncDirectoryId: data.syncDirectoryId,
      kbId: data.kbId,
      dirPath: data.dirPath,
      dirName: data.dirName,
      startTime: data.startTime,
      endTime: data.endTime,
      status: data.status,
      totalFiles: data.totalFiles || 0,
      syncedFiles: data.syncedFiles || 0,
      failedFiles: data.failedFiles || 0,
      message: data.message,
    });

    return NextResponse.json({
      id: log.id,
      syncDirectoryId: log.syncDirectoryId,
      kbId: log.kbId,
      dirPath: log.dirPath,
      dirName: log.dirName,
      startTime: log.startTime,
      endTime: log.endTime,
      status: log.status,
      totalFiles: log.totalFiles,
      syncedFiles: log.syncedFiles,
      failedFiles: log.failedFiles,
      message: log.message,
      createdAt: log.createdAt,
    });
  } catch (error) {
    console.error('Create sync log failed:', error);
    return NextResponse.json({ 
      error: 'Failed to create sync log', 
      details: (error as Error).message 
    }, { status: 500 });
  }
} 