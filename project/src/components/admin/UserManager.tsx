import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Key, Save } from 'lucide-react';

interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  mustChangePassword?: boolean;
  createdAt?: string;
}

interface UserManagerProps {
  onDataUpdate?: () => void;
}

export function UserManager({ onDataUpdate }: UserManagerProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ username: '', password: '', fullName: '', email: '', mustChangePassword: true });
  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [error, setError] = useState('');

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/auth/users', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.username || !form.password || !form.fullName || !form.email) {
      setError('Username, password, full name, and email are required');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create user');
        return;
      }
      setShowForm(false);
      setForm({ username: '', password: '', fullName: '', email: '', mustChangePassword: true });
      loadUsers();
      onDataUpdate?.();
    } catch {
      setError('Network error');
    }
  };

  const handleUpdate = async (userId: string, updates: Partial<User>) => {
    try {
      const res = await fetch(`/api/auth/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update');
        return;
      }
      setEditingId(null);
      loadUsers();
      onDataUpdate?.();
    } catch {
      setError('Network error');
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Delete this user?')) return;
    try {
      const res = await fetch(`/api/auth/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to delete');
        return;
      }
      loadUsers();
      onDataUpdate?.();
    } catch {
      setError('Network error');
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordId || !resetPassword || resetPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    try {
      const res = await fetch(`/api/auth/users/${resetPasswordId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newPassword: resetPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to reset password');
        return;
      }
      setResetPasswordId(null);
      setResetPassword('');
      loadUsers();
      onDataUpdate?.();
    } catch {
      setError('Network error');
    }
  };

  if (loading) return <div className="p-6 text-slate-400">Loading users...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-400" />
            User Management
          </h3>
          <p className="text-slate-400 text-sm mt-1">
            Manage platform access. Users need username, password, full name, and email.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
        >
          <Plus className="h-4 w-4" />
          Add user
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 p-4 bg-slate-900 border border-slate-600 rounded-lg space-y-4">
          <h4 className="text-white font-medium">New user</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Username *</label>
              <input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Password * (min 6 chars)</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Full name *</label>
              <input
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded px-3 py-2"
                required
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={form.mustChangePassword}
              onChange={(e) => setForm((f) => ({ ...f, mustChangePassword: e.target.checked }))}
              className="rounded bg-slate-800 border-slate-600"
            />
            Require password change on first login
          </label>
          <div className="flex gap-2">
            <button type="submit" className="flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm">
              <Save className="h-4 w-4" />
              Create
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {users.map((u) => (
          <div key={u.id} className="bg-slate-900 border border-slate-600 rounded-lg p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{u.username}</span>
                <span className="text-slate-400">—</span>
                <span className="text-slate-300">{u.fullName}</span>
                {u.mustChangePassword && (
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs">Must change password</span>
                )}
              </div>
              <div className="text-slate-400 text-sm mt-1">{u.email}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setResetPasswordId(u.id); setResetPassword(''); setError(''); }}
                className="flex items-center gap-1 px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-sm"
              >
                <Key className="h-3 w-3" />
                Reset password
              </button>
              <button
                onClick={() => handleDelete(u.id)}
                className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {resetPasswordId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full">
            <h4 className="text-white font-medium mb-4">Reset password</h4>
            <input
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="New password (min 6 characters)"
              className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2 mb-4"
            />
            <div className="flex gap-2">
              <button onClick={handleResetPassword} disabled={resetPassword.length < 6} className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:opacity-50 text-white rounded text-sm">
                Reset
              </button>
              <button onClick={() => { setResetPasswordId(null); setResetPassword(''); }} className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
