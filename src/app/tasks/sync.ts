import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import path from 'path';
import { createFile, fileExists, fileNeedsSync, getFileRecord, updateFile } from '../api/kb/files/db';
import chokidar from 'chokidar';
import { files, syncDirectories, documentChunks } from '../../db/schema';
import { db } from '../../db';
import { eq, isNull } from 'drizzle-orm';
import { getAllSyncDirectories } from '../api/kb/sync-directories/db';
import crypto from 'crypto';
import { createSyncLog, getSyncLogsByDirectoryId, updateSyncLog } from '../api/kb/sync-logs/db';

interface ScanFilesTaskOptions {
  scanPath: string;
  syncDirectoryId: number;
  ignoreHidden?: boolean; // Whether to ignore hidden files
}

// Calculate file hash
async function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk: Buffer | string) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// Check if there is a file with the same hash globally
async function fileHashExists(hash: string): Promise<boolean> {
  const result = await db.select({ id: files.id }).from(files).where(eq(files.hash, hash)).limit(1);
  return result.length > 0;
}

// Check if it is a hidden file or temporary file
function isHiddenOrTempFile(filePath: string): boolean {
  const fileName = path.basename(filePath);
  
  // Check if it is a hidden file (starts with .)
  if (fileName.startsWith('.')) return true;
  
  // Check if it is a common temporary file
  const tempExtensions = [
    '.tmp', '.temp', '.swp', '.swo', '.swx', '.swpx',  // Editor temporary files
    '~', '.bak', '.old', '.orig',                      // Backup files
    '.DS_Store',                                       // macOS system files
    'Thumbs.db', 'desktop.ini',                        // Windows system files
    '.crdownload', '.part', '.partial', '.download'    // Download temporary files
  ];
  
  // Check file extension
  const ext = path.extname(fileName).toLowerCase();
  if (tempExtensions.includes(ext)) return true;
  
  // Check specific full file names
  const specificFiles = ['.DS_Store', 'Thumbs.db', 'desktop.ini'];
  if (specificFiles.includes(fileName)) return true;
  
  return false;
}

async function scanDirectory(dir: string, syncDirectoryId: number, existingPaths: Set<string>, ignoreHidden: boolean = true) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // Ignore hidden directories
    if (ignoreHidden && entry.isDirectory() && entry.name.startsWith('.')) {
      console.log(`[ScanFilesTask] Skipping hidden directory: ${fullPath}`);
      continue;
    }
    
    if (entry.isDirectory()) {
      await scanDirectory(fullPath, syncDirectoryId, existingPaths, ignoreHidden);
    } else {
      // Ignore hidden files or temporary files
      if (ignoreHidden && isHiddenOrTempFile(fullPath)) {
        console.log(`[ScanFilesTask] Skipping hidden/temp file: ${fullPath}`);
        continue;
      }
      
      if (existingPaths.has(fullPath)) continue;
      
      const stat = await fs.stat(fullPath);
      const fileSystemMtime = stat.mtime.toISOString();
      
      // Check if file needs sync based on modification time
      if (!await fileNeedsSync(fullPath, syncDirectoryId, fileSystemMtime)) {
        console.log(`[ScanFilesTask] File up to date: ${fullPath}`);
        continue;
      }
      
      const hash = await hashFile(fullPath);
      const existingFile = await getFileRecord(fullPath, syncDirectoryId);
      
      // Get the knowledge base ID corresponding to the sync directory
      const syncDir = await db.select({ kbId: syncDirectories.kbId })
        .from(syncDirectories)
        .where(eq(syncDirectories.id, syncDirectoryId))
        .limit(1);
      
      const kbId = syncDir[0]?.kbId || 1; // Default to use knowledge base with ID 1
      
      if (existingFile) {
        // File exists but needs update
        console.log(`[ScanFilesTask] Updating file: ${fullPath}, size: ${stat.size}, hash: ${hash}, syncDirId: ${syncDirectoryId}`);
        await updateFile(existingFile.id, {
          size: stat.size,
          hash,
          file_mtime: fileSystemMtime,
          status: 0, // Reset to pending for reprocessing
          error_message: null,
          last_processed: null
        });
      } else {
        // Check global hash duplicate only for new files
        if (await fileHashExists(hash)) {
          console.log(`[ScanFilesTask] File already exists with same hash: ${fullPath}`);
          continue;
        }
        
        // New file
        console.log(`[ScanFilesTask] New file: ${fullPath}, size: ${stat.size}, hash: ${hash}, syncDirId: ${syncDirectoryId}`);
        await createFile({
          name: entry.name,
          path: fullPath,
          size: stat.size,
          hash,
          created_at: new Date().toISOString(),
          status: 0,
          sync_directory_id: syncDirectoryId,
          kb_id: kbId,
          file_mtime: fileSystemMtime,
        });
      }
      
      existingPaths.add(fullPath);
    }
  }
}

export function createScanFilesTask(options: ScanFilesTaskOptions) {
  return async () => {
    // Query existing file paths from the database to avoid duplicates
    const existingFiles = await db.select({ path: files.path })
      .from(files)
      .where(eq(files.sync_directory_id, options.syncDirectoryId));
    console.log('existingFiles', existingFiles);
    
    const existingPaths = new Set<string>(existingFiles.map(file => file.path));
    console.log(`[ScanFilesTask] Found ${existingPaths.size} existing file records`);
    await scanDirectory(options.scanPath, options.syncDirectoryId, existingPaths, options.ignoreHidden !== false);
  };
}

export function createRealtimeScanTask(scanPath: string, syncDirectoryId: number, kbId: number, ignoreHidden: boolean = true) {
  return async () => {
    // Set chokidar options, ignore hidden files and directories
    const watchOptions = {
      ignoreInitial: true,
      persistent: true,
      depth: Infinity,
      ignored: ignoreHidden ? /(^|\/)\.[^\/\.]/g : undefined // Ignore files and directories starting with dot
    };
    const watcher = chokidar.watch(scanPath, watchOptions);
    console.log('[RealtimeScanTask] Watcher created', scanPath);
    watcher.on('add', async (filePath) => {
      try {
        // Ignore hidden files or temporary files
        if (ignoreHidden && isHiddenOrTempFile(filePath)) {
          console.log(`[RealtimeScanTask] Skipping hidden/temp file: ${filePath}`);
          return;
        }
        
        const stat = await fs.stat(filePath);
        const fileSystemMtime = stat.mtime.toISOString();
        
        // Check if file needs sync based on modification time
        if (!await fileNeedsSync(filePath, syncDirectoryId, fileSystemMtime)) {
          console.log(`[RealtimeScanTask] File up to date: ${filePath}`);
          return;
        }
        
        const hash = await hashFile(filePath);
        const existingFile = await getFileRecord(filePath, syncDirectoryId);
        
        // First create sync log record
        const startTime = new Date().toISOString();
        const syncLog = await createSyncLog({
          syncDirectoryId,
          kbId,
          startTime,
          status: 'running',
          totalFiles: 0,
          syncedFiles: 0,
          failedFiles: 0,
        });
        
        if (existingFile) {
          // File exists but needs update
          console.log(`[RealtimeScanTask] Updating file: ${filePath}, size: ${stat.size}, hash: ${hash}, syncDirId: ${syncDirectoryId}`);
          await updateFile(existingFile.id, {
            size: stat.size,
            hash,
            file_mtime: fileSystemMtime,
            status: 0, // Reset to pending for reprocessing
            error_message: null,
            last_processed: null
          });
        } else {
          // Check global hash duplicate only for new files
          if (await fileHashExists(hash)) {
            console.log(`[RealtimeScanTask] File already exists with same hash: ${filePath}`);
            await updateSyncLog(syncLog.id, {
              endTime: new Date().toISOString(),
              status: 'success',
              message: 'File skipped (duplicate hash)',
            });
            return;
          }
          
          // New file
          console.log(`[RealtimeScanTask] New file: ${filePath}, size: ${stat.size}, hash: ${hash}, syncDirId: ${syncDirectoryId}`);
          await createFile({
            name: path.basename(filePath),
            path: filePath,
            size: stat.size,
            hash,
            created_at: new Date().toISOString(),
            status: 0,
            sync_directory_id: syncDirectoryId,
            kb_id: kbId,
            file_mtime: fileSystemMtime,
          });
        }
        
        await updateSyncLog(syncLog.id, {
          syncedFiles: (syncLog.syncedFiles || 0) + 1,
          totalFiles: (syncLog.totalFiles || 0) + 1,
          endTime: new Date().toISOString(),
          status: 'success',
          message: 'Sync completed',
        });
      } catch (err) {
        console.error('[RealtimeScanTask] Error:', err);
        // Extendable: log error here
      }
    });
    
    // Listen to file change events
    watcher.on('change', async (filePath) => {
      try {
        // Ignore hidden files or temporary files
        if (ignoreHidden && isHiddenOrTempFile(filePath)) {
          console.log(`[RealtimeScanTask] Skipping hidden/temp file change: ${filePath}`);
          return;
        }
        
        const stat = await fs.stat(filePath);
        const fileSystemMtime = stat.mtime.toISOString();
        
        // Check if file needs sync based on modification time
        if (!await fileNeedsSync(filePath, syncDirectoryId, fileSystemMtime)) {
          console.log(`[RealtimeScanTask] File change ignored (up to date): ${filePath}`);
          return;
        }
        
        const hash = await hashFile(filePath);
        const existingFile = await getFileRecord(filePath, syncDirectoryId);
        
        if (!existingFile) {
          console.log(`[RealtimeScanTask] File changed but not in database: ${filePath}`);
          return;
        }
        
        console.log(`[RealtimeScanTask] File changed: ${filePath}, size: ${stat.size}, hash: ${hash}, syncDirId: ${syncDirectoryId}`);
        
        // First create sync log record
        const startTime = new Date().toISOString();
        const syncLog = await createSyncLog({
          syncDirectoryId,
          kbId,
          startTime,
          status: 'running',
          totalFiles: 0,
          syncedFiles: 0,
          failedFiles: 0,
        });
        
        // Update file record
        await updateFile(existingFile.id, {
          size: stat.size,
          hash,
          file_mtime: fileSystemMtime,
          status: 0, // Reset to pending for reprocessing
          error_message: null,
          last_processed: null
        });
        
        await updateSyncLog(syncLog.id, {
          syncedFiles: (syncLog.syncedFiles || 0) + 1,
          totalFiles: (syncLog.totalFiles || 0) + 1,
          endTime: new Date().toISOString(),
          status: 'success',
          message: 'File change synced',
        });
      } catch (err) {
        console.error('[RealtimeScanTask] Error handling file change:', err);
      }
    });
    
    // Listen to file deletion events
    watcher.on('unlink', async (filePath) => {
      try {
        console.log(`[RealtimeScanTask] File deleted: ${filePath}`);
        
        const existingFile = await getFileRecord(filePath, syncDirectoryId);
        if (!existingFile) {
          console.log(`[RealtimeScanTask] Deleted file not found in database: ${filePath}`);
          return;
        }
        
        // First create sync log record
        const startTime = new Date().toISOString();
        const syncLog = await createSyncLog({
          syncDirectoryId,
          kbId,
          startTime,
          status: 'running',
          totalFiles: 0,
          syncedFiles: 0,
          failedFiles: 0,
        });
        
        // Delete file record and related data
        console.log(`[RealtimeScanTask] Removing file record for: ${filePath} (id: ${existingFile.id})`);
        
        // Delete document chunks first (foreign key constraint)
        await db.delete(documentChunks).where(eq(documentChunks.file_id, existingFile.id));
        
        // Delete embeddings related to chunks
        // Note: We should also delete embeddings, but it requires joining tables
        // For now, we'll handle this separately if needed
        
        // Delete the file record
        await db.delete(files).where(eq(files.id, existingFile.id));
        
        await updateSyncLog(syncLog.id, {
          syncedFiles: (syncLog.syncedFiles || 0) + 1,
          totalFiles: (syncLog.totalFiles || 0) + 1,
          endTime: new Date().toISOString(),
          status: 'success',
          message: 'File deletion synced',
        });
        
        console.log(`[RealtimeScanTask] Successfully cleaned up deleted file: ${filePath}`);
      } catch (err) {
        console.error('[RealtimeScanTask] Error handling file deletion:', err);
      }
    });
    
    // Keep watcher running
    return Promise.resolve();
  };
}

// Update existing files with modification time
export async function updateExistingFilesWithMtime() {
  try {
    console.log('[UpdateFilesMtime] Starting to update existing files with modification time...');
    
    // Get all files without file_mtime
    const filesWithoutMtime = await db.select().from(files).where(isNull(files.file_mtime));
    console.log(`[UpdateFilesMtime] Found ${filesWithoutMtime.length} files without modification time`);
    
    let updated = 0;
    let failed = 0;
    
    for (const file of filesWithoutMtime) {
      try {
        // Check if file still exists on filesystem
        const stat = await fs.stat(file.path);
        const fileSystemMtime = stat.mtime.toISOString();
        
        // Update the file record
        await updateFile(file.id, {
          file_mtime: fileSystemMtime,
        });
        
        updated++;
        console.log(`[UpdateFilesMtime] Updated: ${file.path} (${updated}/${filesWithoutMtime.length})`);
      } catch (err) {
        failed++;
        console.warn(`[UpdateFilesMtime] Failed to update ${file.path}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        
        // If file doesn't exist on filesystem, we could mark it for cleanup
        // For now, just log the issue
        if ((err as any).code === 'ENOENT') {
          console.log(`[UpdateFilesMtime] File not found on filesystem: ${file.path}`);
        }
      }
    }
    
    console.log(`[UpdateFilesMtime] Completed: ${updated} updated, ${failed} failed`);
  } catch (err) {
    console.error('[UpdateFilesMtime] Failed to update existing files:', err);
  }
}

export async function startAllRealtimeSyncTasks() {
  try {
    // First, update existing files with modification time
    await updateExistingFilesWithMtime();
    
    const syncDirs = await getAllSyncDirectories();
    for (const dir of syncDirs) {
      if (dir.syncType === 'realtime') {
        scanDirectory(dir.dirPath, dir.id, new Set<string>(), dir.ignoreHidden !== false);
        createRealtimeScanTask(dir.dirPath, dir.id, dir.kbId, dir.ignoreHidden !== false)();
        console.log(`[tasks/syncing] Started realtime syncing for: ${dir.dirPath} (id=${dir.id})`);
      }
    }
  } catch (err) {
    console.error('[tasks/syncing] Failed to start realtime syncing tasks:', err);
  }
} 