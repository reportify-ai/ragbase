import { NextRequest, NextResponse } from 'next/server';
import { getFailedFiles, getFailedFilesCount, resetFileForRetry, resetFilesForRetry } from '../db';
import { getSyncDirectoriesByKbId } from '../../sync-directories/db';

// Get failed files list
export async function GET(req: NextRequest) {
  const kbId = req.nextUrl.searchParams.get('kbId');
  const limit = req.nextUrl.searchParams.get('limit');
  const offset = req.nextUrl.searchParams.get('offset');
  const limitNum = limit ? Number(limit) : undefined;
  const offsetNum = offset ? Number(offset) : undefined;
  
  if (kbId) {
    const kbIdNum = Number(kbId);
    // Query failed files directly through kb_id
    const [files, total] = await Promise.all([
      getFailedFiles(undefined, kbIdNum, limitNum, offsetNum),
      getFailedFilesCount(undefined, kbIdNum)
    ]);
    return NextResponse.json({ data: files, total });
  }
  
  const [files, total] = await Promise.all([
    getFailedFiles(undefined, undefined, limitNum, offsetNum),
    getFailedFilesCount()
  ]);
  return NextResponse.json({ data: files, total });
}

// Retry single file processing
export async function POST(req: NextRequest) {
  const { id } = await req.json();
  
  if (!id) {
    return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
  }
  
  try {
    const file = await resetFileForRetry(Number(id));
    return NextResponse.json({ success: true, data: file });
  } catch (error) {
    return NextResponse.json({ error: 'Retry failed' }, { status: 500 });
  }
}

// Batch retry file processing
export async function PUT(req: NextRequest) {
  const { ids } = await req.json();
  
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'File IDs list is required' }, { status: 400 });
  }
  
  try {
    const files = await resetFilesForRetry(ids.map(id => Number(id)));
    return NextResponse.json({ success: true, data: files });
  } catch (error) {
    return NextResponse.json({ error: 'Batch retry failed' }, { status: 500 });
  }
} 