/**
 * System configuration: Verint and BT error code imports.
 * Each import is a separate set of error codes used when sites monitor Verint or BT logs.
 * Folder monitoring (paths) is configured per-site in the Sites tab.
 */

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Upload,
  Download,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { ErrorCode } from '../../types';

const VERINT_STORAGE_KEY = 'alarmCodesVerint';
const BT_STORAGE_KEY = 'alarmCodesBT';

const CSV_TEMPLATE_HEADERS = ['code', 'criticality', 'description', 'resolution', 'category'];
const CRITICALITY_VALUES = ['low', 'medium', 'high', 'critical'] as const;

interface ErrorCodeImportsConfigProps {
  onDataUpdate?: () => void;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else current += ch;
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

function parseCsvToErrorCodes(text: string): ErrorCode[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const codeIdx = headers.findIndex((h) => h === 'code' || h === 'alarmcode');
  const critIdx = headers.findIndex((h) => h === 'criticality' || h === 'severity');
  const descIdx = headers.findIndex((h) => h === 'description' || h === 'desc');
  const resIdx = headers.findIndex((h) => h === 'resolution' || h === 'resolve');
  const catIdx = headers.findIndex((h) => h === 'category' || h === 'cat');
  if (codeIdx < 0 || critIdx < 0) return [];
  const imported: ErrorCode[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const code = values[codeIdx]?.trim() || '';
    const critRaw = (values[critIdx]?.trim() || 'medium').toLowerCase();
    const severity = CRITICALITY_VALUES.includes(critRaw as (typeof CRITICALITY_VALUES)[number])
      ? (critRaw as (typeof CRITICALITY_VALUES)[number])
      : 'medium';
    if (!code) continue;
    imported.push({
      id: `ec_${Date.now()}_${i}`,
      code,
      description: descIdx >= 0 ? values[descIdx]?.trim() || '' : '',
      resolution: resIdx >= 0 ? values[resIdx]?.trim() || '' : '',
      category: catIdx >= 0 ? values[catIdx]?.trim() || '' : '',
      severity,
      autoResolve: false
    });
  }
  return imported;
}

function getSeverityColor(s: string) {
  switch (s) {
    case 'critical': return 'bg-red-500/20 text-red-400';
    case 'high': return 'bg-orange-500/20 text-orange-400';
    case 'medium': return 'bg-yellow-500/20 text-yellow-400';
    default: return 'bg-blue-500/20 text-blue-400';
  }
}

interface ErrorCodeSectionProps {
  type: 'verint' | 'bt';
  storageKey: string;
  label: string;
  description: string;
  onDataUpdate?: () => void;
}

function ErrorCodeSection({ type, storageKey, label, description, onDataUpdate }: ErrorCodeSectionProps) {
  const [codes, setCodes] = useState<ErrorCode[]>([]);
  const [editingCode, setEditingCode] = useState<ErrorCode | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    resolution: '',
    category: '',
    severity: 'medium' as const
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      setCodes(saved ? JSON.parse(saved).map((c: ErrorCode) => ({ ...c, severity: c.severity || 'medium' })) : []);
    } catch {
      setCodes([]);
    }
  }, [storageKey]);

  const save = (newCodes: ErrorCode[]) => {
    setCodes(newCodes);
    localStorage.setItem(storageKey, JSON.stringify(newCodes));
    window.dispatchEvent(new CustomEvent('errorcode-imports-updated'));
    onDataUpdate?.();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = (ev.target?.result as string) || '';
        const imported = parseCsvToErrorCodes(text);
        if (imported.length === 0) {
          setImportError('CSV must have code and criticality columns with at least one data row');
          return;
        }
        save([...codes, ...imported]);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Failed to parse CSV');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportTemplate = () => {
    const template = [
      CSV_TEMPLATE_HEADERS.join(','),
      'VRNT_001,critical,Verint auth failed,Check credentials,Auth',
      'BT_002,high,BT connection timeout,Restart service,Network'
    ].join('\n');
    const blob = new Blob([template], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${type}_error_codes_template.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleExport = () => {
    const headers = ['code', 'criticality', 'description', 'resolution', 'category'];
    const rows = codes.map((c) =>
      [c.code, c.severity, `"${c.description}"`, `"${c.resolution}"`, c.category].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${type}_error_codes.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleSave = () => {
    if (isCreating) {
      save([...codes, { id: `ec_${Date.now()}`, ...formData, autoResolve: false }]);
      setIsCreating(false);
    } else if (editingCode) {
      save(codes.map((c) => (c.id === editingCode.id ? { ...c, ...formData } : c)));
      setEditingCode(null);
    }
    setFormData({ code: '', description: '', resolution: '', category: '', severity: 'medium' });
  };

  const handleEdit = (code: ErrorCode) => {
    setEditingCode(code);
    setIsCreating(false);
    setFormData({
      code: code.code,
      description: code.description,
      resolution: code.resolution,
      category: code.category,
      severity: code.severity
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this error code?')) save(codes.filter((c) => c.id !== id));
  };

  return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg p-4">
      <h4 className="text-white font-medium mb-2 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-cyan-400" />
        {label}
      </h4>
      <p className="text-slate-400 text-sm mb-4">{description}</p>

      {importError && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
          {importError}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={handleExportTemplate} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm flex items-center gap-1">
          <Download className="h-4 w-4" />
          Template
        </button>
        <label className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm cursor-pointer flex items-center gap-1">
          <Upload className="h-4 w-4" />
          Import CSV
          <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
        </label>
        <button onClick={handleExport} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm flex items-center gap-1">
          <Download className="h-4 w-4" />
          Export
        </button>
        <button onClick={() => { setIsCreating(true); setEditingCode(null); setFormData({ code: '', description: '', resolution: '', category: '', severity: 'medium' }); }} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm flex items-center gap-1">
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      {(isCreating || editingCode) && (
        <div className="mb-4 p-4 bg-slate-800 rounded-lg border border-slate-600">
          <h5 className="text-slate-300 font-medium mb-3">{isCreating ? 'Add' : 'Edit'} Error Code</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Code</label>
              <input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded px-2 py-1.5 text-sm"
                placeholder="e.g. VRNT_001"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Criticality</label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value as typeof formData.severity })}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded px-2 py-1.5 text-sm"
              >
                {CRITICALITY_VALUES.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Description</label>
              <input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Resolution</label>
              <textarea
                value={formData.resolution}
                onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded px-2 py-1.5 text-sm h-16"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Category</label>
              <input
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleSave} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm">
              Save
            </button>
            <button onClick={() => { setIsCreating(false); setEditingCode(null); }} className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {codes.length === 0 ? (
        <div className="p-4 bg-slate-800 rounded border border-slate-600 text-slate-400 text-sm">
          No error codes. Import a CSV or add manually. Sites with {label} folder monitoring will use these codes.
        </div>
      ) : (
        <div className="max-h-[200px] overflow-y-auto space-y-1">
          {codes.map((code) => (
            <div key={code.id} className="bg-slate-800 rounded border border-slate-600 overflow-hidden">
              <div
                className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-700/50"
                onClick={() => setExpandedId(expandedId === code.id ? null : code.id)}
              >
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs capitalize ${getSeverityColor(code.severity)}`}>
                    {code.severity}
                  </span>
                  <span className="font-mono text-cyan-300">{code.code}</span>
                  {code.description && <span className="text-slate-500 truncate max-w-[200px]">{code.description}</span>}
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => handleEdit(code)} className="p-1 text-slate-400 hover:text-blue-400 rounded">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(code.id)} className="p-1 text-slate-400 hover:text-red-400 rounded">
                    <Trash2 className="h-4 w-4" />
                  </button>
                  {expandedId === code.id ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </div>
              </div>
              {expandedId === code.id && (
                <div className="border-t border-slate-600 p-3 bg-slate-800/80 text-sm">
                  <div><span className="text-slate-500">Description:</span> <span className="text-slate-300">{code.description || '—'}</span></div>
                  <div className="mt-1"><span className="text-slate-500">Resolution:</span> <span className="text-slate-300">{code.resolution || '—'}</span></div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ErrorCodeImportsConfig({ onDataUpdate }: ErrorCodeImportsConfigProps) {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white">Error Code Imports</h3>
        <p className="text-slate-400 text-sm mt-1">
          Configure Verint and BT error codes at system level. Sites that enable folder monitoring for Verint or BT will use the corresponding codes for criticality and resolution. Folder paths are configured per-site in the Sites tab.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ErrorCodeSection
          type="verint"
          storageKey={VERINT_STORAGE_KEY}
          label="Verint Error Codes"
          description="Error codes for Verint log monitoring. Import CSV (code, criticality, description, resolution, category)."
          onDataUpdate={onDataUpdate}
        />
        <ErrorCodeSection
          type="bt"
          storageKey={BT_STORAGE_KEY}
          label="BT Error Codes"
          description="Error codes for BT log monitoring. Import CSV (code, criticality, description, resolution, category)."
          onDataUpdate={onDataUpdate}
        />
      </div>
    </div>
  );
}
