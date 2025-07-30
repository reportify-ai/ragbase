import { Document } from '@langchain/core/documents';
import path from 'path';
import fs from 'fs/promises';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export interface DocumentLoadResult {
  documents: Document[];
  metadata: {
    filePath: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    pageCount?: number;
    error?: string;
  };
}

export class DocumentLoader {
  private static readonly SUPPORTED_EXTENSIONS = {
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.js': 'application/javascript',
    '.ts': 'application/typescript',
    '.py': 'text/x-python',
    '.java': 'text/x-java-source',
    '.cpp': 'text/x-c++src',
    '.c': 'text/x-csrc',
    '.html': 'text/html',
    '.xml': 'application/xml',
    '.yaml': 'text/yaml',
    '.yml': 'text/yaml',
    '.json': 'application/json',
    '.csv': 'text/csv',
    '.pdf': 'application/pdf',
  };

  static isSupportedFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext in this.SUPPORTED_EXTENSIONS;
  }

  static getMimeType(filePath: string): string | null {
    const ext = path.extname(filePath).toLowerCase();
    return this.SUPPORTED_EXTENSIONS[ext as keyof typeof this.SUPPORTED_EXTENSIONS] || null;
  }

  // Extract content from each page of PDF
  static async extractPdfPages(pdfBuffer: Buffer): Promise<{ pages: string[], totalPages: number }> {
    // First get basic information of PDF
    const pdfData = await pdfParse(pdfBuffer);
    const totalPages = pdfData.numpages;
    
    // If only one page, return directly
    if (totalPages <= 1) {
      return {
        pages: [pdfData.text],
        totalPages: 1
      };
    }
    
    // Use custom rendering function to extract content from each page
    const pageTexts: string[] = [];
    
    try {
      // Method 1: Use pdf-parse page rendering functionality
      // Create a custom rendering function to collect text from each page
      let currentPageText = '';
      let currentPage = 0;
      
      // Re-parse PDF using custom rendering function
      await pdfParse(pdfBuffer, {
        pagerender: function(pageData: any) {
          currentPage++;
          return pageData.getTextContent()
            .then(function(textContent: any) {
              let lastY: number | null = null;
              let text = '';
              
              // Extract page text, preserve layout
              for (const item of textContent.items) {
                if (lastY !== null && lastY !== item.transform[5]) {
                  text += '\n';
                }
                text += item.str;
                lastY = item.transform[5];
              }
              
              // Store current page text
              pageTexts.push(text);
              return text;
            });
        }
      });
      
      // If page extraction is incomplete, use method 2
      if (pageTexts.length < totalPages) {
        throw new Error('Page extraction incomplete, trying fallback method');
      }
    } catch (error) {
      console.warn('Advanced page extraction method failed, trying fallback method:', error);
      
      // Method 2: Parse PDF page by page
      pageTexts.length = 0; // Clear array
      
      for (let i = 1; i <= totalPages; i++) {
        try {
          // Extract single page
          const pageData = await pdfParse(pdfBuffer, { 
            max: i // Only process up to page i
          });
          
          // If it's the first page, use text directly
          if (i === 1) {
            pageTexts.push(pageData.text);
          } else {
            // For subsequent pages, need to extract separately
            // Due to pdf-parse limitations, we need to extract complete text, then compare with previous page
            const previousData = await pdfParse(pdfBuffer, { max: i - 1 });
            
            // If current page text is longer than previous page, there's new content
            if (pageData.text.length > previousData.text.length) {
              // Extract new content
              pageTexts.push(pageData.text.substring(previousData.text.length));
            } else {
              // If cannot extract correctly, use fallback method 3
              throw new Error('Cannot extract page content from PDF');
            }
          }
        } catch (error) {
          console.warn(`Failed to extract PDF page ${i}, trying fallback method:`, error);
          
          // Method 3: If first two methods fail, use text length estimation
          if (pageTexts.length < i - 1) {
            // If previous pages also failed to extract, restart
            pageTexts.length = 0;
            
            // Use simple length estimation
            const avgPageLength = Math.ceil(pdfData.text.length / totalPages);
            
            for (let j = 0; j < totalPages; j++) {
              const start = j * avgPageLength;
              const end = Math.min(start + avgPageLength, pdfData.text.length);
              pageTexts.push(pdfData.text.substring(start, end).trim());
            }
            
            break; // Break the loop, use the estimated result
          }
        }
      }
    }
    
    // Ensure the number of extracted pages is correct
    if (pageTexts.length !== totalPages) {
      console.warn(`The number of extracted pages (${pageTexts.length}) does not match the number of PDF pages (${totalPages}), using estimation method`);
      
      // Use simple length estimation
      pageTexts.length = 0;
      const avgPageLength = Math.ceil(pdfData.text.length / totalPages);
      
      for (let i = 0; i < totalPages; i++) {
        const start = i * avgPageLength;
        const end = Math.min(start + avgPageLength, pdfData.text.length);
        pageTexts.push(pdfData.text.substring(start, end).trim());
      }
    }
    
    return {
      pages: pageTexts,
      totalPages
    };
  }

  static async loadDocument(filePath: string): Promise<DocumentLoadResult> {
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = this.getMimeType(filePath);
    
    if (!mimeType) {
      throw new Error(`不支持的文件类型: ${ext}`);
    }

    const stats = await fs.stat(filePath);
    const fileSize = stats.size;

    try {
      let documents: Document[] = [];

      // Process different types of files
      if (['.txt', '.md', '.js', '.ts', '.py', '.java', '.cpp', '.c', '.html', '.xml', '.yaml', '.yml', '.json', '.csv'].includes(ext)) {
        // Text file
        const content = await fs.readFile(filePath, 'utf-8');
        documents = [
          new Document({
            pageContent: content,
            metadata: {
              filePath,
              fileName,
              fileSize,
              mimeType,
              pageNumber: 1,
              totalPages: 1,
              chunkIndex: 0,
              totalChunks: 1,
            },
          })
        ];
      } else if (ext === '.pdf') {
        // PDF file
        const pdfBuffer = await fs.readFile(filePath);
        const { pages, totalPages } = await this.extractPdfPages(pdfBuffer);
        
        // Create document object for each page
        documents = pages.map((pageText, index) => 
          new Document({
            pageContent: pageText,
            metadata: {
              filePath,
              fileName,
              fileSize,
              mimeType,
              pageNumber: index + 1,
              totalPages: totalPages,
              chunkIndex: index,
              totalChunks: pages.length,
            },
          })
        );
      } else {
        throw new Error(`未实现的文件类型处理器: ${ext}`);
      }

      return {
        documents,
        metadata: {
          filePath,
          fileName,
          fileSize,
          mimeType,
          pageCount: documents[0].metadata.totalPages || documents.length,
        },
      };
    } catch (error) {
      return {
        documents: [],
        metadata: {
          filePath,
          fileName,
          fileSize,
          mimeType: mimeType || 'unknown',
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  static async loadDocuments(filePaths: string[]): Promise<DocumentLoadResult[]> {
    const results: DocumentLoadResult[] = [];
    
    for (const filePath of filePaths) {
      try {
        const result = await this.loadDocument(filePath);
        results.push(result);
      } catch (error) {
        console.error(`加载文档失败: ${filePath}`, error);
        results.push({
          documents: [],
          metadata: {
            filePath,
            fileName: path.basename(filePath),
            fileSize: 0,
            mimeType: 'unknown',
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    return results;
  }
} 