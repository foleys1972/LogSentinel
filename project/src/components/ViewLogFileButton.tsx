/**
 * View log file button - opens file in default app (Electron) or copies path (web)
 */

import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import toast from 'react-hot-toast';

interface ViewLogFileButtonProps {
  filePath?: string | null;
  fileName?: string;
  className?: string;
}

export function ViewLogFileButton({ filePath, fileName, className = '' }: ViewLogFileButtonProps) {
  const [loading, setLoading] = useState(false);

  if (!filePath || !filePath.trim()) return null;

  const handleClick = async () => {
    const isElectron = typeof (window as unknown as { require?: (m: string) => unknown }).require === 'function';
    if (isElectron) {
      setLoading(true);
      try {
        const electron = (window as unknown as { require: (m: string) => { ipcRenderer: { invoke: (ch: string, ...a: unknown[]) => Promise<unknown> } } }).require('electron');
        const result = await electron.ipcRenderer.invoke('open-log-file', filePath) as { success?: boolean; error?: string };
        if (result?.success) {
          toast.success('Opened log file');
        } else {
          toast.error(result?.error || 'Could not open file');
        }
      } catch (e) {
        toast.error('Could not open file');
      } finally {
        setLoading(false);
      }
    } else {
      try {
        await navigator.clipboard.writeText(filePath);
        toast.success('Path copied to clipboard');
      } catch {
        toast.error('Could not copy path');
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors bg-slate-600 hover:bg-slate-500 text-white ${className}`}
      title={filePath}
    >
      <FileText className="h-3.5 w-3.5" />
      {loading ? 'Opening…' : 'View log file'}
    </button>
  );
}
