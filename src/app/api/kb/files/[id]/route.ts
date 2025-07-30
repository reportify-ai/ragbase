import { NextRequest, NextResponse } from 'next/server';
import { DocumentDB } from '../../../../../lib/document/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const fileId = parseInt((await params).id);
    if (!fileId || isNaN(fileId)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }
    
    const fileInfo = await DocumentDB.getFileById(fileId);
    
    if (!fileInfo) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ data: fileInfo });
  } catch (error) {
    console.error("Error fetching file info:", error);
    return NextResponse.json(
      { error: `Failed to fetch file info: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
} 