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
        message: '没有失败的文件需要重试',
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
      message: `成功处理了 ${stats.successfulFiles} 个文件，失败 ${stats.failedFiles} 个文件`,
      stats 
    });
    
  } catch (error) {
    console.error('处理重试文件时出错:', error);
    return NextResponse.json({ 
      error: '处理重试文件失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

// 获取重试处理统计信息
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
    console.error('获取重试统计信息时出错:', error);
    return NextResponse.json({ 
      error: '获取统计信息失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
} 