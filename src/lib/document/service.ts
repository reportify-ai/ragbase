import { DocumentProcessor, ProcessingResult } from './processors';
import { DocumentDB, ChunkData } from './db';
import { FileStatus } from '../../db/schema';
import path from 'path';
import { Document } from '@langchain/core/documents';
import { getLanceDBManager } from '../../llm';

export interface ProcessingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  useFileTypeOptimization?: boolean;
  batchSize?: number;
}

export interface ProcessingStats {
  totalFiles: number;
  successfulFiles: number;
  failedFiles: number;
  successRate: number;
  totalChunks: number;
  totalSize: number;
  totalTime: number;
  averageTimePerFile: number;
  errors: Array<{ file: string; error: string | undefined }>;
}

export class DocumentService {
  /**
   * Process a single file
   */
  static async processFile(
    fileId: number,
    filePath: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    try {
      // Update file status to parsing
      await DocumentDB.updateFileStatus(fileId, FileStatus.PARSING);

      // Process document
      const result = await DocumentProcessor.processFile(filePath, options);

      if (!result.success) {
        // Processing failed
        await DocumentDB.updateFileStatus(fileId, FileStatus.FAILED, result.metadata.error);
        return result;
      }

      // Update file status to parsed
      await DocumentDB.updateFileStatus(fileId, FileStatus.PARSED);

      // Update file metadata
      await DocumentDB.updateFileMetadata(fileId, {
        mime_type: result.metadata.mimeType,
        content_length: result.metadata.fileSize,
      });

      // Update file status to chunking
      await DocumentDB.updateFileStatus(fileId, FileStatus.CHUNKING);

      // Prepare chunk data
      const chunks: ChunkData[] = result.chunks.map((chunk, index) => ({
        file_id: fileId,
        chunk_index: index,
        content: chunk.pageContent,
        metadata: {
          ...chunk.metadata,
          originalFile: path.basename(filePath),
          processedAt: new Date().toISOString(),
        },
      }));

      // Store chunks to database
      await DocumentDB.insertChunks(chunks);

      // Update file status to chunked
      await DocumentDB.updateFileStatus(fileId, FileStatus.CHUNKED);

      // Get file information to determine which knowledge base it belongs to
      const fileInfo = await DocumentDB.getFileById(fileId);
      if (!fileInfo) {
        throw new Error(`File with ID ${fileId} not found`);
      }

      // Get directory info to determine knowledge base ID
      const dirInfo = await DocumentDB.getSyncDirectoryById(fileInfo.sync_directory_id);
      if (!dirInfo) {
        throw new Error(`Sync directory with ID ${fileInfo.sync_directory_id} not found`);
      }

      // Update file status to embedding
      await DocumentDB.updateFileStatus(fileId, FileStatus.EMBEDDING);

      // Unify field structure to ensure all file types generate Document objects with consistent field structure
      const documents = chunks.map(chunk => {
        // Extract original metadata, use type assertion to handle possible additional fields
        const rawMetadata = chunk.metadata as Record<string, any>;
        
        // Create standardized metadata object
        const metadata: Record<string, any> = {
          fileId: fileId,
          kbId: dirInfo.kbId,
          fileName: path.basename(filePath),
          filePath: filePath,
          fileSize: rawMetadata.fileSize || 0,
          mimeType: rawMetadata.mimeType || 'unknown',
          pageNumber: rawMetadata.pageNumber || 1,
          totalPages: rawMetadata.totalPages || 1,
          chunkIndex: chunk.chunk_index,
          totalChunks: rawMetadata.totalChunks || 1,
          processedAt: rawMetadata.processedAt || new Date().toISOString(),
        };

        // Remove unnecessary fields
        if (rawMetadata.loc) {
          // Don't copy loc field to final metadata object
        }

        return new Document({
          pageContent: path.basename(filePath) + "\n" + chunk.content,
          metadata: metadata
        });
      });

      // console.log("[DocumentService] documents:", documents.slice(0, 3));

      try {
        // Get LanceDB manager for this knowledge base
        // Use kb_{kbId} as table name to separate different knowledge bases
        const tableName = `kb_${dirInfo.kbId}`;
        const lanceManager = await getLanceDBManager(tableName);

        // Add documents to vector store
        await lanceManager.addDocuments(documents);

        // Update file status to completed
        await DocumentDB.updateFileStatus(fileId, FileStatus.COMPLETED);
      } catch (embeddingError) {
        console.error(`Error during embedding for file ${fileId}:`, embeddingError);
        await DocumentDB.updateFileStatus(fileId, FileStatus.EMBEDDING_FAILED, 
          `Embedding failed: ${embeddingError instanceof Error ? embeddingError.message : String(embeddingError)}`);
        // throw embeddingError;
        result.success = false;
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await DocumentDB.updateFileStatus(fileId, FileStatus.FAILED, errorMessage);
      
      return {
        filePath,
        fileName: path.basename(filePath),
        success: false,
        documents: [],
        chunks: [],
        metadata: {
          fileSize: 0,
          mimeType: 'unknown',
          originalDocumentCount: 0,
          totalChunks: 0,
          averageChunkSize: 0,
          processingTime: 0,
          error: errorMessage,
        },
      };
    }
  }

  /**
   * Process files in batch
   */
  static async processFiles(
    fileIds: number[],
    filePaths: string[],
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    const batchSize = options.batchSize || 5;

    for (let i = 0; i < fileIds.length; i += batchSize) {
      const batchIds = fileIds.slice(i, i + batchSize);
      const batchPaths = filePaths.slice(i, i + batchSize);

      const batchPromises = batchIds.map((fileId, index) =>
        this.processFile(fileId, batchPaths[index], options)
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add delay to avoid overload
      if (i + batchSize < fileIds.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return results;
  }

  /**
   * Process pending files
   */
  static async processPendingFiles(
    limit: number = 10,
    options: ProcessingOptions = {}
  ): Promise<ProcessingStats> {
    const pendingFiles = await DocumentDB.getPendingFiles(limit);
    
    if (pendingFiles.length === 0) {
      return {
        totalFiles: 0,
        successfulFiles: 0,
        failedFiles: 0,
        successRate: 0,
        totalChunks: 0,
        totalSize: 0,
        totalTime: 0,
        averageTimePerFile: 0,
        errors: [],
      };
    }

    const fileIds = pendingFiles.map(f => f.id);
    const filePaths = pendingFiles.map(f => f.path);

    const results = await this.processFiles(fileIds, filePaths, options);
    return DocumentProcessor.getProcessingStats(results);
  }

  /**
   * Reprocess failed files
   */
  static async reprocessFailedFiles(
    limit: number = 10,
    options: ProcessingOptions = {}
  ): Promise<ProcessingStats> {
    const failedFiles = await DocumentDB.getFailedFiles(limit);
    
    if (failedFiles.length === 0) {
      return {
        totalFiles: 0,
        successfulFiles: 0,
        failedFiles: 0,
        successRate: 0,
        totalChunks: 0,
        totalSize: 0,
        totalTime: 0,
        averageTimePerFile: 0,
        errors: [],
      };
    }

    const fileIds = failedFiles.map(f => f.id);
    const filePaths = failedFiles.map(f => f.path);

    const results = await this.processFiles(fileIds, filePaths, options);
    return DocumentProcessor.getProcessingStats(results);
  }

  /**
   * Delete all data for a file
   */
  static async deleteFileData(fileId: number): Promise<void> {
    await DocumentDB.deleteFileData(fileId);
    await DocumentDB.updateFileStatus(fileId, FileStatus.PENDING);
  }

  /**
   * Get processing statistics
   */
  static async getStats(): Promise<{
    fileStats: {
      total: number;
      pending: number;
      processing: number;
      completed: number;
      failed: number;
    };
    chunkStats: {
      totalChunks: number;
      averageChunksPerFile: number;
    };
  }> {
    const [fileStats, chunkStats] = await Promise.all([
      DocumentDB.getFileStats(),
      DocumentDB.getChunkStats(),
    ]);

    return { fileStats, chunkStats };
  }

  /**
   * Get chunks for a file
   */
  static async getFileChunks(fileId: number): Promise<any[]> {
    return await DocumentDB.getFileChunks(fileId);
  }

} 