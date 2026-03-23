import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Site } from '../types';
import { MapPin, Activity, AlertTriangle, Globe, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

interface InteractiveMapProps {
  sites: Site[];
  selectedSite: string | null;
  onSiteSelect: (siteId: string | null) => void;
}

// Custom marker icons
const createCustomIcon = (status: string, healthScore: number, isSelected: boolean) => {
  const color = status === 'green' ? '#10b981' : status === 'amber' ? '#f59e0b' : '#ef4444';
  const size = isSelected ? 40 : 30;
  
  return L.divIcon({
    html: `
      <div class="relative">
        ${isSelected ? '<div class="absolute inset-0 bg-white rounded-full scale-150 animate-ping opacity-60"></div>' : ''}
        <div class="relative w-${size/4} h-${size/4} rounded-full border-2 border-white shadow-lg flex items-center justify-center" style="background-color: ${color}; width: ${size}px; height: ${size}px;">
          <div class="text-white font-bold text-xs">${healthScore}</div>
        </div>
        <div class="absolute -top-1 -right-1 bg-slate-900 text-white text-xs px-1 py-0.5 rounded-full border border-white font-bold">
          ${healthScore}
        </div>
      </div>
    `,
    className: 'custom-marker',
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
    popupAnchor: [0, -size/2]
  });
};

// Map controls component
function MapControls() {
  const map = useMap();
  
  const zoomIn = () => map.zoomIn();
  const zoomOut = () => map.zoomOut();
  const resetView = () => map.setView([20, 0], 2);
  
  return (
    <div className="absolute top-4 right-4 z-[1000] flex flex-col space-y-2">
      <button
        onClick={zoomIn}
        className="bg-slate-800/90 backdrop-blur-sm hover:bg-slate-700 text-white p-2 rounded-lg border border-slate-600 shadow-lg transition-colors"
        title="Zoom In"
      >
        <ZoomIn className="h-4 w-4" />
      </button>
      <button
        onClick={zoomOut}
        className="bg-slate-800/90 backdrop-blur-sm hover:bg-slate-700 text-white p-2 rounded-lg border border-slate-600 shadow-lg transition-colors"
        title="Zoom Out"
      >
        <ZoomOut className="h-4 w-4" />
      </button>
      <button
        onClick={resetView}
        className="bg-slate-800/90 backdrop-blur-sm hover:bg-slate-700 text-white p-2 rounded-lg border border-slate-600 shadow-lg transition-colors"
        title="Reset View"
      >
        <RotateCcw className="h-4 w-4" />
      </button>
    </div>
  );
}

export function InteractiveMap({ sites, selectedSite, onSiteSelect }: InteractiveMapProps) {
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    setMapLoaded(true);
  }, []);

  if (!mapLoaded) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-center h-96">
          <div className="flex items-center space-x-2 text-slate-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
            <span>Loading Interactive World Map...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-slate-700">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Globe className="h-5 w-5 text-blue-400 mr-2" />
          Interactive Global Site Map
          <span className="ml-2 px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
            {sites.length} SITES
          </span>
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Zoom, pan, and click markers • Real-time RAG status indicators • Full geographic accuracy
        </p>
      </div>
      
      <div className="relative h-96 bg-slate-900" style={{ height: '500px' }}>
        <MapContainer
          center={[20, 0]}
          zoom={2}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
          worldCopyJump={true}
          maxBounds={[[-90, -180], [90, 180]]}
          minZoom={1}
          maxZoom={18}
        >
          {/* Dark theme tile layer */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            subdomains="abcd"
          />
          
          {/* Site markers */}
          {sites.map((site) => (
            <Marker
              key={site.id}
              position={[site.coordinates.lat, site.coordinates.lng]}
              icon={createCustomIcon(site.status, site.healthScore, selectedSite === site.id)}
              eventHandlers={{
                click: () => onSiteSelect(selectedSite === site.id ? null : site.id)
              }}
            >
              <Popup className="custom-popup">
                <div className="bg-slate-800 text-white p-3 rounded-lg min-w-[200px]">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-blue-300">{site.name}</h4>
                    <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${
                      site.status === 'green' ? 'bg-green-500/20 text-green-400' :
                      site.status === 'amber' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {site.status}
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Location:</span>
                      <span className="text-white">{site.location}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Health Score:</span>
                      <span className={`font-bold ${
                        site.healthScore > 80 ? 'text-green-400' : 
                        site.healthScore > 50 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {site.healthScore}%
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Critical Alerts:</span>
                      <span className="text-red-400 font-bold">{site.alertCounts.critical}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">High Alerts:</span>
                      <span className="text-orange-400 font-bold">{site.alertCounts.high}</span>
                    </div>
                    
                    <div className="pt-2 border-t border-slate-600 text-xs text-slate-500">
                      <div>Coordinates: {site.coordinates.lat.toFixed(4)}°, {site.coordinates.lng.toFixed(4)}°</div>
                      <div>Last Update: {site.lastUpdate.toLocaleTimeString()}</div>
                    </div>
                    
                    {site.monitoringConfig?.folderPath && (
                      <div className="pt-2 border-t border-slate-600 text-xs">
                        <div className="text-slate-400">Monitoring:</div>
                        <div className="text-slate-300 truncate">{site.monitoringConfig.folderPath}</div>
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
          
          {/* Map controls */}
          <MapControls />
        </MapContainer>
        
        {/* Coordinate display for selected site */}
        {selectedSite && (
          <div className="absolute bottom-4 left-4 bg-slate-800/95 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-lg border border-slate-600 shadow-lg z-[1000]">
            <div className="font-medium text-blue-300">Selected Site</div>
            {(() => {
              const site = sites.find(s => s.id === selectedSite);
              return site ? (
                <div className="text-slate-300">
                  <div className="font-medium">{site.name}</div>
                  <div>{site.coordinates.lat.toFixed(4)}°N, {Math.abs(site.coordinates.lng).toFixed(4)}°{site.coordinates.lng >= 0 ? 'E' : 'W'}</div>
                </div>
              ) : '';
            })()}
          </div>
        )}

        {/* Map legend */}
        <div className="absolute top-4 left-4 bg-slate-800/95 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-lg border border-slate-600 shadow-lg z-[1000]">
          <div className="text-blue-300 font-medium mb-2">Map Legend</div>
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Healthy (80-100%)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span>Warning (50-79%)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>Critical (0-49%)</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Enhanced map statistics */}
      <div className="p-4 border-t border-slate-700 bg-slate-850">
        <div className="flex items-center justify-between text-sm mb-3">
          <div className="text-slate-400 font-medium">Global Monitoring Status:</div>
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-sm"></div>
              <span className="text-green-400 font-medium">Healthy ({sites.filter(s => s.status === 'green').length})</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-yellow-500 rounded-full shadow-sm"></div>
              <span className="text-yellow-400 font-medium">Warning ({sites.filter(s => s.status === 'amber').length})</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-red-500 rounded-full shadow-sm"></div>
              <span className="text-red-400 font-medium">Critical ({sites.filter(s => s.status === 'red').length})</span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-xs text-slate-500">
          <div className="flex items-center justify-between">
            <span className="flex items-center">🌍 Global Coverage:</span>
            <span className="text-white font-medium">{sites.length} locations</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center">🚨 Active Alerts:</span>
            <span className="text-red-400 font-medium">
              {sites.reduce((sum, site) => sum + site.alertCounts.critical + site.alertCounts.high, 0)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center">📊 Avg Health:</span>
            <span className="text-blue-400 font-medium">
              {Math.round(sites.reduce((sum, site) => sum + site.healthScore, 0) / sites.length)}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center">🔍 Zoom Level:</span>
            <span className="text-green-400 font-medium">Interactive</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center">⚡ Live Updates:</span>
            <span className="text-green-400 font-medium animate-pulse">Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}