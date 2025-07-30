interface Window {
  electronAPI: {
    selectDirectories: () => Promise<string[]>;
    openFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  };
} 