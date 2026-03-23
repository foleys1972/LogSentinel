import React, { useState } from 'react';
import { Plus, Edit, Trash2, Save, X, MapPin, Folder, Settings, AlertCircle, Radio, FolderOpen, Zap } from 'lucide-react';
import { Site, BTSystemCommand } from '../../types';
import { selectFolder } from '../../utils/selectFolder';

const BT_COMMANDS: { id: BTSystemCommand; label: string }[] = [
  { id: 'get_health', label: 'Get health report' },
  { id: 'get_status', label: 'Get status' },
  { id: 'get_tpos', label: 'Get TPOs' },
  { id: 'get_zones', label: 'Get zones' },
  { id: 'ping', label: 'Ping' },
  { id: 'subscribe', label: 'Subscribe to events' }
];

interface SiteManagerProps {
  sites: Site[];
  onSitesUpdate: (sites: Site[]) => void;
}

const defaultMonitoringConfig = {
  folderPath: '',
  recursive: true,
  filePatterns: ['*.log', '*.txt'],
  excludePatterns: ['*.tmp', '*.bak'],
  tailEnabled: true,
  maxFileSize: 100,
  rotationHandling: true
};

const defaultBtConfig = {
  url: '',
  token: '',
  commands: ['get_health', 'get_status'] as BTSystemCommand[],
  frequencySeconds: 30
};

const TRADESENSE_AUTO_OPTIONS = [
  { key: 'autoGetZones', label: 'Get zones' },
  { key: 'autoGetTurrets', label: 'Get turrets' },
  { key: 'autoGetUsers', label: 'Get users' },
  { key: 'autoGetEvents', label: 'Get events' },
  { key: 'autoGetCalls', label: 'Get calls' },
  { key: 'autoGetVersion', label: 'Get version' },
  { key: 'autoGetTpos', label: 'Get TPOs' },
  { key: 'autoGetLines', label: 'Get lines' },
  { key: 'autoGetHealth', label: 'Get health (provisioning)' },
  { key: 'autoGetHealthApiReport', label: 'Get health API report' },
  { key: 'autoSubscribeToEvents', label: 'Subscribe to events' },
  { key: 'autoReconnect', label: 'Auto reconnect' }
] as const;

const defaultTradeSenseConfig = {
  url: '',
  token: '',
  autoGetZones: false,
  autoGetTurrets: false,
  autoGetUsers: false,
  autoGetEvents: false,
  autoGetCalls: false,
  autoGetVersion: false,
  autoGetTpos: false,
  autoGetLines: false,
  autoGetHealth: false,
  autoGetHealthApiReport: true,
  autoSubscribeToEvents: true,
  autoReconnect: true
};

export function SiteManager({ sites, onSitesUpdate }: SiteManagerProps) {
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    coordinates: { lat: 0, lng: 0 },
    healthScore: 100,
    status: 'green' as const,
    btSystemEnabled: false,
    btSystemConfig: defaultBtConfig,
    tradeSenseEnabled: false,
    tradeSenseConfig: defaultTradeSenseConfig,
    folderMonitoringEnabled: false,
    folderMonitoringTypes: [] as ('bt' | 'verint')[],
    folderMonitoringPaths: {} as { bt?: string; verint?: string },
    monitoringConfig: defaultMonitoringConfig
  });

  const handleCreate = () => {
    setIsCreating(true);
    setFormData({
      name: '',
      location: '',
      coordinates: { lat: 0, lng: 0 },
      healthScore: 100,
      status: 'green',
      btSystemEnabled: false,
      btSystemConfig: defaultBtConfig,
      tradeSenseEnabled: false,
      tradeSenseConfig: defaultTradeSenseConfig,
      folderMonitoringEnabled: false,
      folderMonitoringTypes: [] as ('bt' | 'verint')[],
      folderMonitoringPaths: {} as { bt?: string; verint?: string },
      monitoringConfig: defaultMonitoringConfig
    });
  };

  const handleEdit = (site: Site) => {
    setEditingSite(site);
    // Migrate legacy folderMonitoringSystemType to folderMonitoringTypes
    let types = site.folderMonitoringTypes ?? [];
    if (types.length === 0 && (site as Site & { folderMonitoringSystemType?: string }).folderMonitoringSystemType) {
      const legacy = (site as Site & { folderMonitoringSystemType: 'bt' | 'verint' }).folderMonitoringSystemType;
      types = [legacy];
    }
    setFormData({
      name: site.name,
      location: site.location,
      coordinates: site.coordinates,
      healthScore: site.healthScore,
      status: site.status,
      btSystemEnabled: site.btSystemEnabled ?? false,
      btSystemConfig: site.btSystemConfig ?? defaultBtConfig,
      tradeSenseEnabled: site.tradeSenseEnabled ?? false,
      tradeSenseConfig: (() => {
        const c = { ...defaultTradeSenseConfig, ...site.tradeSenseConfig };
        if ((site.tradeSenseConfig as { autoGetHealthApi?: boolean })?.autoGetHealthApi !== undefined) {
          c.autoGetHealthApiReport = (site.tradeSenseConfig as { autoGetHealthApi?: boolean }).autoGetHealthApi;
        }
        return c;
      })(),
      folderMonitoringEnabled: site.folderMonitoringEnabled ?? false,
      folderMonitoringTypes: types,
      folderMonitoringPaths: site.folderMonitoringPaths ?? {},
      monitoringConfig: site.monitoringConfig || defaultMonitoringConfig
    });
  };

  const handleSave = () => {
    const base = {
      ...formData,
      btSystemConfig: formData.btSystemEnabled ? formData.btSystemConfig : undefined,
      tradeSenseConfig: formData.tradeSenseEnabled ? formData.tradeSenseConfig : undefined,
      folderMonitoringTypes: formData.folderMonitoringEnabled ? formData.folderMonitoringTypes : undefined,
      folderMonitoringPaths: formData.folderMonitoringEnabled ? formData.folderMonitoringPaths : undefined,
      lastUpdate: new Date()
    };
    if (isCreating) {
      const newSite: Site = {
        ...base,
        id: `site_${Date.now()}`,
        alertCounts: { critical: 0, high: 0, medium: 0, low: 0 },
        healthHistory: [],
        acknowledgedAlerts: [],
        lastAcknowledgment: null
      } as Site;
      onSitesUpdate([...sites, newSite]);
    } else if (editingSite) {
      onSitesUpdate(sites.map(site =>
        site.id === editingSite.id ? { ...site, ...base } : site
      ));
    }
    setIsCreating(false);
    setEditingSite(null);
  };

  const toggleBtCommand = (cmd: BTSystemCommand) => {
    const current = formData.btSystemConfig.commands;
    const next = current.includes(cmd)
      ? current.filter((c) => c !== cmd)
      : [...current, cmd];
    setFormData({
      ...formData,
      btSystemConfig: { ...formData.btSystemConfig, commands: next }
    });
  };

  const handleDelete = (siteId: string) => {
    if (confirm('Are you sure you want to delete this site? This will stop all monitoring for this location.')) {
      onSitesUpdate(sites.filter(site => site.id !== siteId));
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingSite(null);
  };

  const handleFilePatternChange = (patterns: string) => {
    const patternArray = patterns.split(',').map(p => p.trim()).filter(p => p);
    setFormData({
      ...formData,
      monitoringConfig: {
        ...formData.monitoringConfig,
        filePatterns: patternArray
      }
    });
  };

  const handleExcludePatternChange = (patterns: string) => {
    const patternArray = patterns.split(',').map(p => p.trim()).filter(p => p);
    setFormData({
      ...formData,
      monitoringConfig: {
        ...formData.monitoringConfig,
        excludePatterns: patternArray
      }
    });
  };

  const isValidMonitoringPath = (path: string): boolean => {
    if (!path || path.trim() === '') return false;
    
    // Check for valid-looking paths
    const validPatterns = [
      /^\/var\/log/,           // Linux log directories
      /^\/opt\/.*\/logs/,      // Application log directories
      /^\/home\/.*\/logs/,     // User log directories
      /^C:\\.*\\[Ll]ogs/,      // Windows log directories
      /^\/usr\/local\/.*\/logs/, // Local application logs
    ];

    return validPatterns.some(pattern => pattern.test(path)) && 
           !path.includes('example') && 
           !path.includes('demo');
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Site Management</h3>
          <p className="text-sm text-slate-400 mt-1">Configure monitoring locations and real log folder paths</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add Site</span>
        </button>
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingSite) && (
        <div className="bg-slate-900 border border-slate-600 rounded-lg p-6 mb-6">
          <h4 className="text-white font-medium mb-4 flex items-center">
            <Settings className="h-5 w-5 mr-2 text-blue-400" />
            {isCreating ? 'Create New Site' : 'Edit Site'}
          </h4>
          
          {/* Basic Site Information */}
          <div className="mb-6">
            <h5 className="text-slate-300 font-medium mb-3">Basic Information</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Site Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                  placeholder="Enter site name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                  placeholder="City, State"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Latitude
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.coordinates.lat}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    coordinates: { ...formData.coordinates, lat: parseFloat(e.target.value) }
                  })}
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Longitude
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.coordinates.lng}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    coordinates: { ...formData.coordinates, lng: parseFloat(e.target.value) }
                  })}
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                />
              </div>
            </div>
          </div>

          {/* Integration Type - 3 options */}
          <div className="mb-6">
            <h5 className="text-slate-300 font-medium mb-3">Integration Options</h5>
            <p className="text-slate-500 text-sm mb-3">Select one or more monitoring types for this site.</p>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.btSystemEnabled}
                  onChange={(e) => setFormData({ ...formData, btSystemEnabled: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-600"
                />
                <Radio className="h-4 w-4 text-cyan-400" />
                BT System (WebSocket)
              </label>
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.folderMonitoringTypes.includes('bt')}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...formData.folderMonitoringTypes, 'bt']
                      : formData.folderMonitoringTypes.filter(t => t !== 'bt');
                    setFormData({
                      ...formData,
                      folderMonitoringEnabled: next.length > 0,
                      folderMonitoringTypes: next
                    });
                  }}
                  className="rounded bg-slate-800 border-slate-600"
                />
                <FolderOpen className="h-4 w-4 text-green-400" />
                Folder monitoring – BT
              </label>
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.folderMonitoringTypes.includes('verint')}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...formData.folderMonitoringTypes, 'verint']
                      : formData.folderMonitoringTypes.filter(t => t !== 'verint');
                    setFormData({
                      ...formData,
                      folderMonitoringEnabled: next.length > 0,
                      folderMonitoringTypes: next
                    });
                  }}
                  className="rounded bg-slate-800 border-slate-600"
                />
                <FolderOpen className="h-4 w-4 text-green-400" />
                Folder monitoring – Verint
              </label>
            </div>
          </div>

          {/* BT System Config */}
          {formData.btSystemEnabled && (
            <div className="mb-6 p-4 bg-slate-800/50 border border-slate-600 rounded-lg">
              <h5 className="text-cyan-400 font-medium mb-3">BT System Configuration</h5>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">WSS URL</label>
                  <input
                    type="url"
                    value={formData.btSystemConfig.url}
                    onChange={(e) => setFormData({
                      ...formData,
                      btSystemConfig: { ...formData.btSystemConfig, url: e.target.value }
                    })}
                    placeholder="wss://bt-system.example.com/ws"
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Token</label>
                  <input
                    type="password"
                    value={formData.btSystemConfig.token}
                    onChange={(e) => setFormData({
                      ...formData,
                      btSystemConfig: { ...formData.btSystemConfig, token: e.target.value }
                    })}
                    placeholder="API token"
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Commands to send</label>
                  <div className="flex flex-wrap gap-3">
                    {BT_COMMANDS.map(({ id, label }) => (
                      <label key={id} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.btSystemConfig.commands.includes(id)}
                          onChange={() => toggleBtCommand(id)}
                          className="rounded bg-slate-800 border-slate-600"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Frequency (seconds)</label>
                  <input
                    type="number"
                    value={formData.btSystemConfig.frequencySeconds}
                    onChange={(e) => setFormData({
                      ...formData,
                      btSystemConfig: { ...formData.btSystemConfig, frequencySeconds: Math.max(5, parseInt(e.target.value) || 30) }
                    })}
                    min={5}
                    max={3600}
                    className="w-32 bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">How often to send commands (min 5s)</p>
                </div>
              </div>
            </div>
          )}

          {/* TradeSense WBA API Config */}
          {formData.tradeSenseEnabled && (
            <div className="mb-6 p-4 bg-slate-800/50 border border-slate-600 rounded-lg">
              <h5 className="text-amber-400 font-medium mb-3">TradeSense WBA API Configuration</h5>
              <p className="text-slate-400 text-sm mb-4">
                Per-site WebSocket URL and token. Each site can connect to its own TradeSense instance.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">WebSocket URL</label>
                  <input
                    type="url"
                    value={formData.tradeSenseConfig.url}
                    onChange={(e) => setFormData({
                      ...formData,
                      tradeSenseConfig: { ...formData.tradeSenseConfig, url: e.target.value }
                    })}
                    placeholder="wss://TradeSenseFQDN/api"
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">API Token</label>
                  <input
                    type="password"
                    value={formData.tradeSenseConfig.token}
                    onChange={(e) => setFormData({
                      ...formData,
                      tradeSenseConfig: { ...formData.tradeSenseConfig, token: e.target.value }
                    })}
                    placeholder="Token from Assure admin"
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Auto-fetch on connect (TradeSense WBA 10.0.14 commands)</label>
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {TRADESENSE_AUTO_OPTIONS.map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.tradeSenseConfig[key as keyof typeof formData.tradeSenseConfig] ?? (key === 'autoReconnect' ? true : false)}
                          onChange={(e) => setFormData({
                            ...formData,
                            tradeSenseConfig: { ...formData.tradeSenseConfig, [key]: e.target.checked }
                          })}
                          className="rounded bg-slate-800 border-slate-600"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Folder Monitoring Config - separate path for each type */}
          {formData.folderMonitoringTypes?.length ? (
            <div className="mb-6 p-4 bg-slate-800/50 border border-slate-600 rounded-lg">
              <h5 className="text-green-400 font-medium mb-3">Folder Monitoring Configuration</h5>
              <p className="text-slate-400 text-sm mb-4">
                Enter folder path for each selected type. Verint and BT error codes are configured in the Error Code Imports tab.
              </p>
              <div className="space-y-4">
                {formData.folderMonitoringTypes.includes('bt') && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">BT log folder</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.folderMonitoringPaths?.bt ?? ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          folderMonitoringPaths: { ...formData.folderMonitoringPaths, bt: e.target.value }
                        })}
                        placeholder="C:\Logs\BT or /var/log/bt"
                        className="flex-1 bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const r = await selectFolder();
                          if (r.success && r.folderPath) {
                            setFormData({
                              ...formData,
                              folderMonitoringPaths: { ...formData.folderMonitoringPaths, bt: r.folderPath }
                            });
                          }
                        }}
                        className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm flex items-center gap-2"
                      >
                        <Folder className="h-4 w-4" />
                        Browse
                      </button>
                    </div>
                  </div>
                )}
                {formData.folderMonitoringTypes.includes('verint') && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Verint log folder</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.folderMonitoringPaths?.verint ?? ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          folderMonitoringPaths: { ...formData.folderMonitoringPaths, verint: e.target.value }
                        })}
                        placeholder="C:\Logs\Verint or /var/log/verint"
                        className="flex-1 bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const r = await selectFolder();
                          if (r.success && r.folderPath) {
                            setFormData({
                              ...formData,
                              folderMonitoringPaths: { ...formData.folderMonitoringPaths, verint: r.folderPath }
                            });
                          }
                        }}
                        className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm flex items-center gap-2"
                      >
                        <Folder className="h-4 w-4" />
                        Browse
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Monitoring Configuration (custom folder when not using Verint/BT folder monitoring) */}
          <div className="mb-6">
            <h5 className="text-slate-300 font-medium mb-3 flex items-center">
              <Folder className="h-4 w-4 mr-2 text-green-400" />
              {formData.folderMonitoringEnabled ? 'Additional custom folder (optional)' : 'Real Log File Monitoring Configuration'}
            </h5>
            {formData.folderMonitoringEnabled && (
              <p className="text-slate-500 text-sm mb-2">
                Optional extra folder path for this site (separate from BT/Verint paths above).
              </p>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Folder Path to Monitor
                </label>
                <input
                  type="text"
                  value={formData.monitoringConfig.folderPath}
                  onChange={(e) => setFormData({
                    ...formData,
                    monitoringConfig: { ...formData.monitoringConfig, folderPath: e.target.value }
                  })}
                  className={`w-full border text-white rounded-lg px-3 py-2 ${
                    formData.monitoringConfig.folderPath && !isValidMonitoringPath(formData.monitoringConfig.folderPath)
                      ? 'bg-red-900/20 border-red-500/50'
                      : 'bg-slate-800 border-slate-600'
                  }`}
                  placeholder="/var/log/myapp or C:\Logs\MyApp"
                />
                
                {formData.monitoringConfig.folderPath && !isValidMonitoringPath(formData.monitoringConfig.folderPath) && (
                  <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded flex items-start space-x-2">
                    <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="text-red-300 text-xs">
                      <p className="font-medium">Invalid monitoring path</p>
                      <p>Use real file system paths like "/var/log/app" or "C:\Logs\App". Avoid demo/example paths.</p>
                    </div>
                  </div>
                )}
                
                <div className="mt-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded">
                  <p className="text-blue-400 text-xs font-medium mb-1">💡 Valid Path Examples:</p>
                  <ul className="text-blue-300 text-xs space-y-1">
                    <li>• Linux: /var/log/nginx, /opt/myapp/logs, /home/user/app/logs</li>
                    <li>• Windows: C:\Logs\MyApp, D:\Applications\Logs</li>
                    <li>• Only sites with valid paths will generate real log entries</li>
                  </ul>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    File Patterns (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.monitoringConfig.filePatterns.join(', ')}
                    onChange={(e) => handleFilePatternChange(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                    placeholder="*.log, *.txt, app*.log"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    File patterns to monitor (supports wildcards)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Exclude Patterns (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.monitoringConfig.excludePatterns.join(', ')}
                    onChange={(e) => handleExcludePatternChange(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                    placeholder="*.tmp, *.bak, debug*"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    File patterns to exclude from monitoring
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Max File Size (MB)
                  </label>
                  <input
                    type="number"
                    value={formData.monitoringConfig.maxFileSize}
                    onChange={(e) => setFormData({
                      ...formData,
                      monitoringConfig: { ...formData.monitoringConfig, maxFileSize: parseInt(e.target.value) }
                    })}
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                    min="1"
                    max="1000"
                  />
                </div>

                <div className="flex items-center space-y-2">
                  <label className="flex items-center space-x-2 text-slate-300">
                    <input
                      type="checkbox"
                      checked={formData.monitoringConfig.recursive}
                      onChange={(e) => setFormData({
                        ...formData,
                        monitoringConfig: { ...formData.monitoringConfig, recursive: e.target.checked }
                      })}
                      className="rounded bg-slate-800 border-slate-600"
                    />
                    <span className="text-sm">Monitor Subfolders</span>
                  </label>
                  <p className="text-xs text-slate-400">
                    Recursively monitor all child folders
                  </p>
                </div>

                <div className="flex items-center space-y-2">
                  <label className="flex items-center space-x-2 text-slate-300">
                    <input
                      type="checkbox"
                      checked={formData.monitoringConfig.tailEnabled}
                      onChange={(e) => setFormData({
                        ...formData,
                        monitoringConfig: { ...formData.monitoringConfig, tailEnabled: e.target.checked }
                      })}
                      className="rounded bg-slate-800 border-slate-600"
                    />
                    <span className="text-sm">Enable Real-time Tail</span>
                  </label>
                  <p className="text-xs text-slate-400">
                    Live monitoring of new log lines
                  </p>
                </div>
              </div>

              <div className="flex items-center">
                <label className="flex items-center space-x-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.monitoringConfig.rotationHandling}
                    onChange={(e) => setFormData({
                      ...formData,
                      monitoringConfig: { ...formData.monitoringConfig, rotationHandling: e.target.checked }
                    })}
                    className="rounded bg-slate-800 border-slate-600"
                  />
                  <span className="text-sm">Handle Log Rotation</span>
                </label>
                <p className="text-xs text-slate-400 ml-6">
                  Automatically detect and handle rotated log files
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={handleSave}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <Save className="h-4 w-4" />
              <span>Save Site</span>
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

      {/* Sites List */}
      <div className="space-y-4">
        {sites.map(site => {
          const hasFolderMonitoring = site.folderMonitoringEnabled && site.folderMonitoringTypes?.length;
          const hasCustomPath = isValidMonitoringPath(site.monitoringConfig?.folderPath || '');
          const hasValidPath = hasFolderMonitoring || hasCustomPath;
          
          return (
            <div key={site.id} className="bg-slate-900 border border-slate-600 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4 flex-1">
                  <div className={`p-2 rounded-lg ${
                    site.status === 'green' ? 'bg-green-500/20 text-green-400' :
                    site.status === 'amber' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-white font-medium">{site.name}</h4>
                      <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${
                        site.status === 'green' ? 'bg-green-500/20 text-green-400' :
                        site.status === 'amber' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {site.status}
                      </span>
                      {site.btSystemEnabled && (
                        <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs">
                          BT System
                        </span>
                      )}
                      {site.folderMonitoringEnabled && site.folderMonitoringTypes?.length ? (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                          Folder ({site.folderMonitoringTypes.join(', ')})
                        </span>
                      ) : null}
                      {hasValidPath ? (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                          Monitoring Active
                        </span>
                      ) : !site.btSystemEnabled && !site.folderMonitoringEnabled ? (
                        <span className="px-2 py-1 bg-slate-700 text-slate-400 rounded text-xs">
                          No Monitoring
                        </span>
                      ) : null}
                    </div>
                    <p className="text-slate-400 text-sm mb-3">{site.location}</p>
                    
                    {/* Monitoring Info */}
                    {site.monitoringConfig && (
                      <div className={`p-3 rounded border mb-3 ${
                        hasValidPath ? 'bg-green-500/10 border-green-500/20' : 'bg-slate-800 border-slate-700'
                      }`}>
                        <div className="flex items-center space-x-2 mb-2">
                          <Folder className={`h-4 w-4 ${hasValidPath ? 'text-green-400' : 'text-slate-400'}`} />
                          <span className="text-sm font-medium text-slate-300">Monitoring Configuration</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-400">
                          <div>
                            <span className="text-slate-500">Paths:</span>
                            <span className={`ml-2 ${hasValidPath ? 'text-green-300' : 'text-slate-300'}`}>
                              {site.folderMonitoringEnabled && site.folderMonitoringTypes?.length
                                ? site.folderMonitoringTypes
                                    .map((t) => `${t}: ${site.folderMonitoringPaths?.[t] || '(global)'}`)
                                    .join(' • ')
                                : (site.monitoringConfig.folderPath || 'Not configured')}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">Patterns:</span>
                            <span className="text-white ml-2">{site.monitoringConfig.filePatterns?.join(', ') || '*.log'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Recursive:</span>
                            <span className={`ml-2 ${site.monitoringConfig.recursive ? 'text-green-400' : 'text-red-400'}`}>
                              {site.monitoringConfig.recursive ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">Real-time Tail:</span>
                            <span className={`ml-2 ${site.monitoringConfig.tailEnabled ? 'text-green-400' : 'text-red-400'}`}>
                              {site.monitoringConfig.tailEnabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                        </div>
                        
                        {!hasValidPath && site.monitoringConfig.folderPath && (
                          <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded flex items-start space-x-2">
                            <AlertCircle className="h-3 w-3 text-yellow-400 mt-0.5 flex-shrink-0" />
                            <p className="text-yellow-300 text-xs">
                              Invalid path - use real file system paths like "/var/log/app" to enable monitoring
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-500">
                      <span>Health: {site.healthScore}</span>
                      <span>Lat: {site.coordinates.lat}</span>
                      <span>Lng: {site.coordinates.lng}</span>
                      <span>Updated: {site.lastUpdate.toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEdit(site)}
                    className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(site.id)}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}