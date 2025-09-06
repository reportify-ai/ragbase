import { DocumentService, ProcessingOptions } from '../../lib/document/service';
import { DocumentDB } from '../../lib/document/db';

export interface TaskProcessorOptions {
  processingOptions?: ProcessingOptions;
  batchSize?: number;
  interval?: number; // Processing interval (milliseconds)
  maxConcurrent?: number;
}

export class DocumentTaskProcessor {
  private static isRunning = false;
  private static intervalId: NodeJS.Timeout | null = null;

  /**
   * Start background document processing task
   */
  static async start(options: TaskProcessorOptions = {}): Promise<void> {
    if (this.isRunning) {
      console.log('[tasks/processing] Task processor is already running');
      return;
    }

    const {
      processingOptions = {},
      batchSize = 5,
      interval = 5000, // 5 seconds
      maxConcurrent = 3,
    } = options;

    this.isRunning = true;
    console.log('[tasks/processing] Starting document processing task');

    const processBatch = async () => {
      try {
        // Get pending files
        const pendingFiles = await DocumentDB.getPendingFiles(batchSize);
        
        if (pendingFiles.length === 0) {
          console.log('[tasks/processing] No pending files');
          return;
        }

        console.log(`[tasks/processing] Starting to process ${pendingFiles.length} files`);

        // Process files in batches
        const fileIds = pendingFiles.map(f => f.id);
        const filePaths = pendingFiles.map(f => f.path);

        const results = await DocumentService.processFiles(
          fileIds,
          filePaths,
          {
            ...processingOptions,
            batchSize: Math.min(batchSize, maxConcurrent),
          }
        );

        // Summarize processing results
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        console.log(`[tasks/processing] Processing completed: Success ${successful.length}, Failed ${failed.length}`);

        if (failed.length > 0) {
          console.log('[tasks/processing] Failed files:', failed.map(f => f.fileName));
          // console.log('[tasks/processing] Failed files details:', results);
        }
      } catch (error) {
        console.error('[tasks/processing] Error processing batch:', error);
      }
    };

    // Execute immediately
    await processBatch();

    // Set interval task
    this.intervalId = setInterval(processBatch, interval);
  }

  /**
   * Stop background document processing task
   */
  static stop(): void {
    if (!this.isRunning) {
      console.log('[tasks/processing] Task processor is not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log('[tasks/processing] Stopped document processing task');
  }

  /**
   * Check if task processor is running
   */
  static isTaskRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Manually trigger processing once
   */
  static async processOnce(options: TaskProcessorOptions = {}): Promise<void> {
    const {
      processingOptions = {},
      batchSize = 5,
      maxConcurrent = 3,
    } = options;

    try {
      console.log('[tasks/processing] Manually triggering document processing');

      const pendingFiles = await DocumentDB.getPendingFiles(batchSize);
      
      if (pendingFiles.length === 0) {
        console.log('[tasks/processing] No pending files');
        return;
      }

      const fileIds = pendingFiles.map(f => f.id);
      const filePaths = pendingFiles.map(f => f.path);

      const results = await DocumentService.processFiles(
        fileIds,
        filePaths,
        {
          ...processingOptions,
          batchSize: Math.min(batchSize, maxConcurrent),
        }
      );

      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      console.log(`[tasks/processing] Manual processing completed: Success ${successful.length}, Failed ${failed.length}`);
    } catch (error) {
      console.error('[tasks/processing] Error during manual processing:', error);
    }
  }

  /**
   * Reprocess failed files
   */
  static async reprocessFailed(options: TaskProcessorOptions = {}): Promise<void> {
    const {
      processingOptions = {},
      batchSize = 5,
    } = options;

    try {
      console.log('[tasks/processing] Reprocessing failed files');

      const stats = await DocumentService.reprocessFailedFiles(batchSize, processingOptions);
      
      console.log(`[tasks/processing] Reprocessing completed:`, {
        totalFiles: stats.totalFiles,
        successful: stats.successfulFiles,
        failed: stats.failedFiles,
        successRate: `${stats.successRate.toFixed(1)}%`,
        totalChunks: stats.totalChunks,
      });
    } catch (error) {
      console.error('[tasks/processing] Error reprocessing failed files:', error);
    }
  }

  /**
   * Get processing statistics
   */
  static async getStats() {
    return await DocumentService.getStats();
  }
} 