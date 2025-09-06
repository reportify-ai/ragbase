import { db } from '../../db';
import { files, documentChunks, syncDirectories } from '../../db/schema';
import { eq, and, inArray, count, or } from 'drizzle-orm';
import { Document } from '@langchain/core/documents';
import { FileStatus } from '../../db/schema';
import { getLanceDBManager } from '../../llm';

export interface ChunkData {
  file_id: number;
  chunk_index: number;
  content: string;
  metadata: Record<string, any>;
}


export class DocumentDB {
  // Update file status
  static async updateFileStatus(
    fileId: number,
    status: FileStatus,
    errorMessage?: string
  ): Promise<void> {
    await db
      .update(files)
      .set({
        status,
        last_processed: new Date().toISOString(),
        error_message: errorMessage,
      })
      .where(eq(files.id, fileId));
  }

  // Update file metadata
  static async updateFileMetadata(
    fileId: number,
    metadata: {
      mime_type?: string;
      content_length?: number;
    }
  ): Promise<void> {
    await db
      .update(files)
      .set(metadata)
      .where(eq(files.id, fileId));
  }

  // Get file by ID
  static async getFileById(fileId: number) {
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId));
    
    return file;
  }

  // Get sync directory by ID
  static async getSyncDirectoryById(dirId: number) {
    const [directory] = await db
      .select()
      .from(syncDirectories)
      .where(eq(syncDirectories.id, dirId));
    
    return directory;
  }

  // Batch insert document chunks
  static async insertChunks(chunks: ChunkData[]): Promise<number[]> {
    if (chunks.length === 0) return [];

    const chunkData = chunks.map(chunk => ({
      file_id: chunk.file_id,
      chunk_index: chunk.chunk_index,
      content: chunk.content,
      metadata: JSON.stringify(chunk.metadata),
    }));

    const result = await db.insert(documentChunks).values(chunkData);
    
    // Due to SQLite limitations, we need to manually get the inserted IDs
    const insertedChunks = await db
      .select({ id: documentChunks.id })
      .from(documentChunks)
      .where(eq(documentChunks.file_id, chunks[0].file_id))
      .orderBy(documentChunks.id)
      .limit(chunks.length);

    return insertedChunks.map(chunk => chunk.id);
  }

  // Insert a single document chunk
  static async insertChunk(chunk: ChunkData): Promise<number> {
    const result = await db.insert(documentChunks).values({
      file_id: chunk.file_id,
      chunk_index: chunk.chunk_index,
      content: chunk.content,
      metadata: JSON.stringify(chunk.metadata),
    });

    // Get the inserted ID
    const insertedChunk = await db
      .select({ id: documentChunks.id })
      .from(documentChunks)
      .where(eq(documentChunks.file_id, chunk.file_id))
      .orderBy(documentChunks.id)
      .limit(1);

    return insertedChunk[0]?.id || 0;
  }


  // Get all chunks for a file
  static async getFileChunks(fileId: number): Promise<Document[]> {
    const chunks = await db
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.file_id, fileId))
      .orderBy(documentChunks.chunk_index);

    // Get file information to add more metadata
    const [fileInfo] = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId));

    if (!chunks.length) {
      return [];
    }

    return chunks.map(chunk => {
      // Parse original metadata
      const rawMetadata = JSON.parse(chunk.metadata || '{}') as Record<string, any>;
      
      // Create standardized metadata object
      const metadata: Record<string, any> = {
        chunkId: chunk.id,
        chunkIndex: chunk.chunk_index,
        fileId: chunk.file_id,
        // Add standard fields to ensure all documents have these fields
        fileName: fileInfo?.name || '',
        filePath: fileInfo?.path || '',
        fileSize: fileInfo?.size || 0,
        mimeType: fileInfo?.mime_type || '',
        pageNumber: rawMetadata.pageNumber || 1,
        totalPages: rawMetadata.totalPages || 1,
        originalFile: fileInfo?.name || '',
        processedAt: rawMetadata.processedAt || new Date().toISOString(),
      };

      return new Document({
        pageContent: chunk.content,
        metadata: metadata,
      });
    });
  }


  // Delete all chunks for a file
  static async deleteFileData(fileId: number): Promise<void> {
    // Delete chunk data
    await db
      .delete(documentChunks)
      .where(eq(documentChunks.file_id, fileId));
  }

  // Get pending files
  static async getPendingFiles(limit: number = 10): Promise<Array<{
    id: number;
    name: string;
    path: string;
    size: number;
    status: number;
  }>> {
    return await db
      .select({
        id: files.id,
        name: files.name,
        path: files.path,
        size: files.size,
        status: files.status,
      })
      .from(files)
      .where(eq(files.status, FileStatus.PENDING))
      .limit(limit);
  }

  // Get failed files
  static async getFailedFiles(limit: number = 10): Promise<Array<{
    id: number;
    name: string;
    path: string;
    error_message: string | null;
  }>> {
    return await db
      .select({
        id: files.id,
        name: files.name,
        path: files.path,
        error_message: files.error_message,
      })
      .from(files)
      .where(or(
        eq(files.status, FileStatus.FAILED),
        eq(files.status, FileStatus.EMBEDDING_FAILED)
      ))
      .limit(limit);
  }

  // Get file processing statistics
  static async getFileStats(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const stats = await db
      .select({
        status: files.status,
        count: count(files.id),
      })
      .from(files)
      .groupBy(files.status);

    const result = {
      total: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    stats.forEach(stat => {
      const count = Number(stat.count);
      result.total += count;
      
      switch (stat.status) {
        case FileStatus.PENDING:
          result.pending += count;
          break;
        case FileStatus.PARSING:
        case FileStatus.CHUNKING:
        case FileStatus.EMBEDDING:
          result.processing += count;
          break;
        case FileStatus.COMPLETED:
          result.completed += count;
          break;
        case FileStatus.FAILED:
        case FileStatus.EMBEDDING_FAILED:
          result.failed += count;
          break;
      }
    });

    return result;
  }

  // Get chunk statistics
  static async getChunkStats(): Promise<{
    totalChunks: number;
    averageChunksPerFile: number;
  }> {
    const [chunksResult] = await db
      .select({ count: count() })
      .from(documentChunks);
    
    const [filesResult] = await db
      .select({ count: count() })
      .from(files)
      .where(eq(files.status, FileStatus.COMPLETED));
    
    const totalChunks = Number(chunksResult?.count || 0);
    const completedFiles = Number(filesResult?.count || 0);
    
    return {
      totalChunks,
      averageChunksPerFile: completedFiles > 0 ? totalChunks / completedFiles : 0,
    };
  }

  // Delete all files and related data from a specific sync directory
  static async deleteFilesBySyncDirectoryId(syncDirectoryId: number, kbId: number): Promise<{
    deletedFiles: number;
    deletedChunks: number;
    vectorDeletionSuccessCount: number;
    vectorDeletionFailureCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let deletedFiles = 0;
    let deletedChunks = 0;
    let vectorDeletionSuccessCount = 0;
    let vectorDeletionFailureCount = 0;

    try {
      // Step 1: Get all files in the sync directory
      const filesToDelete = await db
        .select({ 
          id: files.id, 
          name: files.name,
          path: files.path 
        })
        .from(files)
        .where(eq(files.sync_directory_id, syncDirectoryId));

      console.log(`[DocumentDB] Found ${filesToDelete.length} files to delete in sync directory ${syncDirectoryId}`);

      if (filesToDelete.length === 0) {
        return { 
          deletedFiles: 0, 
          deletedChunks: 0, 
          vectorDeletionSuccessCount: 0,
          vectorDeletionFailureCount: 0,
          errors: [] 
        };
      }

      const fileIds = filesToDelete.map(f => f.id);

      // Step 2: Get chunk counts for statistics
      const chunkCount = await db
        .select({ count: count() })
        .from(documentChunks)
        .where(inArray(documentChunks.file_id, fileIds));
      
      const totalChunks = Number(chunkCount[0]?.count || 0);

      console.log(`[DocumentDB] Deletion statistics - Files: ${filesToDelete.length}, Chunks: ${totalChunks}`);

      // Step 4: Delete vector data from LanceDB (batch operation)
      try {
        const tableName = `kb_${kbId}`;
        console.log(`[DocumentDB] Starting batch vector deletion from LanceDB table: ${tableName} for ${filesToDelete.length} files`);
        const lanceManager = await getLanceDBManager(tableName);
        
        const fileIds = filesToDelete.map(f => f.id);
        const batchResult = await lanceManager.deleteDocumentsByFileIds(fileIds);
        
        vectorDeletionSuccessCount = batchResult.successCount;
        vectorDeletionFailureCount = batchResult.failureCount;
        
        if (batchResult.errors.length > 0) {
          errors.push(...batchResult.errors);
        }
        
        console.log(`[DocumentDB] Batch vector deletion completed: ${batchResult.totalDeleted} documents deleted, ${vectorDeletionSuccessCount} files succeeded, ${vectorDeletionFailureCount} files failed`);
        
      } catch (error) {
        vectorDeletionFailureCount = filesToDelete.length; // All files failed if we can't access LanceDB
        const errorMsg = `Error accessing LanceDB for knowledge base ${kbId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(`[DocumentDB] ${errorMsg}`, error);
      }

      // Step 5: Delete document chunks from database
      if (totalChunks > 0) {
        await db
          .delete(documentChunks)
          .where(inArray(documentChunks.file_id, fileIds));
        
        deletedChunks = totalChunks;
        console.log(`[DocumentDB] Deleted ${deletedChunks} document chunks`);
      }

      // Step 6: Delete file records from database
      await db
        .delete(files)
        .where(inArray(files.id, fileIds));
      
      deletedFiles = filesToDelete.length;
      console.log(`[DocumentDB] Deleted ${deletedFiles} file records`);

      console.log(`[DocumentDB] Successfully cleaned up sync directory ${syncDirectoryId}: ${deletedFiles} files, ${deletedChunks} chunks, ${vectorDeletionSuccessCount} vector deletions succeeded, ${vectorDeletionFailureCount} vector deletions failed`);
      
      return {
        deletedFiles,
        deletedChunks,
        vectorDeletionSuccessCount,
        vectorDeletionFailureCount,
        errors
      };

    } catch (error) {
      const errorMsg = `Critical error during batch deletion for sync directory ${syncDirectoryId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.error(errorMsg, error);
      
      return {
        deletedFiles,
        deletedChunks,
        vectorDeletionSuccessCount,
        vectorDeletionFailureCount,
        errors
      };
    }
  }
} 