import { Document } from '@langchain/core/documents';
import path from 'path';
import fs from 'fs/promises';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import TurndownService from 'turndown';

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
    // Office documents
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.ppt': 'application/vnd.ms-powerpoint',
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

  // Extract content from Word documents (.docx, .doc)
  static async extractWordContent(filePath: string): Promise<{ text: string; metadata: { paragraphs: number; } }> {
    try {
      const mammoth = require('mammoth');
      const buffer = await fs.readFile(filePath);
      
      const result = await mammoth.extractRawText(buffer);
      const paragraphs = result.value.split('\n\n').filter((p: string) => p.trim().length > 0);
      
      return {
        text: result.value,
        metadata: {
          paragraphs: paragraphs.length
        }
      };
    } catch (error) {
      console.error('Error extracting Word content:', error);
      throw new Error(`Failed to extract Word content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Extract content from Excel documents (.xlsx, .xls) as Markdown
  static async extractExcelContent(filePath: string): Promise<{ sheets: Array<{ name: string; content: string; rows: number; cols: number; }>; totalSheets: number; }> {
    try {
      const XLSX = require('xlsx');
      const workbook = XLSX.readFile(filePath);
      
      const sheets = workbook.SheetNames.map((sheetName: string) => {
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON first to get structured data
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        // Convert to Markdown table format
        let markdownContent = `# ${sheetName}\n\n`;
        
        if (jsonData.length > 0) {
          // Create markdown table
          const headers = jsonData[0] as any[];
          const rows = jsonData.slice(1) as any[][];
          
          if (headers && headers.length > 0) {
            // Table headers
            markdownContent += '| ' + headers.map(h => String(h || '')).join(' | ') + ' |\n';
            markdownContent += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
            
            // Table rows
            rows.forEach(row => {
              if (row && row.length > 0) {
                const paddedRow = headers.map((_, i) => String(row[i] || ''));
                markdownContent += '| ' + paddedRow.join(' | ') + ' |\n';
              }
            });
          }
        } else {
          markdownContent += '*Empty sheet*\n';
        }
        
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
        
        return {
          name: sheetName,
          content: markdownContent,
          rows: range.e.r + 1,
          cols: range.e.c + 1
        };
      });
      
      return {
        sheets,
        totalSheets: workbook.SheetNames.length
      };
    } catch (error) {
      console.error('Error extracting Excel content:', error);
      throw new Error(`Failed to extract Excel content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Extract and convert HTML content to Markdown using turndown
  static async extractHtmlContent(filePath: string): Promise<{ content: string; title?: string; }> {
    try {
      const htmlContent = await fs.readFile(filePath, 'utf-8');
      
      // Configure turndown service
      const turndownService = new TurndownService({
        headingStyle: 'atx',           // Use # style headings
        codeBlockStyle: 'fenced',      // Use ``` for code blocks
        bulletListMarker: '-',         // Use - for bullet lists
        strongDelimiter: '**',         // Use ** for bold
        emDelimiter: '*',              // Use * for italic
        linkStyle: 'inlined',          // Use [text](url) style links
        linkReferenceStyle: 'full',    // Full reference style
      });

      // Add custom rules for better conversion
      turndownService.addRule('strikethrough', {
        filter: ['del', 's'] as any, // TypeScript workaround for legacy HTML tags
        replacement: function (content: string) {
          return '~~' + content + '~~';
        }
      });

      turndownService.addRule('underline', {
        filter: ['u'],
        replacement: function (content: string) {
          return '<u>' + content + '</u>'; // Keep underline as HTML since MD doesn't support it
        }
      });

      // Remove script and style content
      turndownService.remove(['script', 'style', 'noscript']);

      // Convert HTML to Markdown
      const markdownContent = turndownService.turndown(htmlContent);
      
      // Extract title from HTML
      const titleMatch = htmlContent.match(/<title[^>]*>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : undefined;
      
      return {
        content: markdownContent,
        title
      };
    } catch (error) {
      console.error('Error extracting HTML content:', error);
      throw new Error(`Failed to extract HTML content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Extract content from PowerPoint documents (.pptx, .ppt)
  static async extractPowerPointContent(filePath: string): Promise<{ slides: Array<{ slideNumber: number; content: string; }>; totalSlides: number; }> {
    try {
      const ext = path.extname(filePath).toLowerCase();
      
      if (ext === '.pptx') {
        return await this.extractPptxContent(filePath);
      } else if (ext === '.ppt') {
        // .ppt files are binary format, more complex to parse
        const fileName = path.basename(filePath);
        console.warn(`Legacy .ppt format detected: ${fileName}. Consider converting to .pptx for better extraction.`);
        
        return {
          slides: [{
            slideNumber: 1,
            content: `# PowerPoint Document: ${fileName}\n\n*This is a legacy .ppt format file. For better text extraction, please save as .pptx format.*\n\nTo convert:\n1. Open the file in PowerPoint\n2. Save As → PowerPoint Presentation (.pptx)\n3. Re-upload the converted file`
          }],
          totalSlides: 1
        };
      } else {
        throw new Error(`Unsupported PowerPoint format: ${ext}`);
      }
    } catch (error) {
      console.error('Error extracting PowerPoint content:', error);
      throw new Error(`Failed to extract PowerPoint content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Extract content from .pptx files
  private static async extractPptxContent(filePath: string): Promise<{ slides: Array<{ slideNumber: number; content: string; }>; totalSlides: number; }> {
    const JSZip = require('jszip');
    const xml2js = require('xml2js');
    
    try {
      // Read the .pptx file as a buffer
      const buffer = await fs.readFile(filePath);
      const zip = await JSZip.loadAsync(buffer);
      
      // Get all slide files
      const slideFiles: Array<{ name: string; slideNumber: number; }> = [];
      zip.forEach((relativePath: string, file: any) => {
        if (relativePath.startsWith('ppt/slides/slide') && relativePath.endsWith('.xml')) {
          const slideNumber = parseInt(relativePath.match(/slide(\d+)\.xml$/)?.[1] || '0');
          if (slideNumber > 0) {
            slideFiles.push({ name: relativePath, slideNumber });
          }
        }
      });
      
      // Sort slides by number
      slideFiles.sort((a, b) => a.slideNumber - b.slideNumber);
      
      const slides: Array<{ slideNumber: number; content: string; }> = [];
      
      // Process each slide
      for (const slideFile of slideFiles) {
        const slideXml = await zip.file(slideFile.name)?.async('text');
        if (!slideXml) continue;
        
        // Parse XML and extract text content
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(slideXml);
        
        const slideContent = this.extractTextFromPptxSlide(result, slideFile.slideNumber);
        if (slideContent.trim()) {
          slides.push({
            slideNumber: slideFile.slideNumber,
            content: slideContent
          });
        }
      }
      
      return {
        slides,
        totalSlides: slides.length
      };
      
    } catch (error) {
      console.error('Error parsing .pptx file:', error);
      throw new Error(`Failed to parse .pptx file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Extract text content from a parsed PPTX slide XML
  private static extractTextFromPptxSlide(slideXml: any, slideNumber: number): string {
    let content = `# Slide ${slideNumber}\n\n`;
    
    try {
      // Navigate through the XML structure to find text elements
      const shapes = slideXml?.['p:sld']?.['p:cSld']?.[0]?.['p:spTree']?.[0]?.['p:sp'];
      
      if (shapes && Array.isArray(shapes)) {
        for (const shape of shapes) {
          const textBody = shape?.['p:txBody'];
          if (textBody && Array.isArray(textBody)) {
            for (const txBody of textBody) {
              const paragraphs = txBody?.['a:p'];
              if (paragraphs && Array.isArray(paragraphs)) {
                for (const paragraph of paragraphs) {
                  const textRuns = paragraph?.['a:r'];
                  if (textRuns && Array.isArray(textRuns)) {
                    for (const textRun of textRuns) {
                      const text = textRun?.['a:t']?.[0];
                      if (typeof text === 'string' && text.trim()) {
                        content += text.trim() + ' ';
                      }
                    }
                    content += '\n';
                  }
                  
                  // Also check for direct text content
                  const directText = paragraph?.['a:t'];
                  if (directText && Array.isArray(directText)) {
                    for (const text of directText) {
                      if (typeof text === 'string' && text.trim()) {
                        content += text.trim() + ' ';
                      }
                    }
                    content += '\n';
                  }
                }
              }
            }
          }
        }
      }
      
      // Clean up the content
      content = content
        .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove multiple empty lines
        .replace(/\s+/g, ' ') // Normalize spaces
        .replace(/\n /g, '\n') // Remove spaces after newlines
        .trim();
      
      // If no content was extracted, add a placeholder
      if (content === `# Slide ${slideNumber}` || content.length < 20) {
        content += '\n\n*No readable text content found in this slide*';
      }
      
      return content;
      
    } catch (error) {
      console.error(`Error extracting text from slide ${slideNumber}:`, error);
      return `# Slide ${slideNumber}\n\n*Error extracting text from this slide*`;
    }
  }

  static async loadDocument(filePath: string): Promise<DocumentLoadResult> {
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = this.getMimeType(filePath);
    
    if (!mimeType) {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    const stats = await fs.stat(filePath);
    const fileSize = stats.size;

    try {
      let documents: Document[] = [];

      // Process different types of files
      if (['.txt', '.md', '.js', '.ts', '.py', '.java', '.cpp', '.c', '.xml', '.yaml', '.yml', '.json', '.csv'].includes(ext)) {
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
      } else if (ext === '.html') {
        // HTML file - convert to Markdown using turndown
        const { content, title } = await this.extractHtmlContent(filePath);
        documents = [
          new Document({
            pageContent: content,
            metadata: {
              filePath,
              fileName,
              fileSize,
              mimeType,
              title,
              pageNumber: 1,
              totalPages: 1,
              chunkIndex: 0,
              totalChunks: 1,
              convertedFromHtml: true, 
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
      } else if (['.docx', '.doc'].includes(ext)) {
        // Word document
        const { text, metadata } = await this.extractWordContent(filePath);
        documents = [
          new Document({
            pageContent: text,
            metadata: {
              filePath,
              fileName,
              fileSize,
              mimeType,
              paragraphs: metadata.paragraphs,
              pageNumber: 1,
              totalPages: 1,
              chunkIndex: 0,
              totalChunks: 1,
            },
          })
        ];
      } else if (['.xlsx', '.xls'].includes(ext)) {
        // Excel document - convert to markdown format
        const { sheets, totalSheets } = await this.extractExcelContent(filePath);
        documents = sheets.map((sheet, index) => 
          new Document({
            pageContent: sheet.content,
            metadata: {
              filePath,
              fileName,
              fileSize,
              mimeType,
              sheetName: sheet.name,
              sheetNumber: index + 1,
              totalSheets: totalSheets,
              rows: sheet.rows,
              cols: sheet.cols,
              chunkIndex: index,
              totalChunks: sheets.length,
            },
          })
        );
      } else if (['.pptx', '.ppt'].includes(ext)) {
        // PowerPoint document
        const { slides, totalSlides } = await this.extractPowerPointContent(filePath);
        documents = slides.map((slide, index) => 
          new Document({
            pageContent: slide.content,
            metadata: {
              filePath,
              fileName,
              fileSize,
              mimeType,
              slideNumber: slide.slideNumber,
              totalSlides: totalSlides,
              chunkIndex: index,
              totalChunks: slides.length,
            },
          })
        );
      } else {
        throw new Error(`Unimplemented file type handler: ${ext}`);
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
        console.error(`Failed to load document: ${filePath}`, error);
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