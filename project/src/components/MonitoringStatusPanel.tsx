import React, { useState, useEffect } from 'react';
import { Activity, Folder, FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface MonitoringStatus {
  activeSites: number;
  monitoredPaths: Array<{
    siteName: string;
    path: string;
    fileCount: number;
  }>;
  totalFiles: number;
  isElectron: boolean;
  lastUpdate: Date;
}

export function MonitoringStatusPanel() {
  const [status, setStatus] = useState<MonitoringStatus>({
    activeSites: 0,
    monitoredPaths: [],
    totalFiles: 0,
    isElectron: false,
    lastUpdate: new Date()
  });

  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Check if we're in Electron environment
    const electronEnv = typeof window !== 'undefined' && !!window.require;
    setStatus(prev => ({ ...prev, isElectron: electronEnv }));

    if (electronEnv) {
      console.log('🔧 Setting up monitoring status tracking...');
      
      try {
        const { ipcRenderer } = window.require('electron');
        setIsConnected(true);

        // Listen for monitoring status updates
        ipcRenderer.on('monitoring-status', (event: any, statusUpdate: any) => {
          console.log('📊 Monitoring status update:', statusUpdate);
          updateMonitoringStatus();
        });

        // Initial status check
        updateMonitoringStatus();

        // Periodic status updates
        const interval = setInterval(updateMonitoringStatus, 10000); // Every 10 seconds

        return () => {
          clearInterval(interval);
          ipcRenderer.removeAllListeners('monitoring-status');
        };

      } catch (error) {
        console.error('❌ Failed to setup monitoring status:', error);
        setIsConnected(false);
      }
    }
  }, []);

  const updateMonitoringStatus = async () => {
    try {
      const { ipcRenderer } = window.require('electron');
      
      // Get monitoring statistics from Electron main process
      const stats = await ipcRenderer.invoke('get-monitoring-stats');
      
      setStatus(prev => ({
        ...prev,
        activeSites: stats?.activeSites || 0,
        monitoredPaths: stats?.monitoredPaths || [],
        totalFiles: stats?.totalFiles || 0,
        lastUpdate: new Date()
      }));

      console.log('📊 Updated monitoring status:', stats);

    } catch (error) {
      console.error('❌ Error updating monitoring status:', error);
    }
  };

  const getStatusColor = () => {
    if (!status.isElectron) return 'text-gray-400';
    if (!isConnected) return 'text-red-400';
    if (status.activeSites > 0) return 'text-green-400';
    return 'text-yellow-400';
  };

  const getStatusIcon = () => {
    if (!status.isElectron) return <AlertCircle className="h-4 w-4" />;
    if (!isConnected) return <AlertCircle className="h-4 w-4" />;
    if (status.activeSites > 0) return <CheckCircle className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
  };

  const getStatusText = () => {
    if (!status.isElectron) return 'Browser Mode - No File Access';
    if (!isConnected) return 'Electron IPC Not Connected';
    if (status.activeSites > 0) return `Monitoring ${status.activeSites} Site(s)`;
    return 'No Sites Being Monitored';
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Activity className="h-5 w-5 text-blue-400 mr-2" />
          File System Monitoring
        </h3>
        <div className={`flex items-center space-x-2 ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="text-sm font-medium">
            {getStatusText()}
          </span>
        </div>
      </div>

      {/* Environment Info */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-slate-700 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <Folder className="h-4 w-4 text-blue-400" />
            <span className="text-sm text-slate-300">Environment</span>
          </div>
          <p className="text-lg font-semibold text-white">
            {status.isElectron ? 'Electron' : 'Browser'}
          </p>
        </div>

        <div className="bg-slate-700 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <FileText className="h-4 w-4 text-green-400" />
            <span className="text-sm text-slate-300">Active Sites</span>
          </div>
          <p className="text-lg font-semibold text-white">
            {status.activeSites}
          </p>
        </div>
      </div>

      {/* Monitored Paths */}
      {status.monitoredPaths.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-300">Monitored Locations:</h4>
          {status.monitoredPaths.map((path, index) => (
            <div key={index} className="bg-slate-700 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{path.siteName}</p>
                  <p className="text-xs text-slate-400 truncate">{path.path}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-green-400">{path.fileCount} files</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No monitoring message */}
      {status.isElectron && status.activeSites === 0 && (
        <div className="text-center py-4">
          <Activity className="h-8 w-8 text-slate-500 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">
            No sites configured for monitoring
          </p>
          <p className="text-slate-500 text-xs">
            Add sites in Admin Panel to start monitoring
          </p>
        </div>
      )}

      {/* Last update */}
      <div className="flex items-center justify-center mt-4 pt-4 border-t border-slate-700">
        <Clock className="h-3 w-3 text-slate-500 mr-1" />
        <span className="text-xs text-slate-500">
          Last updated: {status.lastUpdate.toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}