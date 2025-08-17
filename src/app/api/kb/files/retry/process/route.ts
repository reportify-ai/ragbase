import { NextRequest, NextResponse } from 'next/server';
import { DocumentService } from '../../../../../../lib/document/service';
import { DocumentProcessor } from '../../../../../../lib/document/processors';
import { getFailedFiles, getFailedFilesCount } from '../../db';
import { getSyncDirectoriesByKbId } from '../../../sync-directories/db';

// Process retry files
export async function POST(req: NextRequest) {
  const { kbId, limit = 10, options = {} } = await req.json();
  
  try {
    let failedFiles;
    
    if (kbId) {
      const dirs = await getSyncDirectoriesByKbId(Number(kbId));
      const syncDirectoryIds = dirs.map(d => d.id);
      failedFiles = await getFailedFiles(syncDirectoryIds, limit);
    } else {
      failedFiles = await getFailedFiles(undefined, limit);
    }
    
    if (failedFiles.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No failed files need to be retried',
        stats: {
          totalFiles: 0,
          successfulFiles: 0,
          failedFiles: 0,
          successRate: 0,
          totalChunks: 0,
          totalSize: 0,
          totalTime: 0,
          averageTimePerFile: 0,
          errors: []
        }
      });
    }
    
    // Reset file status to pending
    const fileIds = failedFiles.map(f => f.id);
    const filePaths = failedFiles.map(f => f.path);
    
    // Use DocumentService to reprocess files
    const results = await DocumentService.processFiles(fileIds, filePaths, options);
    const stats = DocumentProcessor.getProcessingStats(results);
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully processed ${stats.successfulFiles} files, failed ${stats.failedFiles} files`,
      stats 
    });
    
  } catch (error) {
    console.error('Error processing retry files:', error);
    return NextResponse.json({ 
      error: 'Processing retry files failed', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

// Get retry processing statistics
export async function GET(req: NextRequest) {
  const kbId = req.nextUrl.searchParams.get('kbId');
  
  try {
    let failedFilesCount = 0;
    
    if (kbId) {
      const dirs = await getSyncDirectoriesByKbId(Number(kbId));
      const syncDirectoryIds = dirs.map(d => d.id);
      failedFilesCount = await getFailedFilesCount(syncDirectoryIds);
    } else {
      failedFilesCount = await getFailedFilesCount();
    }
    
    const stats = await DocumentService.getStats();
    
    return NextResponse.json({
      failedFilesCount,
      fileStats: stats.fileStats,
      chunkStats: stats.chunkStats
    });
    
  } catch (error) {
    console.error('Error getting retry statistics:', error);
    return NextResponse.json({ 
      error: 'Failed to get statistics', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
} 