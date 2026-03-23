import { LogEntry, ErrorCode, Asset } from '../types';

const VERINT_CODES_KEY = 'alarmCodesVerint';
const BT_CODES_KEY = 'alarmCodesBT';

export function enrichLogData(logs: LogEntry[]): LogEntry[] {
  // Return empty array if no logs provided
  if (!logs || logs.length === 0) {
    return [];
  }

  return logs.map(log => {
    const enrichedLog = { ...log };
    
    // Enrich with error code resolution and criticality (use type-specific codes when folderType is set)
    if (log.errorCode) {
      const errorCodes = getErrorCodesForLog(log);
      const errorInfo = errorCodes.find(ec => ec.code === log.errorCode);
      if (errorInfo) {
        enrichedLog.enrichedData = {
          ...enrichedLog.enrichedData,
          resolution: errorInfo.resolution
        };
        // Use alarm code criticality/severity when available (defines what the issue means)
        if (errorInfo.severity && ['low', 'medium', 'high', 'critical'].includes(errorInfo.severity)) {
          enrichedLog.level = errorInfo.severity as LogEntry['level'];
        }
      }
    }
    
    // Enrich with asset information
    if (log.mac || log.ip) {
      const assets = getAssets();
      const asset = assets.find(a => 
        (log.mac && a.macAddress === log.mac) || 
        (log.ip && a.ipAddress === log.ip)
      );
      
      if (asset) {
        enrichedLog.enrichedData = {
          ...enrichedLog.enrichedData,
          deviceName: asset.deviceName,
          location: `${asset.location} - Desk ${asset.deskNumber}`
        };
      }
    }
    
    return enrichedLog;
  });
}

function getErrorCodesForLog(log: LogEntry): ErrorCode[] {
  // When folderType is set, use the system-level Verint or BT error code imports
  if (log.folderType === 'verint') {
    try {
      const saved = localStorage.getItem(VERINT_CODES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }
  if (log.folderType === 'bt') {
    try {
      const saved = localStorage.getItem(BT_CODES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  // Non-folder logs: use alarm codes + error codes
  const allCodes: ErrorCode[] = [];
  try {
    const alarmSaved = localStorage.getItem('alarmCodes');
    if (alarmSaved) allCodes.push(...JSON.parse(alarmSaved));
    const errorSaved = localStorage.getItem('errorCodes');
    if (errorSaved) allCodes.push(...JSON.parse(errorSaved));
  } catch (error) {
    console.error('Error parsing alarm/error codes:', error);
  }
  return allCodes;
}

function getAssets(): Asset[] {
  const saved = localStorage.getItem('assets');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (error) {
      console.error('Error parsing assets:', error);
    }
  }
  
  // Return empty array if no assets configured
  return [];
}