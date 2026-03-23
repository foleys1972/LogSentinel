import React, { useState } from 'react';
import { Activity, Shield, RefreshCw, Database, LogOut, User, Key } from 'lucide-react';

interface HeaderProps {
  onRefresh: () => void;
  isLoading: boolean;
  isRefreshing?: boolean;
  user?: { username: string; fullName: string } | null;
  onLogout?: () => void;
  onChangePassword?: (current: string, newPass: string) => Promise<{ success: boolean; error?: string }>;
  onShowLogin?: () => void;
  authRequired?: boolean;
}

export function Header({ onRefresh, isLoading, isRefreshing, user, onLogout, onChangePassword, onShowLogin, authRequired }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  return (
    <header className="bg-slate-900 border-b border-slate-700 shadow-lg">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Shield className="h-8 w-8 text-blue-400" />
                <div className="absolute -top-1 -right-1 h-3 w-3 bg-green-400 rounded-full animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">LogSentinel Enterprise</h1>
                <p className="text-sm text-slate-400">ML-Powered Log Monitoring System</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-green-400">
              <Activity className="h-4 w-4 animate-pulse" />
              <span className="text-sm font-medium">Live Monitoring</span>
            </div>
            
            <div className="flex items-center space-x-2 text-blue-400">
              <Database className="h-4 w-4" />
              <span className="text-sm font-medium">ML Active</span>
            </div>
            
            <button
              onClick={onRefresh}
              disabled={isLoading || isRefreshing}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg transition-colors duration-200"
            >
              <RefreshCw className={`h-4 w-4 ${(isLoading || isRefreshing) ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium">Refresh</span>
            </button>
            {!user && onShowLogin && (
              <button
                onClick={onShowLogin}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm"
              >
                <User className="h-4 w-4" />
                Sign in
              </button>
            )}
            {user && onLogout && (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200"
                >
                  <User className="h-4 w-4" />
                  <span className="text-sm">{user.fullName || user.username}</span>
                </button>
                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute right-0 mt-1 py-2 w-48 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50">
                      <div className="px-4 py-2 text-slate-400 text-sm border-b border-slate-600">
                        {user.username}
                      </div>
                      {onChangePassword && (
                        <button
                          onClick={() => { setShowChangePassword(true); setShowUserMenu(false); }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-slate-300 hover:bg-slate-700 text-sm"
                        >
                          <Key className="h-4 w-4" />
                          Change password
                        </button>
                      )}
                      <button
                        onClick={() => { onLogout?.(); setShowUserMenu(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-slate-700 text-sm"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {showChangePassword && onChangePassword && (
        <ChangePasswordModal
          onClose={() => setShowChangePassword(false)}
          onChangePassword={onChangePassword}
        />
      )}
    </header>
  );
}

function ChangePasswordModal({
  onClose,
  onChangePassword
}: {
  onClose: () => void;
  onChangePassword: (current: string, newPass: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPass.length < 6) { setError('New password must be at least 6 characters'); return; }
    if (newPass !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const r = await onChangePassword(current, newPass);
      if (r.success) onClose();
      else setError(r.error || 'Failed');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-white mb-4">Change password</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-red-400 text-sm">{error}</div>}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Current password</label>
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">New password</label>
            <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2" required minLength={6} />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Confirm new password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2" required />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm">Update</button>
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded text-sm">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}