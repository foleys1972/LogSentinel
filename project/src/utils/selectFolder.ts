/**
 * Folder selection utility.
 * Electron: uses IPC to open native folder picker.
 * Browser: falls back to text input (user types path).
 */

export interface SelectFolderResult {
  success: boolean;
  folderPath?: string;
  canceled?: boolean;
  error?: string;
}

export async function selectFolder(): Promise<SelectFolderResult> {
  if (typeof window === 'undefined') return { success: false, error: 'Not in browser' };

  // Preload (contextBridge): window.selectFolder is a function
  const preloadFn = (window as unknown as { selectFolder?: () => Promise<SelectFolderResult> }).selectFolder;
  if (typeof preloadFn === 'function') {
    try {
      return await preloadFn();
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  // Node integration: window.require('electron')
  const req = (window as unknown as { require?: (m: string) => unknown }).require;
  if (typeof req === 'function') {
    try {
      const { ipcRenderer } = req('electron') as { ipcRenderer: { invoke: (ch: string) => Promise<SelectFolderResult> } };
      const result = await ipcRenderer.invoke('select-folder');
      return result ?? { success: false };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  return { success: false, error: 'Folder selection requires Electron app. Enter path manually.' };
}
