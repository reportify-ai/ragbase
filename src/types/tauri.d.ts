interface Window {
  __TAURI__: {
    invoke: (command: string, args?: any) => Promise<any>;
  };
}

// Tauri command return type definitions
interface OpenFileResult {
  success: boolean;
  error?: string;
}
