import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Shield, 
  Users, 
  Clock, 
  Settings,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  AlertTriangle,
  CheckCircle,
  Radio
} from 'lucide-react';
import { Site, LogEntry, MLAnomaly } from '../types';
import { SmartAlertingEngine, AlertRule, SmartAlert, EscalationRule } from '../utils/smartAlerting';
import { forwardTrap, forwardTrapManually } from '../utils/snmpTrapForwarder';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { ViewLogFileButton } from './ViewLogFileButton';

interface SmartAlertingPanelProps {
  sites: Site[];
  logs: LogEntry[];
  anomalies: MLAnomaly[];
  isOpen: boolean;
  onClose: () => void;
  currentUser?: { fullName?: string; username: string } | null;
}

export function SmartAlertingPanel({ 
  sites, 
  logs, 
  anomalies, 
  isOpen, 
  onClose,
  currentUser
}: SmartAlertingPanelProps) {
  const [activeTab, setActiveTab] = useState<'alerts' | 'rules' | 'escalations'>('alerts');
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [smartAlerts, setSmartAlerts] = useState<SmartAlert[]>([]);
  const [isCreatingRule, setIsCreatingRule] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [editingEscalation, setEditingEscalation] = useState<{ rule: AlertRule; index: number } | null>(null);
  const [newEscalation, setNewEscalation] = useState<Partial<EscalationRule>>({
    level: 1,
    delayMinutes: 0,
    recipients: [],
    channels: []
  });
  
  const [newRule, setNewRule] = useState<Partial<AlertRule>>({
    name: '',
    description: '',
    conditions: [],
    suppressionRules: [],
    escalationRules: [],
    contextualInfo: {
      troubleshootingSteps: [],
      relatedDashboards: [],
      knowledgeBaseArticles: [],
      automatedActions: []
    },
    enabled: true
  });

  useEffect(() => {
    // Load saved alert rules
    const savedRules = localStorage.getItem('alertRules');
    if (savedRules) {
      try {
        const rules = JSON.parse(savedRules).map((rule: any) => ({
          ...rule,
          createdAt: new Date(rule.createdAt),
          lastTriggered: rule.lastTriggered ? new Date(rule.lastTriggered) : undefined
        }));
        setAlertRules(rules);
      } catch (error) {
        console.error('Error loading alert rules:', error);
        setAlertRules(createDefaultAlertRules());
      }
    } else {
      const defaultRules = createDefaultAlertRules();
      setAlertRules(defaultRules);
      localStorage.setItem('alertRules', JSON.stringify(defaultRules));
    }
  }, []);

  useEffect(() => {
    if (alertRules.length > 0) {
      // Process events and generate smart alerts
      const newAlerts = SmartAlertingEngine.processEvents(logs, anomalies, sites, alertRules);
      setSmartAlerts(prev => [...newAlerts, ...prev].slice(0, 50)); // Keep last 50 alerts
      // Forward new alerts via SNMP trap (if configured)
      newAlerts.forEach((alert) => {
        forwardTrap('alert', alert.severity, {
          title: alert.title,
          description: alert.description,
          affectedSites: alert.affectedSites,
          siteName: alert.affectedSites?.[0] || 'Unknown'
        }).catch(() => {});
      });
    }
  }, [logs, anomalies, sites, alertRules]);

  const createDefaultAlertRules = (): AlertRule[] => {
    const now = new Date();
    return [
      {
        id: 'critical-error-flood',
        name: 'Critical Error Flood',
        description: 'Multiple critical errors in short time window',
        conditions: [
          {
            type: 'log_count',
            operator: '>',
            threshold: 5,
            timeWindow: 10,
            severityLevels: ['critical']
          }
        ],
        suppressionRules: [
          {
            type: 'duplicate',
            timeWindow: 30,
            maxAlerts: 1,
            conditions: {}
          }
        ],
        escalationRules: [
          {
            level: 1,
            delayMinutes: 0,
            recipients: ['oncall@company.com'],
            channels: ['email', 'slack']
          },
          {
            level: 2,
            delayMinutes: 15,
            recipients: ['manager@company.com'],
            channels: ['email', 'sms']
          }
        ],
        contextualInfo: {
          troubleshootingSteps: [
            'Check system resources',
            'Review recent deployments',
            'Verify database connectivity',
            'Check application logs'
          ],
          relatedDashboards: [
            '/dashboard/system-health',
            '/dashboard/error-rates'
          ],
          knowledgeBaseArticles: [
            'Critical Error Response Playbook',
            'System Recovery Procedures'
          ],
          automatedActions: [
            {
              type: 'restart_service',
              description: 'Restart affected services',
              enabled: false,
              conditions: {}
            }
          ]
        },
        enabled: true,
        createdAt: now
      },
      {
        id: 'anomaly-detection',
        name: 'High-Confidence Anomaly',
        description: 'ML detected high-confidence anomaly',
        conditions: [
          {
            type: 'anomaly_score',
            operator: '>',
            threshold: 80,
            timeWindow: 5
          }
        ],
        suppressionRules: [
          {
            type: 'flood',
            timeWindow: 15,
            maxAlerts: 3,
            conditions: {}
          }
        ],
        escalationRules: [
          {
            level: 1,
            delayMinutes: 5,
            recipients: ['ml-team@company.com'],
            channels: ['slack']
          }
        ],
        contextualInfo: {
          troubleshootingSteps: [
            'Review anomaly details',
            'Check for data quality issues',
            'Verify ML model performance',
            'Investigate root cause'
          ],
          relatedDashboards: [
            '/dashboard/ml-anomalies',
            '/dashboard/data-quality'
          ],
          knowledgeBaseArticles: [
            'Anomaly Investigation Guide',
            'ML Model Troubleshooting'
          ],
          automatedActions: []
        },
        enabled: true,
        createdAt: now
      }
    ];
  };

  const saveRule = () => {
    if (!newRule.name || !newRule.description) {
      alert('Please fill in all required fields');
      return;
    }

    const rule: AlertRule = {
      id: editingRule?.id || `rule_${Date.now()}`,
      name: newRule.name!,
      description: newRule.description!,
      conditions: newRule.conditions || [],
      suppressionRules: newRule.suppressionRules || [],
      escalationRules: newRule.escalationRules || [],
      contextualInfo: newRule.contextualInfo || {
        troubleshootingSteps: [],
        relatedDashboards: [],
        knowledgeBaseArticles: [],
        automatedActions: []
      },
      enabled: newRule.enabled !== false,
      createdAt: editingRule?.createdAt || new Date(),
      lastTriggered: editingRule?.lastTriggered
    };

    let updatedRules;
    if (editingRule) {
      updatedRules = alertRules.map(r => r.id === rule.id ? rule : r);
    } else {
      updatedRules = [...alertRules, rule];
    }

    setAlertRules(updatedRules);
    localStorage.setItem('alertRules', JSON.stringify(updatedRules));
    
    setIsCreatingRule(false);
    setEditingRule(null);
    resetForm();
  };

  const deleteRule = (ruleId: string) => {
    if (confirm('Are you sure you want to delete this alert rule?')) {
      const updatedRules = alertRules.filter(r => r.id !== ruleId);
      setAlertRules(updatedRules);
      localStorage.setItem('alertRules', JSON.stringify(updatedRules));
    }
  };

  const editRule = (rule: AlertRule) => {
    setEditingRule(rule);
    setNewRule({
      name: rule.name,
      description: rule.description,
      conditions: [...rule.conditions],
      suppressionRules: [...rule.suppressionRules],
      escalationRules: [...rule.escalationRules],
      contextualInfo: { ...rule.contextualInfo },
      enabled: rule.enabled
    });
    setIsCreatingRule(true);
  };

  const resetForm = () => {
    setNewRule({
      name: '',
      description: '',
      conditions: [],
      suppressionRules: [],
      escalationRules: [],
      contextualInfo: {
        troubleshootingSteps: [],
        relatedDashboards: [],
        knowledgeBaseArticles: [],
        automatedActions: []
      },
      enabled: true
    });
  };

  const updateRuleEscalations = (ruleId: string, escalationRules: EscalationRule[]) => {
    const updated = alertRules.map(r =>
      r.id === ruleId ? { ...r, escalationRules } : r
    );
    setAlertRules(updated);
    localStorage.setItem('alertRules', JSON.stringify(updated));
  };

  const addEscalationLevel = (rule: AlertRule) => {
    setEditingEscalation(null);
    setNewEscalation({
      level: (rule.escalationRules?.length ?? 0) + 1,
      delayMinutes: 0,
      recipients: [],
      channels: []
    });
    setEditingEscalation({ rule, index: -1 });
  };

  const editEscalationLevel = (rule: AlertRule, index: number) => {
    const esc = rule.escalationRules[index];
    setNewEscalation({
      level: esc.level,
      delayMinutes: esc.delayMinutes,
      recipients: [...esc.recipients],
      channels: [...esc.channels]
    });
    setEditingEscalation({ rule, index });
  };

  const saveEscalationLevel = () => {
    if (!editingEscalation) return;
    const { rule, index } = editingEscalation;
    const esc: EscalationRule = {
      level: newEscalation.level ?? 1,
      delayMinutes: newEscalation.delayMinutes ?? 0,
      recipients: Array.isArray(newEscalation.recipients) ? newEscalation.recipients : [],
      channels: (Array.isArray(newEscalation.channels) ? newEscalation.channels : []) as EscalationRule['channels']
    };
    if (esc.recipients.length === 0) {
      toast.error('Add at least one recipient');
      return;
    }
    if (esc.channels.length === 0) {
      toast.error('Select at least one channel');
      return;
    }
    const next = [...(rule.escalationRules || [])];
    if (index >= 0) next[index] = esc;
    else next.push(esc);
    updateRuleEscalations(rule.id, next);
    setEditingEscalation(null);
    setNewEscalation({ level: 1, delayMinutes: 0, recipients: [], channels: [] });
  };

  const deleteEscalationLevel = (rule: AlertRule, index: number) => {
    const next = rule.escalationRules.filter((_, i) => i !== index);
    updateRuleEscalations(rule.id, next);
    if (editingEscalation?.rule.id === rule.id && editingEscalation.index === index) {
      setEditingEscalation(null);
    }
  };

  const acknowledgeAlert = (alertId: string) => {
    const acknowledgedBy = currentUser ? (currentUser.fullName || currentUser.username) : prompt('Enter your name/ID:');
    if (acknowledgedBy) {
      setSmartAlerts(prev => 
        prev.map(alert => 
          alert.id === alertId 
            ? { 
                ...alert, 
                acknowledged: true, 
                acknowledgedBy: String(acknowledgedBy).trim(),
                acknowledgedAt: new Date()
              }
            : alert
        )
      );
    }
  };

  const resolveAlert = (alertId: string) => {
    setSmartAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId 
          ? { 
              ...alert, 
              resolved: true, 
              resolvedAt: new Date()
            }
          : alert
      )
    );
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'high': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'low': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-7xl w-full max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <Bell className="h-6 w-6 text-orange-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Smart Alerting & Escalation</h2>
                <p className="text-slate-400">Intelligent alert management with fatigue prevention</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex space-x-4 mt-4">
            {[
              { id: 'alerts', label: 'Active Alerts', icon: AlertTriangle },
              { id: 'rules', label: 'Alert Rules', icon: Settings },
              { id: 'escalations', label: 'Escalation Workflows', icon: Users }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-orange-600 text-white' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.id === 'alerts' && smartAlerts.filter(a => !a.resolved).length > 0 && (
                  <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs">
                    {smartAlerts.filter(a => !a.resolved).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(95vh-140px)]">
          {/* Active Alerts */}
          {activeTab === 'alerts' && (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Active Smart Alerts</h3>

              {smartAlerts.filter(alert => !alert.resolved).length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                  <h4 className="text-white font-medium mb-2">No Active Alerts</h4>
                  <p className="text-slate-400">All systems are operating normally</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {smartAlerts.filter(alert => !alert.resolved).map(alert => (
                    <div key={alert.id} className={`border rounded-lg p-6 ${getSeverityColor(alert.severity)} border`}>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start space-x-4">
                          <div className={`p-2 rounded-lg ${getSeverityColor(alert.severity)}`}>
                            <AlertTriangle className="h-6 w-6" />
                          </div>
                          <div>
                            <h4 className="text-white font-semibold text-lg">{alert.title}</h4>
                            <p className="text-slate-300 mt-1">{alert.description}</p>
                            <div className="flex items-center space-x-4 mt-2 text-sm">
                              <span className="text-slate-400">
                                Triggered: {format(alert.triggeredAt, 'MMM dd, HH:mm')}
                              </span>
                              <span className="text-slate-400">
                                Events: {alert.events.length}
                              </span>
                              <span className="text-slate-400">
                                Sites: {alert.affectedSites.length}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {(() => {
                            const logWithFile = alert.events.find((e): e is LogEntry => 'fileInfo' in e && e.fileInfo?.filePath);
                            return logWithFile?.fileInfo?.filePath ? (
                              <ViewLogFileButton filePath={logWithFile.fileInfo.filePath} fileName={logWithFile.fileInfo.fileName} />
                            ) : null;
                          })()}
                          <button
                            onClick={async () => {
                              const r = await forwardTrapManually(alert.severity, {
                                title: alert.title,
                                description: alert.description,
                                affectedSites: alert.affectedSites,
                                siteName: alert.affectedSites?.[0] || 'Unknown'
                              });
                              if (r.success) {
                                toast.success('SNMP trap sent');
                              } else {
                                toast.error(r.error || 'Failed to send SNMP trap');
                              }
                            }}
                            className="flex items-center gap-1 px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded transition-colors"
                            title="Forward to SNMP manually"
                          >
                            <Radio className="h-3.5 w-3.5" />
                            Forward SNMP
                          </button>
                          {!alert.acknowledged && (
                            <button
                              onClick={() => acknowledgeAlert(alert.id)}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                            >
                              Acknowledge
                            </button>
                          )}
                          <button
                            onClick={() => resolveAlert(alert.id)}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                          >
                            Resolve
                          </button>
                        </div>
                      </div>

                      {alert.acknowledged && (
                        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded">
                          <div className="text-blue-400 text-sm">
                            Acknowledged by {alert.acknowledgedBy} at {format(alert.acknowledgedAt!, 'MMM dd, HH:mm')}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h5 className="text-slate-300 font-medium mb-3">Troubleshooting Steps</h5>
                          <ul className="space-y-2">
                            {alert.contextualInfo.troubleshootingSteps.map((step, index) => (
                              <li key={index} className="flex items-start space-x-2">
                                <span className="text-blue-400 mt-1">•</span>
                                <span className="text-slate-300 text-sm">{step}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <h5 className="text-slate-300 font-medium mb-3">Related Resources</h5>
                          <div className="space-y-2">
                            {alert.contextualInfo.relatedDashboards.map((dashboard, index) => (
                              <div key={index} className="text-blue-400 text-sm hover:underline cursor-pointer">
                                📊 {dashboard}
                              </div>
                            ))}
                            {alert.contextualInfo.knowledgeBaseArticles.map((article, index) => (
                              <div key={index} className="text-green-400 text-sm hover:underline cursor-pointer">
                                📚 {article}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Alert Rules */}
          {activeTab === 'rules' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Alert Rules Configuration</h3>
                <button
                  onClick={() => setIsCreatingRule(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>New Rule</span>
                </button>
              </div>

              {/* Create/Edit Rule Form */}
              {isCreatingRule && (
                <div className="bg-slate-900 border border-slate-600 rounded-lg p-6 mb-6">
                  <h4 className="text-white font-medium mb-4">
                    {editingRule ? 'Edit Alert Rule' : 'Create New Alert Rule'}
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Rule Name</label>
                      <input
                        type="text"
                        value={newRule.name || ''}
                        onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                        placeholder="Enter rule name"
                      />
                    </div>
                    
                    <div className="flex items-center">
                      <label className="flex items-center space-x-2 text-slate-300">
                        <input
                          type="checkbox"
                          checked={newRule.enabled !== false}
                          onChange={(e) => setNewRule({ ...newRule, enabled: e.target.checked })}
                          className="rounded bg-slate-800 border-slate-600"
                        />
                        <span>Enabled</span>
                      </label>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                    <textarea
                      value={newRule.description || ''}
                      onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 h-20"
                      placeholder="Describe when this rule should trigger"
                    />
                  </div>

                  <div className="flex items-center space-x-4">
                    <button
                      onClick={saveRule}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                    >
                      <Save className="h-4 w-4" />
                      <span>Save Rule</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsCreatingRule(false);
                        setEditingRule(null);
                        resetForm();
                      }}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Rules List */}
              <div className="space-y-4">
                {alertRules.map(rule => (
                  <div key={rule.id} className="bg-slate-900 border border-slate-600 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="text-white font-medium">{rule.name}</h4>
                          <span className={`px-2 py-1 rounded text-xs ${
                            rule.enabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {rule.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <p className="text-slate-300 text-sm mb-3">{rule.description}</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400">
                          <div>
                            <span>Conditions: {rule.conditions.length}</span>
                          </div>
                          <div>
                            <span>Escalation Levels: {rule.escalationRules.length}</span>
                          </div>
                          <div>
                            <span>Last Triggered: {rule.lastTriggered ? format(rule.lastTriggered, 'MMM dd, HH:mm') : 'Never'}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => editRule(rule)}
                          className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteRule(rule.id)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Escalation Workflows */}
          {activeTab === 'escalations' && (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Escalation Workflows</h3>
              <p className="text-slate-400 text-sm mb-6">
                Edit escalation levels per alert rule. Each level defines delay, recipients, and channels.
              </p>

              {alertRules.map((rule) => (
                <div key={rule.id} className="bg-slate-900 border border-slate-600 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-white font-medium">{rule.name}</h4>
                    <button
                      onClick={() => addEscalationLevel(rule)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded text-sm"
                    >
                      <Plus className="h-4 w-4" />
                      Add level
                    </button>
                  </div>

                  {rule.escalationRules.length === 0 ? (
                    <p className="text-slate-500 text-sm">No escalation levels. Add one to define who gets notified and when.</p>
                  ) : (
                    <div className="space-y-2">
                      {rule.escalationRules.map((esc, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-800 rounded p-3">
                          <div className="text-sm">
                            <span className="text-white font-medium">Level {esc.level}</span>
                            <span className="text-slate-400 mx-2">•</span>
                            <span className="text-slate-300">Delay: {esc.delayMinutes} min</span>
                            <span className="text-slate-400 mx-2">•</span>
                            <span className="text-slate-300">To: {esc.recipients.join(', ')}</span>
                            <span className="text-slate-400 mx-2">•</span>
                            <span className="text-slate-300">Channels: {esc.channels.join(', ')}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => editEscalationLevel(rule, idx)}
                              className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => deleteEscalationLevel(rule, idx)}
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {editingEscalation?.rule.id === rule.id && (
                    <div className="mt-4 p-4 bg-slate-800 border border-slate-600 rounded-lg">
                      <h5 className="text-white font-medium mb-3">
                        {editingEscalation.index >= 0 ? 'Edit' : 'Add'} escalation level
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm text-slate-400 mb-1">Level</label>
                          <input
                            type="number"
                            min={1}
                            value={newEscalation.level ?? 1}
                            onChange={(e) => setNewEscalation({ ...newEscalation, level: parseInt(e.target.value) || 1 })}
                            className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-400 mb-1">Delay (minutes)</label>
                          <input
                            type="number"
                            min={0}
                            value={newEscalation.delayMinutes ?? 0}
                            onChange={(e) => setNewEscalation({ ...newEscalation, delayMinutes: parseInt(e.target.value) || 0 })}
                            className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm text-slate-400 mb-1">Recipients (comma-separated)</label>
                        <input
                          type="text"
                          value={(newEscalation.recipients ?? []).join(', ')}
                          onChange={(e) =>
                            setNewEscalation({
                              ...newEscalation,
                              recipients: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                            })
                          }
                          placeholder="email@company.com, manager@company.com"
                          className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm text-slate-400 mb-2">Channels</label>
                        <div className="flex flex-wrap gap-3">
                          {(['email', 'slack', 'teams', 'sms', 'webhook'] as const).map((ch) => (
                            <label key={ch} className="flex items-center gap-2 text-slate-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={(newEscalation.channels ?? []).includes(ch)}
                                onChange={(e) => {
                                  const chs = newEscalation.channels ?? [];
                                  setNewEscalation({
                                    ...newEscalation,
                                    channels: e.target.checked ? [...chs, ch] : chs.filter((c) => c !== ch)
                                  });
                                }}
                                className="rounded bg-slate-700 border-slate-600"
                              />
                              <span className="capitalize">{ch}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={saveEscalationLevel}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingEscalation(null);
                            setNewEscalation({ level: 1, delayMinutes: 0, recipients: [], channels: [] });
                          }}
                          className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}