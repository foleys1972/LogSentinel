import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, Server, Upload, Download, Search } from 'lucide-react';
import { Asset } from '../../types';

interface AssetManagerProps {
  onDataUpdate: () => void;
}

export function AssetManager({ onDataUpdate }: AssetManagerProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    macAddress: '',
    ipAddress: '',
    deviceName: '',
    location: '',
    deskNumber: '',
    assignedUser: '',
    siteId: '',
    deviceType: '',
    manufacturer: '',
    model: '',
    serialNumber: ''
  });

  useEffect(() => {
    // Load existing assets from localStorage
    const savedAssets = localStorage.getItem('assets');
    if (savedAssets) {
      try {
        setAssets(JSON.parse(savedAssets));
      } catch (error) {
        console.error('Error parsing saved assets:', error);
        setAssets([]);
      }
    } else {
      // Start with empty array - no default assets
      setAssets([]);
    }
  }, []);

  const saveAssets = (newAssets: Asset[]) => {
    setAssets(newAssets);
    localStorage.setItem('assets', JSON.stringify(newAssets));
    onDataUpdate();
  };

  const handleCreate = () => {
    setIsCreating(true);
    setFormData({
      macAddress: '',
      ipAddress: '',
      deviceName: '',
      location: '',
      deskNumber: '',
      assignedUser: '',
      siteId: '',
      deviceType: '',
      manufacturer: '',
      model: '',
      serialNumber: ''
    });
  };

  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setFormData({
      macAddress: asset.macAddress,
      ipAddress: asset.ipAddress,
      deviceName: asset.deviceName,
      location: asset.location,
      deskNumber: asset.deskNumber,
      assignedUser: asset.assignedUser,
      siteId: asset.siteId,
      deviceType: asset.deviceType,
      manufacturer: asset.manufacturer,
      model: asset.model,
      serialNumber: asset.serialNumber
    });
  };

  const handleSave = () => {
    if (isCreating) {
      const newAsset: Asset = {
        id: Date.now().toString(),
        ...formData
      };
      saveAssets([...assets, newAsset]);
    } else if (editingAsset) {
      const updatedAssets = assets.map(asset =>
        asset.id === editingAsset.id ? { ...asset, ...formData } : asset
      );
      saveAssets(updatedAssets);
    }
    
    setIsCreating(false);
    setEditingAsset(null);
  };

  const handleDelete = (assetId: string) => {
    if (confirm('Are you sure you want to delete this asset?')) {
      saveAssets(assets.filter(asset => asset.id !== assetId));
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingAsset(null);
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const csv = e.target?.result as string;
        const lines = csv.split('\n');
        
        const importedAssets: Asset[] = lines.slice(1)
          .filter(line => line.trim())
          .map((line, index) => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            return {
              id: (Date.now() + index).toString(),
              macAddress: values[0] || '',
              ipAddress: values[1] || '',
              deviceName: values[2] || '',
              location: values[3] || '',
              deskNumber: values[4] || '',
              assignedUser: values[5] || '',
              siteId: values[6] || '',
              deviceType: values[7] || '',
              manufacturer: values[8] || '',
              model: values[9] || '',
              serialNumber: values[10] || ''
            };
          });
        
        saveAssets([...assets, ...importedAssets]);
      };
      reader.readAsText(file);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'MAC Address', 'IP Address', 'Device Name', 'Location', 'Desk Number',
      'Assigned User', 'Site ID', 'Device Type', 'Manufacturer', 'Model', 'Serial Number'
    ];
    const csvContent = [
      headers.join(','),
      ...assets.map(asset => [
        asset.macAddress,
        asset.ipAddress,
        `"${asset.deviceName}"`,
        `"${asset.location}"`,
        asset.deskNumber,
        asset.assignedUser,
        asset.siteId,
        asset.deviceType,
        asset.manufacturer,
        asset.model,
        asset.serialNumber
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'assets.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredAssets = assets.filter(asset =>
    asset.deviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.macAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.ipAddress.includes(searchTerm) ||
    asset.assignedUser.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Asset Management</h3>
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 text-white rounded-lg"
            />
          </div>
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
            <span>Add Asset</span>
          </button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingAsset) && (
        <div className="bg-slate-900 border border-slate-600 rounded-lg p-6 mb-6">
          <h4 className="text-white font-medium mb-4">
            {isCreating ? 'Create New Asset' : 'Edit Asset'}
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                MAC Address
              </label>
              <input
                type="text"
                value={formData.macAddress}
                onChange={(e) => setFormData({ ...formData, macAddress: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                placeholder="00:1B:44:11:3A:B7"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                IP Address
              </label>
              <input
                type="text"
                value={formData.ipAddress}
                onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                placeholder="192.168.1.100"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Device Name
              </label>
              <input
                type="text"
                value={formData.deviceName}
                onChange={(e) => setFormData({ ...formData, deviceName: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                placeholder="DESK-001-PC"
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
                placeholder="Floor 1, Zone A"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Desk Number
              </label>
              <input
                type="text"
                value={formData.deskNumber}
                onChange={(e) => setFormData({ ...formData, deskNumber: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                placeholder="A-001"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Assigned User
              </label>
              <input
                type="text"
                value={formData.assignedUser}
                onChange={(e) => setFormData({ ...formData, assignedUser: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                placeholder="john.doe@company.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Site ID
              </label>
              <input
                type="text"
                value={formData.siteId}
                onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                placeholder="site_1"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Device Type
              </label>
              <select
                value={formData.deviceType}
                onChange={(e) => setFormData({ ...formData, deviceType: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
              >
                <option value="">Select Type</option>
                <option value="Desktop">Desktop</option>
                <option value="Laptop">Laptop</option>
                <option value="Server">Server</option>
                <option value="Printer">Printer</option>
                <option value="Switch">Switch</option>
                <option value="Router">Router</option>
                <option value="Phone">Phone</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Manufacturer
              </label>
              <input
                type="text"
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                placeholder="Dell, HP, Lenovo, etc."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Model
              </label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                placeholder="OptiPlex 7090"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Serial Number
              </label>
              <input
                type="text"
                value={formData.serialNumber}
                onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                placeholder="DL7090001"
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

      {/* Assets List */}
      {assets.length === 0 ? (
        <div className="text-center py-12">
          <Server className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Assets Configured</h3>
          <p className="text-slate-400 mb-4">Start by adding your first asset to enable log enrichment with device information.</p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add First Asset</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAssets.map(asset => (
            <div key={asset.id} className="bg-slate-900 border border-slate-600 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4 flex-1">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Server className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-white font-medium">{asset.deviceName}</h4>
                      <span className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">
                        {asset.deviceType}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-slate-400">MAC:</span>
                        <span className="text-white ml-2">{asset.macAddress}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">IP:</span>
                        <span className="text-white ml-2">{asset.ipAddress}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Location:</span>
                        <span className="text-white ml-2">{asset.location}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">User:</span>
                        <span className="text-white ml-2">{asset.assignedUser}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs text-slate-500 mt-2">
                      <span>Desk: {asset.deskNumber}</span>
                      <span>{asset.manufacturer} {asset.model}</span>
                      <span>S/N: {asset.serialNumber}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEdit(asset)}
                    className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(asset.id)}
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