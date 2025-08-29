interface Window {
  electronAPI: {
    selectDirectories: () => Promise<string[]>;
    openFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    platform: string;
    // Window control APIs
    minimizeWindow: () => Promise<void>;
    maximizeWindow: () => Promise<void>;
    closeWindow: () => Promise<void>;
  };
} 