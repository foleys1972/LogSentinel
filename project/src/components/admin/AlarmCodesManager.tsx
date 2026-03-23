import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  AlertTriangle,
  Upload,
  Download,
  BookOpen,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { ErrorCode } from '../../types';

const STORAGE_KEY = 'alarmCodes';

// CSV template columns
const CSV_TEMPLATE_HEADERS = ['code', 'criticality', 'description', 'resolution', 'category'];
const CRITICALITY_VALUES = ['low', 'medium', 'high', 'critical'] as const;

interface AlarmCodesManagerProps {
  onDataUpdate: () => void;
}

export function AlarmCodesManager({ onDataUpdate }: AlarmCodesManagerProps) {
  const [alarmCodes, setAlarmCodes] = useState<ErrorCode[]>([]);
  const [editingCode, setEditingCode] = useState<ErrorCode | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedLearnId, setExpandedLearnId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    resolution: '',
    category: '',
    severity: 'medium' as const,
    autoResolve: false
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setAlarmCodes(parsed.map((c: ErrorCode) => ({ ...c, severity: c.severity || 'medium' })));
      } catch {
        setAlarmCodes([]);
      }
    } else {
      setAlarmCodes([]);
    }
  }, []);

  const saveAlarmCodes = (codes: ErrorCode[]) => {
    setAlarmCodes(codes);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(codes));
    window.dispatchEvent(new CustomEvent('alarmcodes-updated'));
    onDataUpdate();
  };

  const handleCreate = () => {
    setIsCreating(true);
    setFormData({
      code: '',
      description: '',
      resolution: '',
      category: '',
      severity: 'medium',
      autoResolve: false
    });
  };

  const handleEdit = (code: ErrorCode) => {
    setEditingCode(code);
    setFormData({
      code: code.code,
      description: code.description,
      resolution: code.resolution,
      category: code.category,
      severity: code.severity,
      autoResolve: code.autoResolve
    });
  };

  const handleSave = () => {
    if (isCreating) {
      const newCode: ErrorCode = {
        id: `alarm_${Date.now()}`,
        ...formData
      };
      saveAlarmCodes([...alarmCodes, newCode]);
    } else if (editingCode) {
      const updated = alarmCodes.map((c) =>
        c.id === editingCode.id ? { ...c, ...formData } : c
      );
      saveAlarmCodes(updated);
    }
    setIsCreating(false);
    setEditingCode(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this alarm code?')) {
      saveAlarmCodes(alarmCodes.filter((c) => c.id !== id));
    }
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = (e.target?.result as string) || '';
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) {
          setImportError('CSV must have at least a header row and one data row');
          return;
        }
        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const codeIdx = headers.findIndex((h) => h === 'code' || h === 'alarmcode');
        const critIdx = headers.findIndex((h) => h === 'criticality' || h === 'severity');
        const descIdx = headers.findIndex((h) => h === 'description' || h === 'desc');
        const resIdx = headers.findIndex((h) => h === 'resolution' || h === 'resolve');
        const catIdx = headers.findIndex((h) => h === 'category' || h === 'cat');

        if (codeIdx < 0 || critIdx < 0) {
          setImportError('CSV must have "code" and "criticality" (or "severity") columns');
          return;
        }

        const parseCsvLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
              inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
              result.push(current.trim().replace(/^"|"$/g, ''));
              current = '';
            } else {
              current += ch;
            }
          }
          result.push(current.trim().replace(/^"|"$/g, ''));
          return result;
        };

        const imported: ErrorCode[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = parseCsvLine(lines[i]);
          const code = values[codeIdx]?.trim() || '';
          const critRaw = (values[critIdx]?.trim() || 'medium').toLowerCase();
          const severity = CRITICALITY_VALUES.includes(critRaw as typeof CRITICALITY_VALUES[number])
            ? (critRaw as typeof CRITICALITY_VALUES[number])
            : 'medium';
          if (!code) continue;
          imported.push({
            id: `alarm_${Date.now()}_${i}`,
            code,
            description: descIdx >= 0 ? values[descIdx]?.trim() || '' : '',
            resolution: resIdx >= 0 ? values[resIdx]?.trim() || '' : '',
            category: catIdx >= 0 ? values[catIdx]?.trim() || '' : '',
            severity,
            autoResolve: false
          });
        }
        saveAlarmCodes([...alarmCodes, ...imported]);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Failed to parse CSV');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleExportTemplate = () => {
    const template = [
      CSV_TEMPLATE_HEADERS.join(','),
      'AUTH_001,critical,Authentication failed,Check credentials and retry,Security',
      'DB_002,high,Database connection timeout,Restart service and check network,Database',
      'NET_003,medium,Network latency detected,Monitor and escalate if persistent,Network'
    ].join('\n');
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alarm_codes_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const headers = ['code', 'criticality', 'description', 'resolution', 'category'];
    const rows = alarmCodes.map((c) =>
      [c.code, c.severity, `"${c.description}"`, `"${c.resolution}"`, c.category].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alarm_codes.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getSeverityColor = (s: string) => {
    switch (s) {
      case 'critical': return 'bg-red-500/20 text-red-400';
      case 'high': return 'bg-orange-500/20 text-orange-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-blue-500/20 text-blue-400';
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h3 className="text-lg font-semibold text-white">Alarm Code Management</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleExportTemplate} className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm">
            <Download className="h-4 w-4" />
            Download Template
          </button>
          <label className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg cursor-pointer text-sm">
            <Upload className="h-4 w-4" />
            Import CSV
            <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
          </label>
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm">
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button onClick={handleCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
            <Plus className="h-4 w-4" />
            Add Alarm Code
          </button>
        </div>
      </div>

      {importError && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {importError}
        </div>
      )}

      <div className="mb-4 p-4 bg-slate-900 border border-slate-600 rounded-lg">
        <h4 className="text-white font-medium mb-2 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-cyan-400" />
          Teach & Learn About Alarm Codes
        </h4>
        <p className="text-slate-400 text-sm">
          Import alarm codes via CSV (code, criticality, description, resolution, category). Click any code below to expand and learn its details.
        </p>
      </div>

      {(isCreating || editingCode) && (
        <div className="bg-slate-900 border border-slate-600 rounded-lg p-6 mb-6">
          <h4 className="text-white font-medium mb-4">
            {isCreating ? 'Add Alarm Code' : 'Edit Alarm Code'}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-2">Alarm Code</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                placeholder="e.g., AUTH_001"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-2">Criticality</label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value as typeof formData.severity })}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-300 mb-2">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                placeholder="What this alarm means"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-300 mb-2">Resolution</label>
              <textarea
                value={formData.resolution}
                onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 h-24"
                placeholder="Steps to resolve"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-2">Category</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                placeholder="e.g., Security, Database"
              />
            </div>
          </div>
          <div className="flex gap-4 mt-6">
            <button onClick={handleSave} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg">
              <Save className="h-4 w-4 inline mr-2" />
              Save
            </button>
            <button
              onClick={() => { setIsCreating(false); setEditingCode(null); }}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {alarmCodes.length === 0 ? (
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Alarm Codes</h3>
          <p className="text-slate-400 mb-4">Import a CSV or add alarm codes manually. CSV format: code, criticality, description, resolution, category</p>
          <div className="flex gap-4 justify-center flex-wrap">
            <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
              Add First Code
            </button>
            <button onClick={handleExportTemplate} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg">
              Download Template
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {alarmCodes.map((code) => (
            <div key={code.id} className="bg-slate-900 border border-slate-600 rounded-lg overflow-hidden">
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/50"
                onClick={() => setExpandedLearnId(expandedLearnId === code.id ? null : code.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${getSeverityColor(code.severity)}`}>
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-white font-medium">{code.code}</span>
                      <span className={`px-2 py-0.5 rounded text-xs capitalize ${getSeverityColor(code.severity)}`}>
                        {code.severity}
                      </span>
                      {code.category && (
                        <span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs">
                          {code.category}
                        </span>
                      )}
                    </div>
                    {code.description && (
                      <p className="text-slate-400 text-sm mt-1 truncate max-w-md">{code.description}</p>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpandedLearnId(expandedLearnId === code.id ? null : code.id); }}
                    className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-sm"
                  >
                    <BookOpen className="h-4 w-4" />
                    {expandedLearnId === code.id ? 'Hide' : 'Learn'}
                  </button>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => handleEdit(code)} className="p-2 text-slate-400 hover:text-blue-400 rounded">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(code.id)} className="p-2 text-slate-400 hover:text-red-400 rounded">
                    <Trash2 className="h-4 w-4" />
                  </button>
                  {expandedLearnId === code.id ? (
                    <ChevronUp className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  )}
                </div>
              </div>
              {expandedLearnId === code.id && (
                <div className="border-t border-slate-600 p-4 bg-slate-800/50">
                  <h5 className="text-cyan-400 font-medium mb-2">Learn about {code.code}</h5>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-slate-500">Description:</span>
                      <p className="text-slate-300 mt-1">{code.description || '—'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Resolution:</span>
                      <p className="text-slate-300 mt-1 whitespace-pre-wrap">{code.resolution || '—'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Criticality:</span>
                      <span className={`ml-2 px-2 py-0.5 rounded capitalize ${getSeverityColor(code.severity)}`}>
                        {code.severity}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
