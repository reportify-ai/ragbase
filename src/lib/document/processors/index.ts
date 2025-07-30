import { Document } from '@langchain/core/documents';
import { DocumentLoader, DocumentLoadResult } from '../loaders';
import { DocumentSplitter, SplitResult } from '../splitters';
import path from 'path';

export interface ProcessingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  useFileTypeOptimization?: boolean;
}

export interface ProcessingResult {
  filePath: string;
  fileName: string;
  success: boolean;
  documents: Document[];
  chunks: Document[];
  metadata: {
    fileSize: number;
    mimeType: string;
    originalDocumentCount: number;
    totalChunks: number;
    averageChunkSize: number;
    processingTime: number;
    error?: string;
  };
}

export class DocumentProcessor {
  static async processFile(
    filePath: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const fileName = path.basename(filePath);
    
    try {
      // Check if file type is supported
      if (!DocumentLoader.isSupportedFile(filePath)) {
        throw new Error(`Unsupported file type: ${path.extname(filePath)}`);
      }

      // Load document
      const loadResult = await DocumentLoader.loadDocument(filePath);
      
      if (loadResult.documents.length === 0) {
        throw new Error(loadResult.metadata.error || 'Document loading failed');
      }

      // Split document
      let splitResult: SplitResult;
      if (options.useFileTypeOptimization) {
        const fileType = path.extname(filePath);
        splitResult = await DocumentSplitter.splitByFileType(loadResult.documents, fileType);
        console.log('[DocumentProcessor] SplitResult:Chunks', splitResult.chunks.slice(0, 5));
      } else {
        splitResult = await DocumentSplitter.splitDocuments(loadResult.documents, {
          chunkSize: options.chunkSize,
          chunkOverlap: options.chunkOverlap,
        });
      }

      const processingTime = Date.now() - startTime;

      return {
        filePath,
        fileName,
        success: true,
        documents: loadResult.documents,
        chunks: splitResult.chunks,
        metadata: {
          fileSize: loadResult.metadata.fileSize,
          mimeType: loadResult.metadata.mimeType,
          originalDocumentCount: splitResult.metadata.originalDocumentCount,
          totalChunks: splitResult.metadata.totalChunks,
          averageChunkSize: splitResult.metadata.averageChunkSize,
          processingTime,
        },
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      return {
        filePath,
        fileName,
        success: false,
        documents: [],
        chunks: [],
        metadata: {
          fileSize: 0,
          mimeType: 'unknown',
          originalDocumentCount: 0,
          totalChunks: 0,
          averageChunkSize: 0,
          processingTime,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  static async processFiles(
    filePaths: string[],
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    
    for (const filePath of filePaths) {
      try {
        const result = await this.processFile(filePath, options);
        results.push(result);
      } catch (error) {
        console.error(`Failed to process file: ${filePath}`, error);
        results.push({
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
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    return results;
  }

  static async processFilesBatch(
    filePaths: string[],
    options: ProcessingOptions = {},
    batchSize: number = 5
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    
    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(filePath => this.processFile(filePath, options))
      );
      results.push(...batchResults);
      
      // Add small delay to avoid overload
      if (i + batchSize < filePaths.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  // Get processing statistics
  static getProcessingStats(results: ProcessingResult[]) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    const totalFiles = results.length;
    const totalChunks = successful.reduce((sum, r) => sum + r.metadata.totalChunks, 0);
    const totalSize = successful.reduce((sum, r) => sum + r.metadata.fileSize, 0);
    const totalTime = results.reduce((sum, r) => sum + r.metadata.processingTime, 0);
    
    return {
      totalFiles,
      successfulFiles: successful.length,
      failedFiles: failed.length,
      successRate: totalFiles > 0 ? (successful.length / totalFiles) * 100 : 0,
      totalChunks,
      totalSize,
      totalTime,
      averageTimePerFile: totalFiles > 0 ? totalTime / totalFiles : 0,
      errors: failed.map(r => ({ file: r.fileName, error: r.metadata.error })),
    };
  }
} 