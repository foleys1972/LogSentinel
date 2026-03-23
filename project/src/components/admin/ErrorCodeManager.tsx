import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, AlertTriangle, Upload, Download } from 'lucide-react';
import { ErrorCode } from '../../types';

interface ErrorCodeManagerProps {
  onDataUpdate: () => void;
}

export function ErrorCodeManager({ onDataUpdate }: ErrorCodeManagerProps) {
  const [errorCodes, setErrorCodes] = useState<ErrorCode[]>([]);
  const [editingCode, setEditingCode] = useState<ErrorCode | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    resolution: '',
    category: '',
    severity: 'medium' as const,
    autoResolve: false
  });

  useEffect(() => {
    // Load existing error codes from localStorage
    const savedCodes = localStorage.getItem('errorCodes');
    if (savedCodes) {
      try {
        setErrorCodes(JSON.parse(savedCodes));
      } catch (error) {
        console.error('Error parsing saved error codes:', error);
        setErrorCodes([]);
      }
    } else {
      // Start with empty array - no default error codes
      setErrorCodes([]);
    }
  }, []);

  const saveErrorCodes = (codes: ErrorCode[]) => {
    setErrorCodes(codes);
    localStorage.setItem('errorCodes', JSON.stringify(codes));
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

  const handleEdit = (errorCode: ErrorCode) => {
    setEditingCode(errorCode);
    setFormData({
      code: errorCode.code,
      description: errorCode.description,
      resolution: errorCode.resolution,
      category: errorCode.category,
      severity: errorCode.severity,
      autoResolve: errorCode.autoResolve
    });
  };

  const handleSave = () => {
    if (isCreating) {
      const newCode: ErrorCode = {
        id: Date.now().toString(),
        ...formData
      };
      saveErrorCodes([...errorCodes, newCode]);
    } else if (editingCode) {
      const updatedCodes = errorCodes.map(code =>
        code.id === editingCode.id ? { ...code, ...formData } : code
      );
      saveErrorCodes(updatedCodes);
    }
    
    setIsCreating(false);
    setEditingCode(null);
  };

  const handleDelete = (codeId: string) => {
    if (confirm('Are you sure you want to delete this error code?')) {
      saveErrorCodes(errorCodes.filter(code => code.id !== codeId));
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingCode(null);
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const csv = e.target?.result as string;
        const lines = csv.split('\n');
        
        const importedCodes: ErrorCode[] = lines.slice(1)
          .filter(line => line.trim())
          .map((line, index) => {
            const values = line.split(',');
            return {
              id: (Date.now() + index).toString(),
              code: values[0]?.trim() || '',
              description: values[1]?.trim() || '',
              resolution: values[2]?.trim() || '',
              category: values[3]?.trim() || '',
              severity: (values[4]?.trim() as any) || 'medium',
              autoResolve: values[5]?.trim().toLowerCase() === 'true'
            };
          });
        
        saveErrorCodes([...errorCodes, ...importedCodes]);
      };
      reader.readAsText(file);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Code', 'Description', 'Resolution', 'Category', 'Severity', 'Auto Resolve'];
    const csvContent = [
      headers.join(','),
      ...errorCodes.map(code => [
        code.code,
        `"${code.description}"`,
        `"${code.resolution}"`,
        code.category,
        code.severity,
        code.autoResolve
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'error_codes.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Error Code Management</h3>
        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors cursor-pointer">
            <Upload className="h-4 w-4" />
            <span>Import CSV</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              className="hidden"
            />
          </label>
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Error Code</span>
          </button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingCode) && (
        <div className="bg-slate-900 border border-slate-600 rounded-lg p-6 mb-6">
          <h4 className="text-white font-medium mb-4">
            {isCreating ? 'Create New Error Code' : 'Edit Error Code'}
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Error Code
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                placeholder="e.g., AUTH_001"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Category
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                placeholder="e.g., Authentication, Database"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Description
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                placeholder="Brief description of the error"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Resolution Steps
              </label>
              <textarea
                value={formData.resolution}
                onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 h-24"
                placeholder="Detailed steps to resolve this error"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Severity
              </label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            
            <div className="flex items-center">
              <label className="flex items-center space-x-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={formData.autoResolve}
                  onChange={(e) => setFormData({ ...formData, autoResolve: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-600"
                />
                <span>Auto-resolve when conditions are met</span>
              </label>
            </div>
          </div>
          
          <div className="flex items-center space-x-4 mt-6">
            <button
              onClick={handleSave}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <Save className="h-4 w-4" />
              <span>Save</span>
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      )}

      {/* Error Codes List */}
      {errorCodes.length === 0 ? (
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Error Codes Configured</h3>
          <p className="text-slate-400 mb-4">Start by adding your first error code to enable log enrichment.</p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add First Error Code</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {errorCodes.map(errorCode => (
            <div key={errorCode.id} className="bg-slate-900 border border-slate-600 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4 flex-1">
                  <div className={`p-2 rounded-lg ${
                    errorCode.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                    errorCode.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                    errorCode.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-white font-medium">{errorCode.code}</h4>
                      <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${
                        errorCode.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                        errorCode.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                        errorCode.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {errorCode.severity}
                      </span>
                      <span className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">
                        {errorCode.category}
                      </span>
                      {errorCode.autoResolve && (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                          Auto-resolve
                        </span>
                      )}
                    </div>
                    <p className="text-slate-300 text-sm mb-2">{errorCode.description}</p>
                    <p className="text-slate-400 text-xs">{errorCode.resolution}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEdit(errorCode)}
                    className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(errorCode.id)}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}