import { NextRequest, NextResponse } from 'next/server';
import { getSyncLogById, updateSyncLog } from '../db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = Number((await params).id);
    if (!id || isNaN(id)) {
      return NextResponse.json({ error: 'Invalid log ID' }, { status: 400 });
    }

    const log = await getSyncLogById(id);
    if (!log) {
      return NextResponse.json({ error: 'Sync log not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: log.id,
      syncDirectoryId: log.syncDirectoryId,
      kbId: log.kbId,
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
    console.error('Get sync log failed:', error);
    return NextResponse.json({ 
      error: 'Failed to get sync log', 
      details: (error as Error).message 
    }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = Number((await params).id);
    if (!id || isNaN(id)) {
      return NextResponse.json({ error: 'Invalid log ID' }, { status: 400 });
    }

    const data = await req.json();
    const updateData: any = {};

    // Only allow updating specific fields
    if (data.endTime !== undefined) updateData.endTime = data.endTime;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.totalFiles !== undefined) updateData.totalFiles = data.totalFiles;
    if (data.syncedFiles !== undefined) updateData.syncedFiles = data.syncedFiles;
    if (data.failedFiles !== undefined) updateData.failedFiles = data.failedFiles;
    if (data.message !== undefined) updateData.message = data.message;

    const log = await updateSyncLog(id, updateData);
    if (!log) {
      return NextResponse.json({ error: 'Sync log not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: log.id,
      syncDirectoryId: log.syncDirectoryId,
      kbId: log.kbId,
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
    console.error('Update sync log failed:', error);
    return NextResponse.json({ 
      error: 'Failed to update sync log', 
      details: (error as Error).message 
    }, { status: 500 });
  }
} 