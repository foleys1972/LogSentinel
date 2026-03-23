/**
 * WebSocket log-to-file utility.
 * Writes WebSocket messages to a user-selected file.
 * Electron: uses IPC to write to any path. Browser: uses File System Access API.
 */

declare global {
  interface Window {
    require?: (module: string) => { ipcRenderer: { invoke: (channel: string, ...args: unknown[]) => Promise<unknown> } };
  }
}

export interface WsLogFileResult {
  success: boolean;
  filePath?: string;
  fileHandle?: FileSystemFileHandle;
  error?: string;
}

export type WsLogWriter = {
  type: 'electron';
  filePath: string;
} | {
  type: 'browser';
  fileHandle: FileSystemFileHandle;
};

export async function selectLogFile(): Promise<WsLogFileResult> {
  // Electron: use IPC (via preload or window.require)
  const electronApi = typeof window !== 'undefined' && (
    (window as unknown as { wsLogToFile?: { selectFile: () => Promise<{ success: boolean; filePath?: string }> } }).wsLogToFile ||
    (window.require && (() => {
      try {
        const { ipcRenderer } = window.require('electron');
        return { selectFile: () => ipcRenderer.invoke('select-ws-log-file') };
      } catch { return null; }
    })())
  );
  if (electronApi) {
    try {
      const result = await electronApi.selectFile() as { success: boolean; filePath?: string };
      if (result?.success && result.filePath) {
        return { success: true, filePath: result.filePath };
      }
      return { success: false };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  // Browser: File System Access API
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as unknown as { showSaveFilePicker: (opts?: object) => Promise<FileSystemFileHandle> })
        .showSaveFilePicker({
          suggestedName: 'websocket-logs.txt',
          types: [{ description: 'Log files', accept: { 'text/plain': ['.txt', '.log'] } }]
        });
      return { success: true, fileHandle: handle };
    } catch (e) {
      if ((e as Error).name === 'AbortError') return { success: false };
      return { success: false, error: String(e) };
    }
  }

  return { success: false, error: 'File selection requires Electron app' };
}

export async function appendToLogFile(writer: WsLogWriter, content: string): Promise<{ success: boolean; error?: string }> {
  if (writer.type === 'electron') {
    const electronApi = typeof window !== 'undefined' && (
      (window as unknown as { wsLogToFile?: { appendToFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }> } }).wsLogToFile ||
      (window.require && (() => {
        try {
          const { ipcRenderer } = window.require('electron');
          return { appendToFile: (p: string, c: string) => ipcRenderer.invoke('append-ws-log-file', p, c) };
        } catch { return null; }
      })())
    );
    if (electronApi) {
      try {
        const result = await electronApi.appendToFile(writer.filePath, content) as { success: boolean; error?: string };
        return result;
      } catch (e) {
        return { success: false, error: String(e) };
      }
    }
  }

  if (writer.type === 'browser') {
    try {
      const writable = await writer.fileHandle.createWritable({ keepExistingData: true });
      const file = await writer.fileHandle.getFile();
      await writable.seek(file.size);
      const timestamp = new Date().toISOString();
      await writable.write(`[${timestamp}] ${content}\n`);
      await writable.close();
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  return { success: false, error: 'File writing not available' };
}
