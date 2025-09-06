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
  // Special Excel splitting method that preserves headers in each chunk for each sheet
  private static async splitExcelWithHeaders(documents: Document[]): Promise<SplitResult> {
    if (documents.length === 0) {
      return {
        chunks: [],
        metadata: {
          originalDocumentCount: 0,
          totalChunks: 0,
          averageChunkSize: 0,
        },
      };
    }

    const allChunks: Document[] = [];
    
    // 处理每个Excel sheet（每个Document代表一个sheet）
    for (const doc of documents) {
      const excelTableHeader = doc.metadata?.excelTableHeader as string;
      const excelHeaderRow = doc.metadata?.excelHeaderRow as string[];
      const sheetName = doc.metadata?.sheetName as string;

      // 如果没有表头信息或内容太小，直接使用原文档
      if (!excelTableHeader || !excelHeaderRow || doc.pageContent.length <= 2000) {
        allChunks.push(doc);
        continue;
      }

      const content = doc.pageContent;
      const lines = content.split('\n');
      
      // 查找数据行的范围（跳过表头）
      const dataRowStartIndex = lines.findIndex((line: string) => line.startsWith('|') && !line.includes('---'));
      
      // 找到最后一个数据行
      let dataRowEndIndex = -1;
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (line.startsWith('|') && line.trim() !== excelTableHeader.trim()) {
          dataRowEndIndex = i;
          break;
        }
      }
      
      if (dataRowStartIndex === -1 || dataRowEndIndex === -1) {
        // 如果无法找到数据行，直接使用原文档
        allChunks.push(doc);
        continue;
      }

      // 提取各部分内容
      const headerSection = lines.slice(0, dataRowStartIndex + 1).join('\n'); // 包含sheet名称、表头
      const dataRows = lines.slice(dataRowStartIndex + 1, dataRowEndIndex + 1);
      const footerSection = lines.slice(dataRowEndIndex + 1).join('\n');

      // 计算每个chunk的最大行数
      const maxRowsPerChunk = Math.max(8, Math.floor((3000 - headerSection.length) / 120)); // Excel行可能更长
      
      if (dataRows.length <= maxRowsPerChunk) {
        // 数据不够多，不需要分割
        allChunks.push(doc);
        continue;
      }

      // 分割大的Excel sheet
      let chunkIndex = 0;
      for (let i = 0; i < dataRows.length; i += maxRowsPerChunk) {
        const chunkDataRows = dataRows.slice(i, i + maxRowsPerChunk);
        
        // 构建完整的chunk内容
        let chunkContent = headerSection + '\n';
        chunkContent += chunkDataRows.join('\n');
        
        const currentChunkRows = chunkDataRows.length;
        const totalDataRows = dataRows.length;
        const isLastChunk = (i + maxRowsPerChunk) >= dataRows.length;
        
        if (isLastChunk) {
          chunkContent += '\n' + footerSection;
        } else {
          chunkContent += `\n\n*Sheet "${sheetName}" - Chunk ${chunkIndex + 1} rows: ${currentChunkRows} (Total: ${totalDataRows})*\n`;
        }

        // 创建chunk文档
        const chunkDoc = new Document({
          pageContent: chunkContent,
          metadata: {
            ...doc.metadata,
            chunkIndex: allChunks.length, // 全局chunk索引
            totalChunks: 0, // 稍后计算
            rowsInChunk: currentChunkRows,
            startRowIndex: i,
            endRowIndex: Math.min(i + maxRowsPerChunk - 1, dataRows.length - 1),
            sheetChunkIndex: chunkIndex, // 当前sheet内的chunk索引
          },
        });

        allChunks.push(chunkDoc);
        chunkIndex++;
      }
    }

    // 更新所有chunks的totalChunks
    allChunks.forEach(chunk => {
      chunk.metadata.totalChunks = allChunks.length;
    });

    // 计算统计信息
    const totalChunks = allChunks.length;
    const averageChunkSize = totalChunks > 0 
      ? Math.round(allChunks.reduce((sum, chunk) => sum + chunk.pageContent.length, 0) / totalChunks)
      : 0;

    return {
      chunks: allChunks,
      metadata: {
        originalDocumentCount: documents.length,
        totalChunks,
        averageChunkSize,
      },
    };
  }

  // Special CSV splitting method that preserves headers in each chunk
  private static async splitCsvWithHeaders(documents: Document[]): Promise<SplitResult> {
    if (documents.length === 0) {
      return {
        chunks: [],
        metadata: {
          originalDocumentCount: 0,
          totalChunks: 0,
          averageChunkSize: 0,
        },
      };
    }

    const doc = documents[0];
    const csvTableHeader = doc.metadata?.csvTableHeader as string;
    const csvHeaderRow = doc.metadata?.csvHeaderRow as string[];

    // 如果没有表头信息，使用普通分割
    if (!csvTableHeader || !csvHeaderRow) {
      return await DocumentSplitter.splitDocuments(documents, {
        chunkSize: 4000,
        chunkOverlap: 400,
        separators: ['\n\n*Total data rows:', '\n\n*File:', '\n\n', '\n# ', '\n'],
      });
    }

    const content = doc.pageContent;
    
    // 分析内容结构，提取元信息和数据行
    const lines = content.split('\n');
    const dataRowStartIndex = lines.findIndex((line: string) => line.startsWith('|') && !line.includes('---'));
    
    // 兼容性实现 findLastIndex (ES2023特性)
    let dataRowEndIndex = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (line.startsWith('|') && line.trim() !== csvTableHeader.trim()) {
        dataRowEndIndex = i;
        break;
      }
    }
    
    if (dataRowStartIndex === -1 || dataRowEndIndex === -1) {
      // 如果无法找到数据行，使用普通分割
      return await DocumentSplitter.splitDocuments(documents, {
        chunkSize: 4000,
        chunkOverlap: 400,
        separators: ['\n\n*Total data rows:', '\n\n*File:', '\n\n', '\n# ', '\n'],
      });
    }

    // 提取各部分内容
    const headerSection = lines.slice(0, dataRowStartIndex + 1).join('\n'); // 包含标题、文件信息、表头
    const dataRows = lines.slice(dataRowStartIndex + 1, dataRowEndIndex + 1);
    const footerSection = lines.slice(dataRowEndIndex + 1).join('\n'); // 统计信息等

    // 计算每个chunk的最大行数 (考虑到表头和其他内容的开销)
    const maxRowsPerChunk = Math.max(5, Math.floor((4000 - headerSection.length - footerSection.length) / 100)); // 估算每行约100字符
    
    const chunks: Document[] = [];
    let chunkIndex = 0;

    // 将数据行分组
    for (let i = 0; i < dataRows.length; i += maxRowsPerChunk) {
      const chunkDataRows = dataRows.slice(i, i + maxRowsPerChunk);
      
      // 构建完整的chunk内容
      let chunkContent = headerSection + '\n';
      chunkContent += chunkDataRows.join('\n');
      
      // 添加chunk特定的统计信息
      const currentChunkRows = chunkDataRows.length;
      const totalDataRows = dataRows.length;
      const isLastChunk = (i + maxRowsPerChunk) >= dataRows.length;
      
      if (isLastChunk) {
        chunkContent += '\n' + footerSection;
      } else {
        chunkContent += `\n\n*Chunk ${chunkIndex + 1} data rows: ${currentChunkRows} (Total: ${totalDataRows})*\n`;
      }

      // 创建chunk文档
      const chunkDoc = new Document({
        pageContent: chunkContent,
        metadata: {
          ...doc.metadata,
          chunkIndex,
          totalChunks: Math.ceil(dataRows.length / maxRowsPerChunk),
          rowsInChunk: currentChunkRows,
          startRowIndex: i,
          endRowIndex: Math.min(i + maxRowsPerChunk - 1, dataRows.length - 1),
        },
      });

      chunks.push(chunkDoc);
      chunkIndex++;
    }

    // 计算统计信息
    const totalChunks = chunks.length;
    const averageChunkSize = totalChunks > 0 
      ? Math.round(chunks.reduce((sum, chunk) => sum + chunk.pageContent.length, 0) / totalChunks)
      : 0;

    return {
      chunks,
      metadata: {
        originalDocumentCount: documents.length,
        totalChunks,
        averageChunkSize,
      },
    };
  }

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
      
      // Check if this is a converted CSV/Excel file (Markdown table)
      const isConvertedCsv = loadResult.documents.some(doc => doc.metadata?.convertedFromCsv === true);
      const isConvertedExcel = loadResult.documents.some(doc => doc.metadata?.convertedFromExcel === true);
      const isConvertedHtml = loadResult.documents.some(doc => doc.metadata?.convertedFromHtml === true);
      
      if (isConvertedCsv) {
        // Special handling for converted CSV files - preserve table structure with headers
        splitResult = await this.splitCsvWithHeaders(loadResult.documents);
        console.log('[DocumentProcessor] CSV Table with Headers SplitResult:Chunks', splitResult.chunks.length);
      } else if (isConvertedExcel) {
        // Special handling for converted Excel files - preserve table structure with headers per sheet
        splitResult = await this.splitExcelWithHeaders(loadResult.documents);
        console.log('[DocumentProcessor] Excel Sheets with Headers SplitResult:Chunks', splitResult.chunks.length);
      } else if (isConvertedHtml) {
        // Special handling for converted HTML files
        splitResult = await DocumentSplitter.splitDocuments(loadResult.documents, {
          chunkSize: 2000,
          chunkOverlap: 300,
          separators: ['\n\n', '\n# ', '\n## ', '\n### ', '\n', ' '],
        });
        console.log('[DocumentProcessor] HTML SplitResult:Chunks', splitResult.chunks.length);
      } else if (options.useFileTypeOptimization) {
        const fileType = path.extname(filePath);
        splitResult = await DocumentSplitter.splitByFileType(loadResult.documents, fileType);
      } else {
        splitResult = await DocumentSplitter.splitDocuments(loadResult.documents, {
          chunkSize: options.chunkSize,
          chunkOverlap: options.chunkOverlap,
        });
      }
      console.log('[DocumentProcessor] FileType SplitResult:Chunks', splitResult.chunks.slice(0, 5));

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