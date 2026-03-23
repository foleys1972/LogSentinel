import React, { useRef, useEffect, useState } from 'react';
import { Site, LogEntry } from '../../types';
import { Network, Activity, Zap, AlertTriangle, X, Plus, Edit, Trash2, Save } from 'lucide-react';

interface NetworkTopology3DProps {
  sites: Site[];
  logs: LogEntry[];
  isOpen: boolean;
  onClose: () => void;
}

interface NetworkNode {
  id: string;
  name: string;
  type: 'site' | 'service' | 'database' | 'loadbalancer' | 'router' | 'switch' | 'firewall';
  position: { x: number; y: number; z: number };
  health: number;
  connections: string[];
  traffic: number;
  errors: number;
  isConfigured: boolean; // Whether this is a real configured component
}

interface NetworkConnection {
  from: string;
  to: string;
  strength: number;
  latency: number;
  errors: number;
  type: 'data' | 'api' | 'database' | 'monitoring';
}

interface NetworkComponent {
  id: string;
  name: string;
  type: 'service' | 'database' | 'loadbalancer' | 'router' | 'switch' | 'firewall';
  description: string;
  ipAddress?: string;
  location?: string;
}

export function NetworkTopology3D({ sites, logs, isOpen, onClose }: NetworkTopology3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [connections, setConnections] = useState<NetworkConnection[]>([]);
  const [networkComponents, setNetworkComponents] = useState<NetworkComponent[]>([]);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddingComponent, setIsAddingComponent] = useState(false);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  
  const [newComponent, setNewComponent] = useState({
    name: '',
    type: 'service' as NetworkComponent['type'],
    description: '',
    ipAddress: '',
    location: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadNetworkComponents();
      generateNetworkTopology();
    }
  }, [sites, logs, isOpen]);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        renderTopology(ctx);
      }
    }
  }, [nodes, connections, rotation, zoom, selectedNode, isOpen]);

  const loadNetworkComponents = () => {
    const saved = localStorage.getItem('networkComponents');
    if (saved) {
      try {
        setNetworkComponents(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading network components:', error);
        setNetworkComponents([]);
      }
    }
  };

  const saveNetworkComponents = (components: NetworkComponent[]) => {
    setNetworkComponents(components);
    localStorage.setItem('networkComponents', JSON.stringify(components));
  };

  const generateNetworkTopology = () => {
    const newNodes: NetworkNode[] = [];
    const newConnections: NetworkConnection[] = [];

    // Add configured sites as nodes
    sites.forEach((site, index) => {
      const angle = (index / sites.length) * 2 * Math.PI;
      const radius = 200;
      
      newNodes.push({
        id: site.id,
        name: site.name,
        type: 'site',
        position: {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          z: 0
        },
        health: site.healthScore,
        connections: [],
        traffic: Math.random() * 100,
        errors: logs.filter(log => log.siteId === site.id && ['critical', 'high'].includes(log.level)).length,
        isConfigured: true
      });
    });

    // Add configured network components
    networkComponents.forEach((component, index) => {
      const angle = (index / Math.max(networkComponents.length, 1)) * 2 * Math.PI;
      const radius = 100;
      const zOffset = getZOffsetForType(component.type);
      
      newNodes.push({
        id: component.id,
        name: component.name,
        type: component.type,
        position: {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          z: zOffset
        },
        health: Math.random() * 40 + 60,
        connections: [],
        traffic: Math.random() * 200,
        errors: Math.floor(Math.random() * 3),
        isConfigured: true
      });
    });

    // Generate connections between sites and components
    sites.forEach(site => {
      networkComponents.forEach(component => {
        // Create logical connections based on component type
        if (component.type === 'loadbalancer' || component.type === 'router') {
          newConnections.push({
            from: site.id,
            to: component.id,
            strength: Math.random() * 100,
            latency: Math.random() * 50 + 10,
            errors: Math.floor(Math.random() * 2),
            type: 'api'
          });
        } else if (component.type === 'database') {
          newConnections.push({
            from: site.id,
            to: component.id,
            strength: Math.random() * 80,
            latency: Math.random() * 30 + 5,
            errors: Math.floor(Math.random() * 2),
            type: 'database'
          });
        }
      });
    });

    // Generate inter-component connections
    networkComponents.forEach(comp1 => {
      networkComponents.forEach(comp2 => {
        if (comp1.id !== comp2.id && shouldConnect(comp1.type, comp2.type)) {
          newConnections.push({
            from: comp1.id,
            to: comp2.id,
            strength: Math.random() * 90 + 10,
            latency: Math.random() * 20 + 5,
            errors: Math.floor(Math.random() * 2),
            type: getConnectionType(comp1.type, comp2.type)
          });
        }
      });
    });

    setNodes(newNodes);
    setConnections(newConnections);
  };

  const getZOffsetForType = (type: string): number => {
    switch (type) {
      case 'loadbalancer': return 50;
      case 'database': return -50;
      case 'service': return 25;
      case 'router': return 75;
      case 'switch': return -25;
      case 'firewall': return 100;
      default: return 0;
    }
  };

  const shouldConnect = (type1: string, type2: string): boolean => {
    const connections = {
      'loadbalancer': ['service', 'database'],
      'router': ['switch', 'firewall'],
      'switch': ['service'],
      'firewall': ['service', 'database'],
      'service': ['database'],
      'database': []
    };
    
    return connections[type1]?.includes(type2) || false;
  };

  const getConnectionType = (type1: string, type2: string): 'data' | 'api' | 'database' | 'monitoring' => {
    if (type2 === 'database') return 'database';
    if (type1 === 'loadbalancer' || type2 === 'loadbalancer') return 'api';
    if (type1 === 'router' || type2 === 'router') return 'data';
    return 'monitoring';
  };

  const addNetworkComponent = () => {
    if (!newComponent.name.trim()) {
      alert('Please enter a component name');
      return;
    }

    const component: NetworkComponent = {
      id: `component_${Date.now()}`,
      name: newComponent.name.trim(),
      type: newComponent.type,
      description: newComponent.description.trim(),
      ipAddress: newComponent.ipAddress.trim(),
      location: newComponent.location.trim()
    };

    saveNetworkComponents([...networkComponents, component]);
    setNewComponent({
      name: '',
      type: 'service',
      description: '',
      ipAddress: '',
      location: ''
    });
    setIsAddingComponent(false);
    generateNetworkTopology();
  };

  const deleteNetworkComponent = (componentId: string) => {
    if (confirm('Are you sure you want to delete this network component?')) {
      const updatedComponents = networkComponents.filter(comp => comp.id !== componentId);
      saveNetworkComponents(updatedComponents);
      generateNetworkTopology();
    }
  };

  const project3D = (point: { x: number; y: number; z: number }) => {
    const { x, y, z } = point;
    
    // Apply rotation
    const cosX = Math.cos(rotation.x);
    const sinX = Math.sin(rotation.x);
    const cosY = Math.cos(rotation.y);
    const sinY = Math.sin(rotation.y);
    
    const rotatedY = y * cosX - z * sinX;
    const rotatedZ = y * sinX + z * cosX;
    const rotatedX = x * cosY + rotatedZ * sinY;
    const finalZ = -x * sinY + rotatedZ * cosY;
    
    // Perspective projection
    const perspective = 500;
    const scale = perspective / (perspective + finalZ) * zoom;
    
    return {
      x: rotatedX * scale,
      y: rotatedY * scale,
      z: finalZ
    };
  };

  const renderTopology = (ctx: CanvasRenderingContext2D) => {
    const canvas = ctx.canvas;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Sort nodes by z-depth for proper rendering order
    const sortedNodes = [...nodes].sort((a, b) => {
      const projA = project3D(a.position);
      const projB = project3D(b.position);
      return projB.z - projA.z;
    });
    
    // Render connections
    connections.forEach(connection => {
      const fromNode = nodes.find(n => n.id === connection.from);
      const toNode = nodes.find(n => n.id === connection.to);
      
      if (fromNode && toNode) {
        const fromProj = project3D(fromNode.position);
        const toProj = project3D(toNode.position);
        
        ctx.beginPath();
        ctx.moveTo(centerX + fromProj.x, centerY + fromProj.y);
        ctx.lineTo(centerX + toProj.x, centerY + toProj.y);
        
        // Connection color based on health and errors
        const health = Math.min(fromNode.health, toNode.health);
        const errorIntensity = Math.min(connection.errors / 5, 1);
        
        if (connection.errors > 0) {
          ctx.strokeStyle = `rgba(239, 68, 68, ${0.3 + errorIntensity * 0.7})`;
          ctx.lineWidth = 2 + errorIntensity * 2;
        } else if (health < 70) {
          ctx.strokeStyle = `rgba(251, 191, 36, ${0.3 + (100 - health) / 100 * 0.7})`;
          ctx.lineWidth = 1.5;
        } else {
          ctx.strokeStyle = `rgba(34, 197, 94, 0.4)`;
          ctx.lineWidth = 1;
        }
        
        ctx.stroke();
        
        // Animate data flow
        const time = Date.now() / 1000;
        const flowPosition = (time * 0.5) % 1;
        const flowX = fromProj.x + (toProj.x - fromProj.x) * flowPosition;
        const flowY = fromProj.y + (toProj.y - fromProj.y) * flowPosition;
        
        ctx.beginPath();
        ctx.arc(centerX + flowX, centerY + flowY, 2, 0, 2 * Math.PI);
        ctx.fillStyle = connection.type === 'monitoring' ? '#8b5cf6' : 
                       connection.type === 'database' ? '#06b6d4' : '#3b82f6';
        ctx.fill();
      }
    });
    
    // Render nodes
    sortedNodes.forEach(node => {
      const projected = project3D(node.position);
      const x = centerX + projected.x;
      const y = centerY + projected.y;
      
      // Node size based on traffic and type
      const baseSize = node.type === 'site' ? 12 : 16;
      const size = baseSize + (node.traffic / 100) * 8;
      
      // Node color based on health and type
      let color = getNodeColor(node.type, node.health);
      
      // Outer glow for selected node
      if (selectedNode?.id === node.id) {
        ctx.beginPath();
        ctx.arc(x, y, size + 8, 0, 2 * Math.PI);
        ctx.fillStyle = `${color}40`;
        ctx.fill();
      }
      
      // Main node
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      
      // Error indicator
      if (node.errors > 0) {
        ctx.beginPath();
        ctx.arc(x + size * 0.7, y - size * 0.7, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(node.errors.toString(), x + size * 0.7, y - size * 0.7 + 2);
      }
      
      // Node label
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.name, x, y + size + 15);
      
      // Health percentage for sites
      if (node.type === 'site') {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px sans-serif';
        ctx.fillText(`${node.health}%`, x, y + size + 28);
      }
    });
  };

  const getNodeColor = (type: string, health: number): string => {
    if (type === 'site') {
      return health > 80 ? '#22c55e' : health > 60 ? '#f59e0b' : '#ef4444';
    }
    
    const colors = {
      'database': '#06b6d4',
      'loadbalancer': '#8b5cf6',
      'service': '#3b82f6',
      'router': '#f59e0b',
      'switch': '#10b981',
      'firewall': '#ef4444'
    };
    
    return colors[type as keyof typeof colors] || '#64748b';
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const deltaX = e.clientX - lastMouse.x;
      const deltaY = e.clientY - lastMouse.y;
      
      setRotation(prev => ({
        x: prev.x + deltaY * 0.01,
        y: prev.y + deltaX * 0.01
      }));
      
      setLastMouse({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.5, Math.min(3, prev * delta)));
  };

  const handleNodeClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - canvas.width / 2;
    const mouseY = e.clientY - rect.top - canvas.height / 2;
    
    // Find clicked node
    for (const node of nodes) {
      const projected = project3D(node.position);
      const distance = Math.sqrt(
        Math.pow(mouseX - projected.x, 2) + Math.pow(mouseY - projected.y, 2)
      );
      
      const size = (node.type === 'site' ? 12 : 16) + (node.traffic / 100) * 8;
      if (distance <= size) {
        setSelectedNode(node);
        return;
      }
    }
    
    setSelectedNode(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-7xl w-full max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Network className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">3D Network Topology</h2>
                <p className="text-slate-400">Interactive visualization of your configured network architecture</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  isEditMode ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <Edit className="h-4 w-4 mr-2 inline" />
                {isEditMode ? 'Exit Edit' : 'Edit Mode'}
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-slate-400">
              <span className="font-medium">Controls:</span> Drag to rotate • Scroll to zoom • Click nodes for details
            </div>
            <div className="flex items-center space-x-2">
              {isEditMode && (
                <button
                  onClick={() => setIsAddingComponent(true)}
                  className="flex items-center space-x-2 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Component</span>
                </button>
              )}
              <button
                onClick={() => {
                  setRotation({ x: 0, y: 0 });
                  setZoom(1);
                }}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
              >
                Reset View
              </button>
            </div>
          </div>
        </div>

        <div className="flex h-[calc(95vh-140px)]">
          {/* 3D Visualization */}
          <div className="flex-1 relative">
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="w-full h-full bg-slate-900 cursor-grab active:cursor-grabbing"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              onClick={handleNodeClick}
            />
            
            {/* Legend */}
            <div className="absolute top-4 left-4 bg-slate-800/90 backdrop-blur-sm border border-slate-600 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3">Network Legend</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-slate-300">Healthy Sites</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-slate-300">Warning Sites</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-slate-300">Critical Sites</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-slate-300">Services</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-cyan-500 rounded-full"></div>
                  <span className="text-slate-300">Database</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                  <span className="text-slate-300">Load Balancer</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  <span className="text-slate-300">Router</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                  <span className="text-slate-300">Switch</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-slate-300">Firewall</span>
                </div>
              </div>
            </div>

            {/* Network Stats */}
            <div className="absolute top-4 right-4 bg-slate-800/90 backdrop-blur-sm border border-slate-600 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3">Network Stats</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Nodes:</span>
                  <span className="text-white">{nodes.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Sites:</span>
                  <span className="text-white">{sites.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Components:</span>
                  <span className="text-white">{networkComponents.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Connections:</span>
                  <span className="text-white">{connections.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Avg Latency:</span>
                  <span className="text-white">
                    {connections.length > 0 ? 
                      Math.round(connections.reduce((sum, c) => sum + c.latency, 0) / connections.length) : 0}ms
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Error Connections:</span>
                  <span className="text-red-400">
                    {connections.filter(c => c.errors > 0).length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Side Panel */}
          <div className="w-80 border-l border-slate-700 p-4 overflow-y-auto">
            {isEditMode ? (
              <div>
                <h3 className="text-white font-medium mb-4">Network Components</h3>
                
                {/* Add Component Form */}
                {isAddingComponent && (
                  <div className="bg-slate-900 border border-slate-600 rounded-lg p-4 mb-4">
                    <h4 className="text-white font-medium mb-3">Add Network Component</h4>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                        <input
                          type="text"
                          value={newComponent.name}
                          onChange={(e) => setNewComponent({ ...newComponent, name: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-600 text-white rounded px-3 py-2"
                          placeholder="Component name"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Type</label>
                        <select
                          value={newComponent.type}
                          onChange={(e) => setNewComponent({ ...newComponent, type: e.target.value as any })}
                          className="w-full bg-slate-800 border border-slate-600 text-white rounded px-3 py-2"
                        >
                          <option value="service">Service</option>
                          <option value="database">Database</option>
                          <option value="loadbalancer">Load Balancer</option>
                          <option value="router">Router</option>
                          <option value="switch">Switch</option>
                          <option value="firewall">Firewall</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">IP Address</label>
                        <input
                          type="text"
                          value={newComponent.ipAddress}
                          onChange={(e) => setNewComponent({ ...newComponent, ipAddress: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-600 text-white rounded px-3 py-2"
                          placeholder="192.168.1.100"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                        <textarea
                          value={newComponent.description}
                          onChange={(e) => setNewComponent({ ...newComponent, description: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-600 text-white rounded px-3 py-2 h-20"
                          placeholder="Component description"
                        />
                      </div>
                    </div>
                    
                    <div className="flex space-x-2 mt-4">
                      <button
                        onClick={addNetworkComponent}
                        className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                      >
                        <Save className="h-4 w-4 mr-2 inline" />
                        Save
                      </button>
                      <button
                        onClick={() => setIsAddingComponent(false)}
                        className="flex-1 px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Components List */}
                <div className="space-y-2">
                  {networkComponents.map(component => (
                    <div key={component.id} className="bg-slate-900 border border-slate-600 rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-white font-medium">{component.name}</h4>
                          <p className="text-slate-400 text-sm capitalize">{component.type}</p>
                          {component.ipAddress && (
                            <p className="text-slate-500 text-xs">{component.ipAddress}</p>
                          )}
                        </div>
                        <button
                          onClick={() => deleteNetworkComponent(component.id)}
                          className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {networkComponents.length === 0 && (
                    <div className="text-center py-8">
                      <Network className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm">No network components configured</p>
                      <p className="text-slate-500 text-xs">Add components to build your network topology</p>
                    </div>
                  )}
                </div>
              </div>
            ) : selectedNode ? (
              <div>
                <h3 className="text-white font-medium mb-4">Node Details</h3>
                
                <div className="bg-slate-900 border border-slate-600 rounded-lg p-4">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className={`p-2 rounded-lg`} style={{ backgroundColor: getNodeColor(selectedNode.type, selectedNode.health) + '40' }}>
                      {selectedNode.type === 'site' ? <Activity className="h-5 w-5\" style={{ color: getNodeColor(selectedNode.type, selectedNode.health) }} /> :
                       selectedNode.type === 'database' ? <Network className="h-5 w-5" style={{ color: getNodeColor(selectedNode.type, selectedNode.health) }} /> :
                       <Zap className="h-5 w-5" style={{ color: getNodeColor(selectedNode.type, selectedNode.health) }} />}
                    </div>
                    <div>
                      <h4 className="text-white font-medium">{selectedNode.name}</h4>
                      <p className="text-slate-400 text-sm capitalize">{selectedNode.type}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Health Score:</span>
                      <span className={`font-medium ${
                        selectedNode.health > 80 ? 'text-green-400' :
                        selectedNode.health > 60 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {selectedNode.health.toFixed(1)}%
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-slate-400">Traffic Load:</span>
                      <span className="text-white">{Math.round(selectedNode.traffic)}%</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-slate-400">Active Errors:</span>
                      <span className={selectedNode.errors > 0 ? 'text-red-400' : 'text-green-400'}>
                        {selectedNode.errors}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-slate-400">Connections:</span>
                      <span className="text-white">
                        {connections.filter(c => c.from === selectedNode.id || c.to === selectedNode.id).length}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-slate-400">Type:</span>
                      <span className="text-white capitalize">{selectedNode.type}</span>
                    </div>
                  </div>
                  
                  {selectedNode.errors > 0 && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded">
                      <div className="flex items-center space-x-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                        <span className="text-red-400 font-medium">Active Issues</span>
                      </div>
                      <p className="text-red-300 text-sm">
                        This node has {selectedNode.errors} active error{selectedNode.errors !== 1 ? 's' : ''} 
                        that require attention.
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Connected Nodes */}
                <div className="mt-4">
                  <h4 className="text-white font-medium mb-3">Connected Nodes</h4>
                  <div className="space-y-2">
                    {connections
                      .filter(c => c.from === selectedNode.id || c.to === selectedNode.id)
                      .map((connection, index) => {
                        const connectedNodeId = connection.from === selectedNode.id ? connection.to : connection.from;
                        const connectedNode = nodes.find(n => n.id === connectedNodeId);
                        
                        if (!connectedNode) return null;
                        
                        return (
                          <div key={index} className="bg-slate-900 border border-slate-600 rounded p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-white text-sm">{connectedNode.name}</span>
                              <span className="text-slate-400 text-xs capitalize">{connection.type}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Latency: {connection.latency.toFixed(1)}ms</span>
                              {connection.errors > 0 && (
                                <span className="text-red-400">{connection.errors} errors</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Network className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <h4 className="text-white font-medium mb-2">Network Topology</h4>
                <p className="text-slate-400 text-sm mb-4">
                  {networkComponents.length === 0 
                    ? "No network components configured. Use Edit Mode to add components to your network architecture."
                    : "Click on any node to view detailed information about that component."
                  }
                </p>
                {networkComponents.length === 0 && (
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    Configure Network
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}