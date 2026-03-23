import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, Target, AlertTriangle } from 'lucide-react';
import { CriticalityRule } from '../../types';

interface CriticalityManagerProps {
  onDataUpdate: () => void;
}

export function CriticalityManager({ onDataUpdate }: CriticalityManagerProps) {
  const [rules, setRules] = useState<CriticalityRule[]>([]);
  const [editingRule, setEditingRule] = useState<CriticalityRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    conditions: {
      errorCodes: [] as string[],
      sources: [] as string[],
      keywords: [] as string[],
      ipRanges: [] as string[],
      timeWindow: 60
    },
    severity: 'medium' as const,
    escalationTime: 300,
    autoResolve: false,
    notificationChannels: [] as string[]
  });

  useEffect(() => {
    // Load existing rules from localStorage
    const savedRules = localStorage.getItem('criticalityRules');
    if (savedRules) {
      try {
        setRules(JSON.parse(savedRules));
      } catch (error) {
        console.error('Error parsing saved criticality rules:', error);
        setRules([]);
      }
    } else {
      // Start with empty array - no default rules
      setRules([]);
    }
  }, []);

  const saveRules = (newRules: CriticalityRule[]) => {
    setRules(newRules);
    localStorage.setItem('criticalityRules', JSON.stringify(newRules));
    onDataUpdate();
  };

  const handleCreate = () => {
    setIsCreating(true);
    setFormData({
      name: '',
      description: '',
      conditions: {
        errorCodes: [],
        sources: [],
        keywords: [],
        ipRanges: [],
        timeWindow: 60
      },
      severity: 'medium',
      escalationTime: 300,
      autoResolve: false,
      notificationChannels: []
    });
  };

  const handleEdit = (rule: CriticalityRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description,
      conditions: { ...rule.conditions },
      severity: rule.severity,
      escalationTime: rule.escalationTime,
      autoResolve: rule.autoResolve,
      notificationChannels: [...rule.notificationChannels]
    });
  };

  const handleSave = () => {
    if (isCreating) {
      const newRule: CriticalityRule = {
        id: Date.now().toString(),
        ...formData
      };
      saveRules([...rules, newRule]);
    } else if (editingRule) {
      const updatedRules = rules.map(rule =>
        rule.id === editingRule.id ? { ...rule, ...formData } : rule
      );
      saveRules(updatedRules);
    }
    
    setIsCreating(false);
    setEditingRule(null);
  };

  const handleDelete = (ruleId: string) => {
    if (confirm('Are you sure you want to delete this criticality rule?')) {
      saveRules(rules.filter(rule => rule.id !== ruleId));
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingRule(null);
  };

  const handleArrayInput = (field: keyof typeof formData.conditions, value: string) => {
    if (field === 'timeWindow') return;
    
    const items = value.split(',').map(item => item.trim()).filter(item => item);
    setFormData({
      ...formData,
      conditions: {
        ...formData.conditions,
        [field]: items
      }
    });
  };

  const handleNotificationChannels = (value: string) => {
    const channels = value.split(',').map(item => item.trim()).filter(item => item);
    setFormData({
      ...formData,
      notificationChannels: channels
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Criticality Rules Management</h3>
        <button
          onClick={handleCreate}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add Rule</span>
        </button>
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingRule) && (
        <div className="bg-slate-900 border border-slate-600 rounded-lg p-6 mb-6">
          <h4 className="text-white font-medium mb-4">
            {isCreating ? 'Create New Criticality Rule' : 'Edit Criticality Rule'}
          </h4>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Rule Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                  placeholder="Database Connection Failures"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Severity Level
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
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 h-20"
                placeholder="Describe when this rule should be applied"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Error Codes (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.conditions.errorCodes.join(', ')}
                  onChange={(e) => handleArrayInput('errorCodes', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                  placeholder="DB_001, AUTH_001"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Sources (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.conditions.sources.join(', ')}
                  onChange={(e) => handleArrayInput('sources', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                  placeholder="database, auth-service"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.conditions.keywords.join(', ')}
                  onChange={(e) => handleArrayInput('keywords', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                  placeholder="connection, timeout, failed"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  IP Ranges (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.conditions.ipRanges.join(', ')}
                  onChange={(e) => handleArrayInput('ipRanges', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                  placeholder="192.168.1.0/24, 10.0.0.0/8"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Time Window (seconds)
                </label>
                <input
                  type="number"
                  value={formData.conditions.timeWindow}
                  onChange={(e) => setFormData({
                    ...formData,
                    conditions: { ...formData.conditions, timeWindow: parseInt(e.target.value) }
                  })}
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Escalation Time (seconds)
                </label>
                <input
                  type="number"
                  value={formData.escalationTime}
                  onChange={(e) => setFormData({ ...formData, escalationTime: parseInt(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                />
              </div>
              
              <div className="flex items-center">
                <label className="flex items-center space-x-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.autoResolve}
                    onChange={(e) => setFormData({ ...formData, autoResolve: e.target.checked })}
                    className="rounded bg-slate-800 border-slate-600"
                  />
                  <span>Auto-resolve</span>
                </label>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Notification Channels (comma-separated)
              </label>
              <input
                type="text"
                value={formData.notificationChannels.join(', ')}
                onChange={(e) => handleNotificationChannels(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                placeholder="email, slack, teams"
              />
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

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="text-center py-12">
          <Target className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Criticality Rules Configured</h3>
          <p className="text-slate-400 mb-4">Create rules to automatically escalate log entries based on specific conditions.</p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add First Rule</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map(rule => (
            <div key={rule.id} className="bg-slate-900 border border-slate-600 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4 flex-1">
                  <div className={`p-2 rounded-lg ${
                    rule.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                    rule.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                    rule.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    <Target className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-white font-medium">{rule.name}</h4>
                      <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${
                        rule.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                        rule.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                        rule.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {rule.severity}
                      </span>
                      {rule.autoResolve && (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                          Auto-resolve
                        </span>
                      )}
                    </div>
                    <p className="text-slate-300 text-sm mb-3">{rule.description}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400">Error Codes:</span>
                        <span className="text-white ml-2">
                          {rule.conditions.errorCodes.length > 0 ? rule.conditions.errorCodes.join(', ') : 'Any'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Sources:</span>
                        <span className="text-white ml-2">
                          {rule.conditions.sources.length > 0 ? rule.conditions.sources.join(', ') : 'Any'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Time Window:</span>
                        <span className="text-white ml-2">{rule.conditions.timeWindow}s</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Escalation:</span>
                        <span className="text-white ml-2">{rule.escalationTime}s</span>
                      </div>
                    </div>
                    
                    {rule.notificationChannels.length > 0 && (
                      <div className="mt-2 text-xs">
                        <span className="text-slate-400">Notifications:</span>
                        <span className="text-white ml-2">{rule.notificationChannels.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEdit(rule)}
                    className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
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