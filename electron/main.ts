import { app, BrowserWindow, BrowserWindowConstructorOptions, ipcMain, dialog, shell } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import http from 'http';
import fs from 'fs';
import os from 'os';

let mainWindow: Electron.BrowserWindow | null = null;
let nextProcess: import('child_process').ChildProcess | undefined;
let tasksProcess: import('child_process').ChildProcess | undefined;
const NEXT_PORT = 3000;
const isDev = !app.isPackaged;

// Set data storage directory
const DATA_DIR = isDev
  ? path.join(__dirname, '../../data')
  : path.join(os.homedir(), '.ragbase');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`Created data directory: ${DATA_DIR}`);
  } catch (error) {
    console.error(`Failed to create data directory: ${DATA_DIR}`, error);
  }
}

// Set global environment variable
process.env.DATA_DIR = DATA_DIR;
console.log(`Data directory set to: ${DATA_DIR}`);

// Execute database migration
function runDatabaseMigration() {
  console.log('[electron/main] Running database migration');
  const migrationPath = isDev
    ? path.join(__dirname, '../../dist/db/migrate.js')
    : path.join(process.resourcesPath, 'app/dist/db/migrate.js');
  
  const cwd = isDev
    ? path.join(__dirname, '../../')
    : path.join(process.resourcesPath, 'app');
  
  const migrationProcess = spawn(process.execPath, [migrationPath], {
    cwd,
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      DATA_DIR: DATA_DIR,
    },
  });
  
  return new Promise<void>((resolve, reject) => {
    migrationProcess.on('close', (code) => {
      if (code === 0) {
        console.log('[electron/main] Database migration completed successfully');
        resolve();
      } else {
        console.error(`[electron/main] Database migration failed with code ${code}`);
        reject(new Error(`Migration failed with code ${code}`));
      }
    });
  });
}

ipcMain.handle('select-directories', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'multiSelections']
  });
  if (result.canceled) return [];
  return result.filePaths;
}); 

// 添加打开文件的处理函数
ipcMain.handle('open-file', async (_, filePath) => {
  try {
    console.log(`[electron/main] Opening file: ${filePath}`);
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }
    
    await shell.openPath(filePath);
    return { success: true };
  } catch (error) {
    console.error(`[electron/main] Failed to open file: ${filePath}`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to open file'
    };
  }
});

// 窗口控制 API
ipcMain.handle('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.restore();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('close-window', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

function startNext(): void {
  const nextPath = isDev
    ? path.join(__dirname, '../../node_modules/next/dist/bin/next')
    : path.join(process.resourcesPath, 'app/node_modules/next/dist/bin/next');
  const args = isDev ? ['dev', '--turbopack'] : ['start'];
  const cwd = isDev
    ? path.join(__dirname, '../../')
    : path.join(process.resourcesPath, 'app');
  nextProcess = spawn(process.execPath, [nextPath, ...args], {
    cwd,
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      DATA_DIR: DATA_DIR,
    },
  });
}

function waitForNextReady(port: number, callback: () => void): void {
  const tryConnect = (): void => {
    http.get(`http://localhost:${port}`, () => callback())
      .on('error', () => setTimeout(tryConnect, 500));
  };
  tryConnect();
}

function startTasks(): void {
  console.log('[electron/main] Starting tasks');
  const tasksPath = isDev
    ? path.join(__dirname, '../../dist/app/tasks.js')
    : path.join(process.resourcesPath, 'app/dist/app/tasks.js');
  console.log('[electron/main] tasksPath:', tasksPath);
  const cwd = isDev
    ? path.join(__dirname, '../../')
    : path.join(process.resourcesPath, 'app');
  console.log('[electron/main] cwd:', cwd);
  tasksProcess = spawn(process.execPath, [tasksPath], {
    cwd,
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      RUST_LOG: 'info;lancedb=info',
      DATA_DIR: DATA_DIR,
    },
  });
  console.log('[electron/main] Started tasks');
  console.log('[electron/main] Data directory:', DATA_DIR);
}

function createWindow(): void {
  if (mainWindow) return;
  const windowOptions: BrowserWindowConstructorOptions = {
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    // System bar control options
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'hidden',
    // macOS - precise control of button position
    ...(process.platform === 'darwin' && {
      trafficLightPosition: { x: 14, y: 20 }
    }),
    minimizable: true,
    maximizable: true,
    closable: true,
    resizable: true,
    // Windows/Linux 特定 - 使用自定义窗口控制
    ...(process.platform !== 'darwin' && {
      frame: false  // 完全移除窗口边框和标题栏，使用自定义控制
    }),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: isDev
        ? path.join(__dirname, '..', '..', 'electron', 'dist', 'preload.js')
        : path.join(process.resourcesPath, 'app', 'electron', 'dist', 'preload.js'),
    },
  };
  mainWindow = new BrowserWindow(windowOptions);
  const url = isDev
    ? 'http://localhost:3000'
    : `http://localhost:${NEXT_PORT}`;
  mainWindow.setMenu(null);
  mainWindow.loadURL(url);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', async () => {
  try {
    await runDatabaseMigration();

    startNext();
    startTasks();
    waitForNextReady(NEXT_PORT, createWindow);
  } catch (error) {
    console.error('[electron/main] Failed to initialize application:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (nextProcess) {
      nextProcess.kill();
    }
    if (tasksProcess) {
      tasksProcess.kill();
    }
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (nextProcess) {
    nextProcess.kill();
  }
  if (tasksProcess) {
    tasksProcess.kill();
  }
});