import { startAllRealtimeSyncTasks } from './tasks/sync';
import { DocumentTaskProcessor } from './tasks/process';
import path from 'path';

// Set up proper paths for the background process
const isDev = process.env.NODE_ENV !== 'production';
const basePath = isDev ? path.join(__dirname, '../../..') : path.join(process.resourcesPath, 'app');
process.chdir(basePath);

console.log('[tasks] Starting background tasks...');
console.log('[tasks] Current working directory:', process.cwd());

try {
  // Start file scan tasks
  startAllRealtimeSyncTasks();
  console.log('[tasks] Background realtime files syncing task started...');

  // Start document processing tasks
  DocumentTaskProcessor.start({
    processingOptions: {
      chunkSize: 1000,
      chunkOverlap: 200,
      useFileTypeOptimization: true,
    },
    batchSize: 5,
    interval: 10000, // Check every 10 seconds
    maxConcurrent: 3,
  });
  console.log('[tasks] Background document processing task started...');

  // Keep the process alive (prevents Node from exiting)
  setInterval(() => {
    console.log('[tasks] Background tasks still running...');
  }, 60000); // Log every minute to show it's still alive
} catch (error) {
  console.error('[tasks] Error starting background tasks:', error);
}