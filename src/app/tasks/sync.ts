import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import path from 'path';
import { createFile, fileExists } from '../api/kb/files/db';
import chokidar from 'chokidar';
import { files, syncDirectories } from '../../db/schema';
import { db } from '../../db';
import { eq } from 'drizzle-orm';
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
      if (await fileExists(fullPath, syncDirectoryId)) continue;
      const stat = await fs.stat(fullPath);
      const hash = await hashFile(fullPath);
      if (await fileHashExists(hash)) continue; // Global hash duplicate check
      console.log(`[ScanFilesTask] New file: ${fullPath}, size: ${stat.size}, hash: ${hash}, syncDirId: ${syncDirectoryId}`);
      
      // Get the knowledge base ID corresponding to the sync directory
      const syncDir = await db.select({ kbId: syncDirectories.kbId })
        .from(syncDirectories)
        .where(eq(syncDirectories.id, syncDirectoryId))
        .limit(1);
      
      const kbId = syncDir[0]?.kbId || 1; // Default to use knowledge base with ID 1
      
      await createFile({
        name: entry.name,
        path: fullPath,
        size: stat.size,
        hash,
        created_at: new Date().toISOString(),
        status: 0,
        sync_directory_id: syncDirectoryId,
        kb_id: kbId,
      });
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
        
        if (await fileExists(filePath, syncDirectoryId)) {
          console.log(`[RealtimeScanTask] File already exists: ${filePath}`);
          return;
        }
        const stat = await fs.stat(filePath);
        const hash = await hashFile(filePath);
        if (await fileHashExists(hash)) {
          console.log(`[RealtimeScanTask] File already exists with same hash: ${filePath}`);
          return; // Global hash duplicate check
        }
        console.log(`[RealtimeScanTask] New file: ${filePath}, size: ${stat.size}, hash: ${hash}, syncDirId: ${syncDirectoryId}`);
        // Create sync log record first
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
        await createFile({
          name: path.basename(filePath),
          path: filePath,
          size: stat.size,
          hash,
          created_at: new Date().toISOString(),
          status: 0,
          sync_directory_id: syncDirectoryId,
          kb_id: kbId,
        });
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
    // Extendable: listen to 'unlink', 'change' etc. events
    // Keep watcher running
    return Promise.resolve();
  };
}

export async function startAllRealtimeSyncTasks() {
  try {
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