import { NextRequest, NextResponse } from 'next/server';
import { getFiles, createFile, updateFile, deleteFile, getFilesCount } from './db';
import { getSyncDirectoriesByKbId } from '../sync-directories/db';
import { db } from '../../../../db';
import { files, kbs } from '../../../../db/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const kbId = req.nextUrl.searchParams.get('kbId');
  const limit = req.nextUrl.searchParams.get('limit');
  const offset = req.nextUrl.searchParams.get('offset');
  const limitNum = limit ? Number(limit) : undefined;
  const offsetNum = offset ? Number(offset) : undefined;
  
  let filesData;
  let total;
  
  if (kbId) {
    const kbIdNum = Number(kbId);
    // Query files directly through kb_id
    [filesData, total] = await Promise.all([
      getFiles(undefined, kbIdNum, limitNum, offsetNum),
      getFilesCount(undefined, kbIdNum)
    ]);
  } else {
    [filesData, total] = await Promise.all([
      getFiles(undefined, undefined, limitNum, offsetNum),
      getFilesCount()
    ]);
  }
  
  // Get all knowledge base information, for filling knowledge base name
  const kbsData = await db.select().from(kbs);
  const kbsMap = new Map(kbsData.map(kb => [kb.id, kb.name]));
  
  // Add knowledge base name to each file
  const filesWithKbName = filesData.map(file => ({
    ...file,
    kb_name: kbsMap.get(file.kb_id) || '未知知识库'
  }));
  
  return NextResponse.json({ data: filesWithKbName, total });
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  
  // Ensure file data contains kb_id
  if (!data.kb_id) {
    return NextResponse.json({ error: 'kb_id is required' }, { status: 400 });
  }
  
  const file = await createFile(data);
  return NextResponse.json(file);
}

export async function PUT(req: NextRequest) {
  const data = await req.json();
  const file = await updateFile(data.id, data);
  return NextResponse.json(file);
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await deleteFile(id);
  return NextResponse.json({ success: true });
} 