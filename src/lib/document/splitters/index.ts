import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export interface SplitOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  separators?: string[];
}

export interface SplitResult {
  chunks: Document[];
  metadata: {
    originalDocumentCount: number;
    totalChunks: number;
    averageChunkSize: number;
  };
}

export class DocumentSplitter {
  private static readonly DEFAULT_OPTIONS: Required<SplitOptions> = {
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ['\n\n', '\n', ' ', ''],
  };

  static async splitDocuments(
    documents: Document[],
    options: SplitOptions = {}
  ): Promise<SplitResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: opts.chunkSize,
      chunkOverlap: opts.chunkOverlap,
      separators: opts.separators,
    });

    const chunks = await splitter.splitDocuments(documents);
    
    // Calculate statistics
    const totalChunks = chunks.length;
    const averageChunkSize = totalChunks > 0 
      ? chunks.reduce((sum, chunk) => sum + chunk.pageContent.length, 0) / totalChunks 
      : 0;

    return {
      chunks,
      metadata: {
        originalDocumentCount: documents.length,
        totalChunks,
        averageChunkSize: Math.round(averageChunkSize),
      },
    };
  }

  static async splitText(
    text: string,
    options: SplitOptions = {}
  ): Promise<string[]> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: opts.chunkSize,
      chunkOverlap: opts.chunkOverlap,
      separators: opts.separators,
    });

    return await splitter.splitText(text);
  }

  // Optimized splitting strategies for different file types
  static async splitByFileType(
    documents: Document[],
    fileType: string
  ): Promise<SplitResult> {
    const ext = fileType.toLowerCase();
    
    // Special handling for PDF files
    if (ext === '.pdf') {
      // Check if already split by page
      if (documents.length > 1 && documents[0].metadata?.pageNumber) {
        // PDF already split by page, keep as is
        return {
          chunks: documents,
          metadata: {
            originalDocumentCount: documents.length,
            totalChunks: documents.length,
            averageChunkSize: Math.round(
              documents.reduce((sum, doc) => sum + doc.pageContent.length, 0) / documents.length
            ),
          },
        };
      }
      
      // If not split by page, use default PDF split strategy
      return this.splitDocuments(documents, {
        chunkSize: 1000,
        chunkOverlap: 200,
        separators: ['\n\n', '\n', '. ', ' ', ''],
      });
    }
    
    let options: SplitOptions = {};

    switch (ext) {
      case '.md':
        // Markdown file split by title
        options = {
          chunkSize: 1500,
          chunkOverlap: 300,
          separators: ['\n# ', '\n## ', '\n### ', '\n\n', '\n', ' '],
        };
        break;
      
      case '.py':
      case '.js':
      case '.ts':
      case '.java':
      case '.cpp':
      case '.c':
        // Code file split by function/class
        options = {
          chunkSize: 800,
          chunkOverlap: 150,
          separators: ['\n\n', '\ndef ', '\nclass ', '\nfunction ', '\n', ' '],
        };
        break;
      
      case '.json':
        // JSON file keep intact
        options = {
          chunkSize: 2000,
          chunkOverlap: 100,
          separators: ['\n', ' ', ''],
        };
        break;
      
      case '.csv':
        // CSV file split by line
        options = {
          chunkSize: 500,
          chunkOverlap: 50,
          separators: ['\n', ',', ' '],
        };
        break;
      
      default:
        // Default split strategy
        options = {
          chunkSize: 1000,
          chunkOverlap: 200,
          separators: ['\n\n', '\n', ' ', ''],
        };
    }

    return this.splitDocuments(documents, options);
  }
} 