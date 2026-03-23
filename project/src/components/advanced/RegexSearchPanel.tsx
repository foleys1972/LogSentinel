import React, { useState, useEffect } from 'react';
import { Search, Filter, Save, Clock, AlertCircle, CheckCircle, X } from 'lucide-react';
import { LogEntry, MLAnomaly } from '../../types';
import { format } from 'date-fns';

interface RegexSearchPanelProps {
  logs: LogEntry[];
  anomalies: MLAnomaly[];
  isOpen: boolean;
  onClose: () => void;
}

interface SearchQuery {
  id: string;
  name: string;
  pattern: string;
  flags: string;
  description: string;
  createdAt: Date;
  lastUsed?: Date;
}

interface SearchResult {
  type: 'log' | 'anomaly';
  item: LogEntry | MLAnomaly;
  matches: Array<{
    text: string;
    start: number;
    end: number;
  }>;
}

export function RegexSearchPanel({ logs, anomalies, isOpen, onClose }: RegexSearchPanelProps) {
  const [searchPattern, setSearchPattern] = useState('');
  const [searchFlags, setSearchFlags] = useState('gi');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [savedQueries, setSavedQueries] = useState<SearchQuery[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [queryName, setQueryName] = useState('');
  const [queryDescription, setQueryDescription] = useState('');

  useEffect(() => {
    // Load saved queries
    const saved = localStorage.getItem('regexQueries');
    if (saved) {
      try {
        const queries = JSON.parse(saved).map((q: any) => ({
          ...q,
          createdAt: new Date(q.createdAt),
          lastUsed: q.lastUsed ? new Date(q.lastUsed) : undefined
        }));
        setSavedQueries(queries);
      } catch (error) {
        console.error('Error loading saved queries:', error);
      }
    }
  }, []);

  const saveQueries = (queries: SearchQuery[]) => {
    setSavedQueries(queries);
    localStorage.setItem('regexQueries', JSON.stringify(queries));
  };

  const performSearch = async () => {
    if (!searchPattern.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setResults([]);

    try {
      const regex = new RegExp(searchPattern, searchFlags);
      const searchResults: SearchResult[] = [];

      // Search logs
      logs.forEach(log => {
        const searchText = `${log.message} ${log.source} ${log.errorCode || ''}`;
        const matches = [];
        let match;

        while ((match = regex.exec(searchText)) !== null) {
          matches.push({
            text: match[0],
            start: match.index,
            end: match.index + match[0].length
          });
          
          if (!regex.global) break;
        }

        if (matches.length > 0) {
          searchResults.push({
            type: 'log',
            item: log,
            matches
          });
        }
      });

      // Search anomalies
      anomalies.forEach(anomaly => {
        const searchText = `${anomaly.description} ${anomaly.type}`;
        const matches = [];
        let match;

        while ((match = regex.exec(searchText)) !== null) {
          matches.push({
            text: match[0],
            start: match.index,
            end: match.index + match[0].length
          });
          
          if (!regex.global) break;
        }

        if (matches.length > 0) {
          searchResults.push({
            type: 'anomaly',
            item: anomaly,
            matches
          });
        }
      });

      setResults(searchResults);
    } catch (error) {
      setSearchError(`Invalid regex pattern: ${error.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const saveCurrentQuery = () => {
    if (!queryName.trim() || !searchPattern.trim()) return;

    const newQuery: SearchQuery = {
      id: `query_${Date.now()}`,
      name: queryName.trim(),
      pattern: searchPattern,
      flags: searchFlags,
      description: queryDescription.trim(),
      createdAt: new Date()
    };

    saveQueries([...savedQueries, newQuery]);
    setShowSaveDialog(false);
    setQueryName('');
    setQueryDescription('');
  };

  const loadQuery = (query: SearchQuery) => {
    setSearchPattern(query.pattern);
    setSearchFlags(query.flags);
    
    // Update last used
    const updatedQueries = savedQueries.map(q => 
      q.id === query.id ? { ...q, lastUsed: new Date() } : q
    );
    saveQueries(updatedQueries);
  };

  const deleteQuery = (queryId: string) => {
    if (confirm('Delete this saved query?')) {
      saveQueries(savedQueries.filter(q => q.id !== queryId));
    }
  };

  const highlightMatches = (text: string, matches: Array<{ start: number; end: number }>) => {
    if (matches.length === 0) return text;

    const parts = [];
    let lastIndex = 0;

    matches.forEach(match => {
      if (match.start > lastIndex) {
        parts.push(text.slice(lastIndex, match.start));
      }
      parts.push(
        <span key={match.start} className="bg-yellow-400 text-black px-1 rounded">
          {text.slice(match.start, match.end)}
        </span>
      );
      lastIndex = match.end;
    });

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-6xl w-full max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Search className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Advanced Regex Search</h2>
                <p className="text-slate-400">Powerful pattern matching across logs and anomalies</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>

          {/* Search Interface */}
          <div className="mt-6 space-y-4">
            <div className="flex space-x-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Regex Pattern
                </label>
                <input
                  type="text"
                  value={searchPattern}
                  onChange={(e) => setSearchPattern(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 font-mono"
                  placeholder="Enter regex pattern (e.g., \b(error|fail|timeout)\b)"
                  onKeyPress={(e) => e.key === 'Enter' && performSearch()}
                />
              </div>
              
              <div className="w-32">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Flags
                </label>
                <input
                  type="text"
                  value={searchFlags}
                  onChange={(e) => setSearchFlags(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 font-mono"
                  placeholder="gi"
                />
              </div>
              
              <div className="flex items-end space-x-2">
                <button
                  onClick={performSearch}
                  disabled={isSearching || !searchPattern.trim()}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  <Search className={`h-4 w-4 ${isSearching ? 'animate-spin' : ''}`} />
                  <span>Search</span>
                </button>
                
                <button
                  onClick={() => setShowSaveDialog(true)}
                  disabled={!searchPattern.trim()}
                  className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg transition-colors"
                  title="Save Query"
                >
                  <Save className="h-4 w-4" />
                </button>
              </div>
            </div>

            {searchError && (
              <div className="flex items-center space-x-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <span className="text-red-400 text-sm">{searchError}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex h-[calc(95vh-200px)]">
          {/* Saved Queries Sidebar */}
          <div className="w-80 border-r border-slate-700 p-4 overflow-y-auto">
            <h3 className="text-white font-medium mb-4">Saved Queries</h3>
            
            {savedQueries.length === 0 ? (
              <p className="text-slate-400 text-sm">No saved queries yet</p>
            ) : (
              <div className="space-y-2">
                {savedQueries.map(query => (
                  <div key={query.id} className="bg-slate-900 border border-slate-600 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium text-sm truncate">{query.name}</h4>
                        <p className="text-slate-400 text-xs mt-1 truncate">{query.description}</p>
                        <code className="text-green-400 text-xs font-mono mt-1 block truncate">
                          {query.pattern}
                        </code>
                        <div className="text-slate-500 text-xs mt-2">
                          Created: {format(query.createdAt, 'MMM dd')}
                          {query.lastUsed && (
                            <span className="ml-2">• Used: {format(query.lastUsed, 'MMM dd')}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-1 ml-2">
                        <button
                          onClick={() => loadQuery(query)}
                          className="p-1 text-slate-400 hover:text-blue-400 transition-colors"
                          title="Load Query"
                        >
                          <Search className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => deleteQuery(query.id)}
                          className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                          title="Delete Query"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Search Results */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium">
                Search Results ({results.length})
              </h3>
              {results.length > 0 && (
                <span className="text-slate-400 text-sm">
                  Pattern: <code className="text-green-400 font-mono">{searchPattern}</code>
                </span>
              )}
            </div>

            {results.length === 0 && searchPattern && !isSearching && (
              <div className="text-center py-12">
                <Search className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-400">No matches found for the current pattern</p>
              </div>
            )}

            <div className="space-y-3">
              {results.map((result, index) => (
                <div key={index} className="bg-slate-900 border border-slate-600 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        result.type === 'log' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {result.type}
                      </span>
                      <span className="text-slate-400 text-sm">
                        {format(result.item.timestamp, 'MMM dd, HH:mm:ss')}
                      </span>
                      <span className="text-slate-400 text-sm">
                        {result.item.siteName}
                      </span>
                    </div>
                    <span className="text-green-400 text-sm font-medium">
                      {result.matches.length} match{result.matches.length !== 1 ? 'es' : ''}
                    </span>
                  </div>
                  
                  <div className="text-white">
                    {'message' in result.item ? (
                      <p>{highlightMatches(result.item.message, result.matches)}</p>
                    ) : (
                      <p>{highlightMatches(result.item.description, result.matches)}</p>
                    )}
                  </div>
                  
                  <div className="mt-2 text-xs text-slate-400">
                    {'source' in result.item && (
                      <span>Source: {result.item.source}</span>
                    )}
                    {'type' in result.item && (
                      <span>Type: {result.item.type}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Save Query Dialog */}
        {showSaveDialog && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 w-96">
              <h3 className="text-white font-medium mb-4">Save Search Query</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Query Name
                  </label>
                  <input
                    type="text"
                    value={queryName}
                    onChange={(e) => setQueryName(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
                    placeholder="Enter a name for this query"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    value={queryDescription}
                    onChange={(e) => setQueryDescription(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 h-20"
                    placeholder="Describe what this query searches for"
                  />
                </div>
                
                <div className="bg-slate-900 p-3 rounded border border-slate-600">
                  <div className="text-slate-400 text-xs mb-1">Pattern:</div>
                  <code className="text-green-400 font-mono text-sm">{searchPattern}</code>
                </div>
              </div>
              
              <div className="flex items-center space-x-4 mt-6">
                <button
                  onClick={saveCurrentQuery}
                  disabled={!queryName.trim()}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  <Save className="h-4 w-4" />
                  <span>Save Query</span>
                </button>
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}