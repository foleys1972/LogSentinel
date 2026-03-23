import React, { useState, useEffect } from 'react';
import { Brain, FileText, Zap, CheckCircle, AlertCircle, X, Settings } from 'lucide-react';
import { LogEntry } from '../../types';

interface IntelligentLogParserProps {
  logs: LogEntry[];
  isOpen: boolean;
  onClose: () => void;
}

interface LogPattern {
  id: string;
  name: string;
  pattern: string;
  fields: string[];
  confidence: number;
  samples: number;
  lastSeen: Date;
  enabled: boolean;
}

interface ParsedField {
  name: string;
  value: string;
  type: 'string' | 'number' | 'date' | 'ip' | 'email' | 'url';
  confidence: number;
}

interface ParsingResult {
  logId: string;
  originalMessage: string;
  parsedFields: ParsedField[];
  patternUsed: string;
  confidence: number;
  processingTime: number;
}

export function IntelligentLogParser({ logs, isOpen, onClose }: IntelligentLogParserProps) {
  const [detectedPatterns, setDetectedPatterns] = useState<LogPattern[]>([]);
  const [parsingResults, setParsingResults] = useState<ParsingResult[]>([]);
  const [isLearning, setIsLearning] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<LogPattern | null>(null);
  const [customPattern, setCustomPattern] = useState('');
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadSavedPatterns();
      runPatternDetection();
    }
  }, [isOpen, logs]);

  const loadSavedPatterns = () => {
    const saved = localStorage.getItem('logPatterns');
    if (saved) {
      try {
        const patterns = JSON.parse(saved).map((p: any) => ({
          ...p,
          lastSeen: new Date(p.lastSeen)
        }));
        setDetectedPatterns(patterns);
      } catch (error) {
        console.error('Error loading patterns:', error);
      }
    }
  };

  const savePatterns = (patterns: LogPattern[]) => {
    setDetectedPatterns(patterns);
    localStorage.setItem('logPatterns', JSON.stringify(patterns));
  };

  const runPatternDetection = async () => {
    setIsLearning(true);
    
    // Simulate ML pattern detection
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const newPatterns = detectLogPatterns(logs);
    const results = parseLogsWithPatterns(logs.slice(0, 20), newPatterns);
    
    setDetectedPatterns(newPatterns);
    setParsingResults(results);
    setIsLearning(false);
  };

  const detectLogPatterns = (logs: LogEntry[]): LogPattern[] => {
    const patterns: LogPattern[] = [];
    
    // Common log patterns
    const commonPatterns = [
      {
        name: 'Apache Access Log',
        pattern: '^(\\S+) \\S+ \\S+ \\[([^\\]]+)\\] "(\\w+) ([^"]*)" (\\d+) (\\d+|-)',
        fields: ['ip', 'timestamp', 'method', 'url', 'status', 'size'],
        samples: 0
      },
      {
        name: 'Nginx Error Log',
        pattern: '^(\\d{4}/\\d{2}/\\d{2} \\d{2}:\\d{2}:\\d{2}) \\[(\\w+)\\] (\\d+)#(\\d+): (.+)',
        fields: ['timestamp', 'level', 'pid', 'tid', 'message'],
        samples: 0
      },
      {
        name: 'Java Application Log',
        pattern: '^(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}),\\d+ (\\w+) \\[([^\\]]+)\\] ([^:]+): (.+)',
        fields: ['timestamp', 'level', 'thread', 'logger', 'message'],
        samples: 0
      },
      {
        name: 'System Log',
        pattern: '^(\\w{3} \\d{2} \\d{2}:\\d{2}:\\d{2}) (\\S+) ([^:]+): (.+)',
        fields: ['timestamp', 'hostname', 'process', 'message'],
        samples: 0
      },
      {
        name: 'Database Log',
        pattern: '^(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d+Z) \\[(\\w+)\\] (.+)',
        fields: ['timestamp', 'level', 'message'],
        samples: 0
      }
    ];

    // Test patterns against logs
    logs.forEach(log => {
      commonPatterns.forEach(pattern => {
        try {
          const regex = new RegExp(pattern.pattern);
          if (regex.test(log.message)) {
            pattern.samples++;
          }
        } catch (error) {
          // Invalid regex
        }
      });
    });

    // Convert to LogPattern objects
    commonPatterns.forEach((pattern, index) => {
      if (pattern.samples > 0) {
        patterns.push({
          id: `pattern_${index}`,
          name: pattern.name,
          pattern: pattern.pattern,
          fields: pattern.fields,
          confidence: Math.min(95, (pattern.samples / logs.length) * 100 + 50),
          samples: pattern.samples,
          lastSeen: new Date(),
          enabled: true
        });
      }
    });

    return patterns.sort((a, b) => b.samples - a.samples);
  };

  const parseLogsWithPatterns = (logs: LogEntry[], patterns: LogPattern[]): ParsingResult[] => {
    const results: ParsingResult[] = [];
    
    logs.forEach(log => {
      for (const pattern of patterns.filter(p => p.enabled)) {
        try {
          const regex = new RegExp(pattern.pattern);
          const match = log.message.match(regex);
          
          if (match) {
            const parsedFields: ParsedField[] = [];
            
            pattern.fields.forEach((fieldName, index) => {
              if (match[index + 1]) {
                parsedFields.push({
                  name: fieldName,
                  value: match[index + 1],
                  type: detectFieldType(match[index + 1]),
                  confidence: pattern.confidence
                });
              }
            });
            
            results.push({
              logId: log.id,
              originalMessage: log.message,
              parsedFields,
              patternUsed: pattern.name,
              confidence: pattern.confidence,
              processingTime: Math.random() * 5 + 1 // 1-6ms
            });
            
            break; // Use first matching pattern
          }
        } catch (error) {
          // Invalid regex
        }
      }
    });
    
    return results;
  };

  const detectFieldType = (value: string): 'string' | 'number' | 'date' | 'ip' | 'email' | 'url' => {
    // IP address
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value)) {
      return 'ip';
    }
    
    // Email
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'email';
    }
    
    // URL
    if (/^https?:\/\//.test(value)) {
      return 'url';
    }
    
    // Number
    if (/^\d+(\.\d+)?$/.test(value)) {
      return 'number';
    }
    
    // Date/timestamp
    if (/\d{4}[-/]\d{2}[-/]\d{2}/.test(value) || /\d{2}:\d{2}:\d{2}/.test(value)) {
      return 'date';
    }
    
    return 'string';
  };

  const testCustomPattern = () => {
    if (!customPattern || !testMessage) return;
    
    try {
      const regex = new RegExp(customPattern);
      const match = testMessage.match(regex);
      
      if (match) {
        alert(`Pattern matched! Captured groups: ${match.slice(1).join(', ')}`);
      } else {
        alert('Pattern did not match the test message');
      }
    } catch (error) {
      alert(`Invalid regex pattern: ${error.message}`);
    }
  };

  const addCustomPattern = () => {
    if (!customPattern) return;
    
    const fieldNames = prompt('Enter field names (comma-separated):');
    if (!fieldNames) return;
    
    const newPattern: LogPattern = {
      id: `custom_${Date.now()}`,
      name: `Custom Pattern ${detectedPatterns.length + 1}`,
      pattern: customPattern,
      fields: fieldNames.split(',').map(f => f.trim()),
      confidence: 90,
      samples: 0,
      lastSeen: new Date(),
      enabled: true
    };
    
    savePatterns([...detectedPatterns, newPattern]);
    setCustomPattern('');
  };

  const togglePattern = (patternId: string) => {
    const updatedPatterns = detectedPatterns.map(p => 
      p.id === patternId ? { ...p, enabled: !p.enabled } : p
    );
    savePatterns(updatedPatterns);
  };

  const deletePattern = (patternId: string) => {
    if (confirm('Delete this pattern?')) {
      savePatterns(detectedPatterns.filter(p => p.id !== patternId));
    }
  };

  const getFieldTypeColor = (type: string) => {
    switch (type) {
      case 'ip': return 'text-blue-400 bg-blue-500/10';
      case 'email': return 'text-green-400 bg-green-500/10';
      case 'url': return 'text-purple-400 bg-purple-500/10';
      case 'number': return 'text-orange-400 bg-orange-500/10';
      case 'date': return 'text-cyan-400 bg-cyan-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
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
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Brain className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Intelligent Log Parser</h2>
                <p className="text-slate-400">AI-powered automatic log format detection and parsing</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={runPatternDetection}
                disabled={isLearning}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded-lg transition-colors"
              >
                <Zap className={`h-4 w-4 ${isLearning ? 'animate-spin' : ''}`} />
                <span>{isLearning ? 'Learning...' : 'Detect Patterns'}</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex h-[calc(95vh-140px)]">
          {/* Detected Patterns */}
          <div className="w-1/3 border-r border-slate-700 p-4 overflow-y-auto">
            <h3 className="text-white font-medium mb-4">Detected Patterns</h3>
            
            {isLearning ? (
              <div className="text-center py-12">
                <Brain className="h-12 w-12 text-green-400 mx-auto mb-4 animate-pulse" />
                <p className="text-slate-400">Analyzing log formats...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {detectedPatterns.map(pattern => (
                  <div key={pattern.id} className="bg-slate-900 border border-slate-600 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="text-white font-medium text-sm">{pattern.name}</h4>
                        <p className="text-slate-400 text-xs mt-1">
                          {pattern.samples} samples • {pattern.confidence.toFixed(1)}% confidence
                        </p>
                      </div>
                      
                      <label className="relative inline-flex items-center cursor-pointer ml-2">
                        <input
                          type="checkbox"
                          checked={pattern.enabled}
                          onChange={() => togglePattern(pattern.id)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                      </label>
                    </div>
                    
                    <div className="mb-2">
                      <div className="text-slate-400 text-xs mb-1">Fields:</div>
                      <div className="flex flex-wrap gap-1">
                        {pattern.fields.map((field, index) => (
                          <span key={index} className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedPattern(pattern)}
                        className="flex-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors"
                      >
                        View Details
                      </button>
                      {pattern.id.startsWith('custom_') && (
                        <button
                          onClick={() => deletePattern(pattern.id)}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Add Custom Pattern */}
                <div className="bg-slate-900 border border-slate-600 rounded-lg p-3">
                  <h4 className="text-white font-medium text-sm mb-3">Add Custom Pattern</h4>
                  
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={customPattern}
                      onChange={(e) => setCustomPattern(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-600 text-white rounded px-2 py-1 text-xs font-mono"
                      placeholder="Enter regex pattern"
                    />
                    
                    <input
                      type="text"
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-600 text-white rounded px-2 py-1 text-xs"
                      placeholder="Test message"
                    />
                    
                    <div className="flex space-x-1">
                      <button
                        onClick={testCustomPattern}
                        className="flex-1 px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-xs transition-colors"
                      >
                        Test
                      </button>
                      <button
                        onClick={addCustomPattern}
                        disabled={!customPattern}
                        className="flex-1 px-2 py-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded text-xs transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pattern Details */}
          <div className="w-1/3 border-r border-slate-700 p-4 overflow-y-auto">
            <h3 className="text-white font-medium mb-4">Pattern Details</h3>
            
            {selectedPattern ? (
              <div className="space-y-4">
                <div className="bg-slate-900 border border-slate-600 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-3">{selectedPattern.name}</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="text-slate-400 text-sm mb-1">Regex Pattern:</div>
                      <code className="text-green-400 text-xs font-mono bg-slate-800 p-2 rounded block break-all">
                        {selectedPattern.pattern}
                      </code>
                    </div>
                    
                    <div>
                      <div className="text-slate-400 text-sm mb-1">Extracted Fields:</div>
                      <div className="space-y-1">
                        {selectedPattern.fields.map((field, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <span className="text-white text-sm">{field}</span>
                            <span className="text-slate-400 text-xs">Group {index + 1}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-slate-400">Confidence:</div>
                        <div className="text-white font-medium">{selectedPattern.confidence.toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Samples:</div>
                        <div className="text-white font-medium">{selectedPattern.samples}</div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-slate-400 text-sm">Status:</div>
                      <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs ${
                        selectedPattern.enabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {selectedPattern.enabled ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                        <span>{selectedPattern.enabled ? 'Active' : 'Disabled'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Settings className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-400">Select a pattern to view details</p>
              </div>
            )}
          </div>

          {/* Parsing Results */}
          <div className="w-1/3 p-4 overflow-y-auto">
            <h3 className="text-white font-medium mb-4">Parsing Results</h3>
            
            {parsingResults.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-400">No parsing results yet</p>
                <p className="text-slate-500 text-sm mt-1">Run pattern detection to see results</p>
              </div>
            ) : (
              <div className="space-y-3">
                {parsingResults.map((result, index) => (
                  <div key={index} className="bg-slate-900 border border-slate-600 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-blue-400 text-xs font-medium">{result.patternUsed}</span>
                      <span className="text-slate-400 text-xs">
                        {result.confidence.toFixed(1)}% • {result.processingTime.toFixed(1)}ms
                      </span>
                    </div>
                    
                    <div className="mb-3">
                      <div className="text-slate-400 text-xs mb-1">Original:</div>
                      <div className="text-white text-xs bg-slate-800 p-2 rounded font-mono break-all">
                        {result.originalMessage}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-slate-400 text-xs mb-1">Parsed Fields:</div>
                      <div className="space-y-1">
                        {result.parsedFields.map((field, fieldIndex) => (
                          <div key={fieldIndex} className="flex items-center justify-between">
                            <span className="text-slate-300 text-xs">{field.name}:</span>
                            <div className="flex items-center space-x-1">
                              <span className="text-white text-xs font-mono">{field.value}</span>
                              <span className={`px-1 py-0.5 rounded text-xs ${getFieldTypeColor(field.type)}`}>
                                {field.type}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}