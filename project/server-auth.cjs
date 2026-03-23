/**
 * LogSentinel - User authentication and session management.
 * Stores users in JSON file. Passwords hashed with PBKDF2.
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const AUTH_CONFIG_FILE = path.join(__dirname, 'data', 'auth-config.json');

const SALT_LEN = 32;
const KEY_LEN = 64;
const ITERATIONS = 100000;
const DIGEST = 'sha512';

function ensureDataDir() {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_LEN).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const derived = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
}

function loadUsers() {
  ensureDataDir();
  if (!fs.existsSync(USERS_FILE)) return [];
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveUsers(users) {
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

function loadAuthConfig() {
  ensureDataDir();
  if (!fs.existsSync(AUTH_CONFIG_FILE)) {
    return {
      authRequired: false,
      requireAcknowledgment: true,
      acknowledgmentSeverities: ['critical', 'high']
    };
  }
  try {
    return { ...loadAuthConfig.defaults, ...JSON.parse(fs.readFileSync(AUTH_CONFIG_FILE, 'utf8')) };
  } catch {
    return { authRequired: false, requireAcknowledgment: true, acknowledgmentSeverities: ['critical', 'high'] };
  }
}

loadAuthConfig.defaults = {
  authRequired: false,
  requireAcknowledgment: true,
  acknowledgmentSeverities: ['critical', 'high']
};

function saveAuthConfig(config) {
  ensureDataDir();
  fs.writeFileSync(AUTH_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

function findByUsername(username) {
  const users = loadUsers();
  return users.find((u) => u.username.toLowerCase() === username.toLowerCase());
}

function createUser({ username, password, fullName, email, mustChangePassword = true }) {
  const users = loadUsers();
  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return { success: false, error: 'Username already exists' };
  }
  if (!username || !password || !fullName || !email) {
    return { success: false, error: 'Username, password, full name, and email are required' };
  }
  const { salt, hash } = hashPassword(password);
  const user = {
    id: crypto.randomUUID(),
    username: username.trim(),
    fullName: (fullName || '').trim(),
    email: (email || '').trim(),
    salt,
    hash,
    mustChangePassword: !!mustChangePassword,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  users.push(user);
  saveUsers(users);
  return { success: true, user: sanitizeUser(user) };
}

function sanitizeUser(user) {
  if (!user) return null;
  const { salt, hash, ...rest } = user;
  return rest;
}

function authenticate(username, password) {
  const user = findByUsername(username);
  if (!user) return { success: false, error: 'Invalid username or password' };
  if (!verifyPassword(password, user.salt, user.hash)) {
    return { success: false, error: 'Invalid username or password' };
  }
  return { success: true, user: sanitizeUser(user) };
}

function updatePassword(userId, currentPassword, newPassword) {
  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) return { success: false, error: 'User not found' };
  const user = users[idx];
  if (!verifyPassword(currentPassword, user.salt, user.hash)) {
    return { success: false, error: 'Current password is incorrect' };
  }
  const { salt, hash } = hashPassword(newPassword);
  users[idx] = { ...user, salt, hash, mustChangePassword: false, updatedAt: new Date().toISOString() };
  saveUsers(users);
  return { success: true };
}

function resetPasswordByAdmin(adminUserId, targetUserId, newPassword) {
  const users = loadUsers();
  const admin = users.find((u) => u.id === adminUserId);
  if (!admin) return { success: false, error: 'Admin not found' };
  const idx = users.findIndex((u) => u.id === targetUserId);
  if (idx < 0) return { success: false, error: 'User not found' };
  const { salt, hash } = hashPassword(newPassword);
  users[idx] = { ...users[idx], salt, hash, mustChangePassword: true, updatedAt: new Date().toISOString() };
  saveUsers(users);
  return { success: true };
}

function updateUser(userId, updates) {
  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) return { success: false, error: 'User not found' };
  const u = users[idx];
  if (updates.fullName !== undefined) u.fullName = String(updates.fullName).trim();
  if (updates.email !== undefined) u.email = String(updates.email).trim();
  if (updates.mustChangePassword !== undefined) u.mustChangePassword = !!updates.mustChangePassword;
  u.updatedAt = new Date().toISOString();
  saveUsers(users);
  return { success: true, user: sanitizeUser(u) };
}

function deleteUser(userId) {
  const users = loadUsers();
  const filtered = users.filter((u) => u.id !== userId);
  if (filtered.length === users.length) return { success: false, error: 'User not found' };
  saveUsers(filtered);
  return { success: true };
}

function listUsers() {
  return loadUsers().map(sanitizeUser);
}

function getUserById(userId) {
  return sanitizeUser(loadUsers().find((u) => u.id === userId));
}

// Create default admin if no users exist
function ensureDefaultAdmin() {
  const users = loadUsers();
  if (users.length > 0) return;
  createUser({
    username: 'admin',
    password: 'admin',
    fullName: 'Administrator',
    email: 'admin@logsentinel.local',
    mustChangePassword: true
  });
  console.log('Created default admin user (username: admin, password: admin). Change on first login.');
}

module.exports = {
  hashPassword,
  verifyPassword,
  loadUsers,
  saveUsers,
  loadAuthConfig,
  saveAuthConfig,
  findByUsername,
  createUser,
  authenticate,
  updatePassword,
  resetPasswordByAdmin,
  updateUser,
  deleteUser,
  listUsers,
  getUserById,
  sanitizeUser,
  ensureDefaultAdmin
};
