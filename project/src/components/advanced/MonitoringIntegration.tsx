import React, { useState, useEffect } from 'react';
import { Activity, Database, BarChart3, Gauge, Settings, X, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Site } from '../../types';

interface MonitoringIntegrationProps {
  sites: Site[];
  isOpen: boolean;
  onClose: () => void;
}

interface IntegrationConfig {
  id: string;
  name: string;
  type: 'telegraf' | 'influxdb' | 'prometheus' | 'grafana';
  enabled: boolean;
  endpoint: string;
  credentials: {
    username?: string;
    password?: string;
    token?: string;
    database?: string;
  };
  settings: {
    interval: number;
    retention: string;
    tags: Record<string, string>;
  };
  status: 'connected' | 'disconnected' | 'error' | 'configuring';
  lastSync?: Date;
}

interface MetricData {
  timestamp: Date;
  value: number;
  tags: Record<string, string>;
}

export function MonitoringIntegration({ sites, isOpen, onClose }: MonitoringIntegrationProps) {
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationConfig | null>(null);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, any>>({});

  useEffect(() => {
    // Load saved integrations
    const saved = localStorage.getItem('monitoringIntegrations');
    if (saved) {
      try {
        const configs = JSON.parse(saved).map((config: any) => ({
          ...config,
          lastSync: config.lastSync ? new Date(config.lastSync) : undefined
        }));
        setIntegrations(configs);
      } catch (error) {
        console.error('Error loading integrations:', error);
      }
    } else {
      // Initialize with default configurations
      setIntegrations(createDefaultIntegrations());
    }
  }, []);

  const createDefaultIntegrations = (): IntegrationConfig[] => {
    return [
      {
        id: 'telegraf-1',
        name: 'Telegraf Agent',
        type: 'telegraf',
        enabled: false,
        endpoint: 'http://localhost:8086',
        credentials: {
          username: 'admin',
          password: '',
          database: 'logsentinel'
        },
        settings: {
          interval: 10,
          retention: '30d',
          tags: {
            environment: 'production',
            service: 'logsentinel'
          }
        },
        status: 'disconnected'
      },
      {
        id: 'influxdb-1',
        name: 'InfluxDB Time Series',
        type: 'influxdb',
        enabled: false,
        endpoint: 'http://localhost:8086',
        credentials: {
          username: 'admin',
          password: '',
          database: 'logsentinel_metrics'
        },
        settings: {
          interval: 15,
          retention: '90d',
          tags: {
            datacenter: 'primary',
            region: 'us-east-1'
          }
        },
        status: 'disconnected'
      },
      {
        id: 'prometheus-1',
        name: 'Prometheus Metrics',
        type: 'prometheus',
        enabled: false,
        endpoint: 'http://localhost:9090',
        credentials: {
          token: ''
        },
        settings: {
          interval: 5,
          retention: '15d',
          tags: {
            job: 'logsentinel',
            instance: 'primary'
          }
        },
        status: 'disconnected'
      },
      {
        id: 'grafana-1',
        name: 'Grafana Dashboards',
        type: 'grafana',
        enabled: false,
        endpoint: 'http://localhost:3000',
        credentials: {
          token: ''
        },
        settings: {
          interval: 60,
          retention: '365d',
          tags: {
            org: 'logsentinel',
            team: 'ops'
          }
        },
        status: 'disconnected'
      }
    ];
  };

  const saveIntegrations = (configs: IntegrationConfig[]) => {
    setIntegrations(configs);
    localStorage.setItem('monitoringIntegrations', JSON.stringify(configs));
  };

  const testConnection = async (integration: IntegrationConfig) => {
    setTestResults(prev => ({ ...prev, [integration.id]: { testing: true } }));
    
    // Simulate connection test
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const success = Math.random() > 0.3; // 70% success rate for demo
    const result = {
      testing: false,
      success,
      message: success ? 'Connection successful' : 'Connection failed: Timeout',
      timestamp: new Date()
    };
    
    setTestResults(prev => ({ ...prev, [integration.id]: result }));
    
    if (success) {
      const updatedIntegrations = integrations.map(int => 
        int.id === integration.id 
          ? { ...int, status: 'connected' as const, lastSync: new Date() }
          : int
      );
      saveIntegrations(updatedIntegrations);
    }
  };

  const toggleIntegration = (integrationId: string) => {
    const updatedIntegrations = integrations.map(int => 
      int.id === integrationId 
        ? { 
            ...int, 
            enabled: !int.enabled,
            status: !int.enabled ? 'connected' : 'disconnected',
            lastSync: !int.enabled ? new Date() : undefined
          }
        : int
    );
    saveIntegrations(updatedIntegrations);
  };

  const updateIntegration = (updatedIntegration: IntegrationConfig) => {
    const updatedIntegrations = integrations.map(int => 
      int.id === updatedIntegration.id ? updatedIntegration : int
    );
    saveIntegrations(updatedIntegrations);
    setSelectedIntegration(null);
    setIsConfiguring(false);
  };

  const getIntegrationIcon = (type: string) => {
    switch (type) {
      case 'telegraf': return Activity;
      case 'influxdb': return Database;
      case 'prometheus': return Gauge;
      case 'grafana': return BarChart3;
      default: return Settings;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'disconnected': return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
      case 'error': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'configuring': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-6xl w-full max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Activity className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Monitoring Tool Integration</h2>
                <p className="text-slate-400">Connect with Telegraf, InfluxDB, Prometheus, and Grafana</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="flex h-[calc(95vh-140px)]">
          {/* Integration List */}
          <div className="w-80 border-r border-slate-700 p-4 overflow-y-auto">
            <h3 className="text-white font-medium mb-4">Available Integrations</h3>
            
            <div className="space-y-3">
              {integrations.map(integration => {
                const Icon = getIntegrationIcon(integration.type);
                const testResult = testResults[integration.id];
                
                return (
                  <div key={integration.id} className="bg-slate-900 border border-slate-600 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                          <Icon className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                          <h4 className="text-white font-medium">{integration.name}</h4>
                          <p className="text-slate-400 text-sm capitalize">{integration.type}</p>
                        </div>
                      </div>
                      
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={integration.enabled}
                          onChange={() => toggleIntegration(integration.id)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    
                    <div className={`px-2 py-1 rounded text-xs font-medium border mb-3 ${getStatusColor(integration.status)}`}>
                      {integration.status}
                    </div>
                    
                    <div className="text-xs text-slate-400 mb-3">
                      <div>Endpoint: {integration.endpoint}</div>
                      <div>Interval: {integration.settings.interval}s</div>
                      {integration.lastSync && (
                        <div>Last sync: {integration.lastSync.toLocaleTimeString()}</div>
                      )}
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => testConnection(integration)}
                        disabled={testResult?.testing}
                        className="flex-1 px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded text-xs transition-colors"
                      >
                        {testResult?.testing ? 'Testing...' : 'Test'}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedIntegration(integration);
                          setIsConfiguring(true);
                        }}
                        className="flex-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors"
                      >
                        Configure
                      </button>
                    </div>
                    
                    {testResult && !testResult.testing && (
                      <div className={`mt-2 p-2 rounded text-xs ${
                        testResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        <div className="flex items-center space-x-1">
                          {testResult.success ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                          <span>{testResult.message}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Configuration Panel */}
          <div className="flex-1 p-6 overflow-y-auto">
            {!isConfiguring ? (
              <div className="text-center py-12">
                <Settings className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-white font-medium mb-2">Integration Overview</h3>
                <p className="text-slate-400 mb-6">Select an integration to configure its settings</p>
                
                {/* Integration Status Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
                  {['telegraf', 'influxdb', 'prometheus', 'grafana'].map(type => {
                    const integration = integrations.find(i => i.type === type);
                    const Icon = getIntegrationIcon(type);
                    
                    return (
                      <div key={type} className="bg-slate-900 border border-slate-600 rounded-lg p-4">
                        <div className="flex items-center justify-center mb-2">
                          <Icon className="h-8 w-8 text-blue-400" />
                        </div>
                        <h4 className="text-white font-medium text-sm capitalize mb-1">{type}</h4>
                        <div className={`text-xs px-2 py-1 rounded ${
                          integration?.enabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'
                        }`}>
                          {integration?.enabled ? 'Active' : 'Inactive'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : selectedIntegration && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-white font-medium">Configure {selectedIntegration.name}</h3>
                  <button
                    onClick={() => {
                      setIsConfiguring(false);
                      setSelectedIntegration(null);
                    }}
                    className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                
                <div className="space-y-6">
                  {/* Connection Settings */}
                  <div className="bg-slate-900 border border-slate-600 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-4">Connection Settings</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Endpoint URL
                        </label>
                        <input
                          type="text"
                          value={selectedIntegration.endpoint}
                          onChange={(e) => setSelectedIntegration({
                            ...selectedIntegration,
                            endpoint: e.target.value
                          })}
                          className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                          placeholder="http://localhost:8086"
                        />
                      </div>
                      
                      {selectedIntegration.type !== 'prometheus' && selectedIntegration.type !== 'grafana' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                              Username
                            </label>
                            <input
                              type="text"
                              value={selectedIntegration.credentials.username || ''}
                              onChange={(e) => setSelectedIntegration({
                                ...selectedIntegration,
                                credentials: { ...selectedIntegration.credentials, username: e.target.value }
                              })}
                              className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                              Password
                            </label>
                            <input
                              type="password"
                              value={selectedIntegration.credentials.password || ''}
                              onChange={(e) => setSelectedIntegration({
                                ...selectedIntegration,
                                credentials: { ...selectedIntegration.credentials, password: e.target.value }
                              })}
                              className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                            />
                          </div>
                          
                          {selectedIntegration.type === 'influxdb' && (
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">
                                Database Name
                              </label>
                              <input
                                type="text"
                                value={selectedIntegration.credentials.database || ''}
                                onChange={(e) => setSelectedIntegration({
                                  ...selectedIntegration,
                                  credentials: { ...selectedIntegration.credentials, database: e.target.value }
                                })}
                                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                              />
                            </div>
                          )}
                        </>
                      )}
                      
                      {(selectedIntegration.type === 'prometheus' || selectedIntegration.type === 'grafana') && (
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            API Token
                          </label>
                          <input
                            type="password"
                            value={selectedIntegration.credentials.token || ''}
                            onChange={(e) => setSelectedIntegration({
                              ...selectedIntegration,
                              credentials: { ...selectedIntegration.credentials, token: e.target.value }
                            })}
                            className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Collection Settings */}
                  <div className="bg-slate-900 border border-slate-600 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-4">Collection Settings</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Collection Interval (seconds)
                        </label>
                        <input
                          type="number"
                          value={selectedIntegration.settings.interval}
                          onChange={(e) => setSelectedIntegration({
                            ...selectedIntegration,
                            settings: { ...selectedIntegration.settings, interval: parseInt(e.target.value) }
                          })}
                          className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                          min="1"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Data Retention
                        </label>
                        <select
                          value={selectedIntegration.settings.retention}
                          onChange={(e) => setSelectedIntegration({
                            ...selectedIntegration,
                            settings: { ...selectedIntegration.settings, retention: e.target.value }
                          })}
                          className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                        >
                          <option value="7d">7 days</option>
                          <option value="30d">30 days</option>
                          <option value="90d">90 days</option>
                          <option value="365d">1 year</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  {/* Tags Configuration */}
                  <div className="bg-slate-900 border border-slate-600 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-4">Tags & Labels</h4>
                    
                    <div className="space-y-3">
                      {Object.entries(selectedIntegration.settings.tags).map(([key, value]) => (
                        <div key={key} className="flex space-x-2">
                          <input
                            type="text"
                            value={key}
                            onChange={(e) => {
                              const newTags = { ...selectedIntegration.settings.tags };
                              delete newTags[key];
                              newTags[e.target.value] = value;
                              setSelectedIntegration({
                                ...selectedIntegration,
                                settings: { ...selectedIntegration.settings, tags: newTags }
                              });
                            }}
                            className="flex-1 bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                            placeholder="Tag name"
                          />
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => setSelectedIntegration({
                              ...selectedIntegration,
                              settings: {
                                ...selectedIntegration.settings,
                                tags: { ...selectedIntegration.settings.tags, [key]: e.target.value }
                              }
                            })}
                            className="flex-1 bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                            placeholder="Tag value"
                          />
                        </div>
                      ))}
                      
                      <button
                        onClick={() => setSelectedIntegration({
                          ...selectedIntegration,
                          settings: {
                            ...selectedIntegration.settings,
                            tags: { ...selectedIntegration.settings.tags, '': '' }
                          }
                        })}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                      >
                        Add Tag
                      </button>
                    </div>
                  </div>
                  
                  {/* Save Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => updateIntegration(selectedIntegration)}
                      className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                    >
                      Save Configuration
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}