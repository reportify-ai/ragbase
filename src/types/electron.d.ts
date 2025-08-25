interface Window {
  electronAPI: {
    selectDirectories: () => Promise<string[]>;
    openFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    platform: string;
    // 窗口控制 API
    minimizeWindow: () => Promise<void>;
    maximizeWindow: () => Promise<void>;
    closeWindow: () => Promise<void>;
  };
} 