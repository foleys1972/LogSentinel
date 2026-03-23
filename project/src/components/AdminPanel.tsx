import React, { useState } from 'react';
import { 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  MapPin, 
  AlertTriangle,
  Server,
  Database,
  Upload,
  Download
} from 'lucide-react';
import { Site, ErrorCode, Asset, SystemComponent } from '../types';
import { SiteManager } from './admin/SiteManager';
import { ErrorCodeManager } from './admin/ErrorCodeManager';
import { AlarmCodesManager } from './admin/AlarmCodesManager';
import { ErrorCodeImportsConfig } from './admin/ErrorCodeImportsConfig';
import { AssetManager } from './admin/AssetManager';
import { CriticalityManager } from './admin/CriticalityManager';
import { SNMPTrapConfig } from './admin/SNMPTrapConfig';
import { LLMConfig } from './admin/LLMConfig';
import { UserManager } from './admin/UserManager';
import { AuthConfig } from './admin/AuthConfig';
import { BookOpen, FolderOpen, Radio, Sparkles, Users, Shield } from 'lucide-react';

interface AdminPanelProps {
  sites: Site[];
  onSitesUpdate: (sites: Site[]) => void;
  onDataUpdate: () => void;
}

export function AdminPanel({ sites, onSitesUpdate, onDataUpdate }: AdminPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'sites' | 'errors' | 'alarmcodes' | 'errorcodeimports' | 'assets' | 'criticality' | 'snmp' | 'llm'>('sites');

  const tabs = [
    { id: 'sites' as const, label: 'Sites', icon: MapPin, color: 'text-blue-400' },
    { id: 'errors' as const, label: 'Error Codes', icon: AlertTriangle, color: 'text-red-400' },
    { id: 'alarmcodes' as const, label: 'Alarm Codes', icon: BookOpen, color: 'text-amber-400' },
    { id: 'errorcodeimports' as const, label: 'Error Code Imports', icon: FolderOpen, color: 'text-cyan-400' },
    { id: 'assets' as const, label: 'Assets', icon: Server, color: 'text-green-400' },
    { id: 'criticality' as const, label: 'Criticality Rules', icon: Database, color: 'text-purple-400' },
    { id: 'snmp' as const, label: 'SNMP Traps', icon: Radio, color: 'text-orange-400' },
    { id: 'llm' as const, label: 'AI / LLM', icon: Sparkles, color: 'text-amber-400' },
    { id: 'users' as const, label: 'Users', icon: Users, color: 'text-blue-400' },
    { id: 'auth' as const, label: 'Access & Acknowledgment', icon: Shield, color: 'text-green-400' }
  ];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-all duration-200 hover:scale-110 z-40"
      >
        <Settings className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Settings className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">System Administration</h2>
                <p className="text-slate-400">Manage sites, error codes, assets, and criticality rules</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-700">
          <div className="flex space-x-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-6 py-4 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-400 bg-slate-750 text-white'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-750'
                }`}
              >
                <tab.icon className={`h-4 w-4 ${tab.color}`} />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'sites' && (
            <SiteManager sites={sites} onSitesUpdate={onSitesUpdate} />
          )}
          {activeTab === 'errors' && (
            <ErrorCodeManager onDataUpdate={onDataUpdate} />
          )}
          {activeTab === 'alarmcodes' && (
            <AlarmCodesManager onDataUpdate={onDataUpdate} />
          )}
          {activeTab === 'errorcodeimports' && (
            <ErrorCodeImportsConfig onDataUpdate={onDataUpdate} />
          )}
          {activeTab === 'assets' && (
            <AssetManager onDataUpdate={onDataUpdate} />
          )}
          {activeTab === 'criticality' && (
            <CriticalityManager onDataUpdate={onDataUpdate} />
          )}
          {activeTab === 'snmp' && (
            <SNMPTrapConfig onDataUpdate={onDataUpdate} />
          )}
          {activeTab === 'llm' && (
            <LLMConfig onDataUpdate={onDataUpdate} />
          )}
          {activeTab === 'users' && (
            <UserManager onDataUpdate={onDataUpdate} />
          )}
          {activeTab === 'auth' && (
            <AuthConfig onDataUpdate={onDataUpdate} />
          )}
        </div>
      </div>
    </div>
  );
}