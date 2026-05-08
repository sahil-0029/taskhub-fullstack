const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES = '7d';

function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function getProjectRole(projectId, userId) {
  const row = db
    .prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?')
    .get(projectId, userId);
  return row ? row.role : null;
}

function requireProjectRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    const projectId = Number(req.params.projectId || req.params.id);
    if (!projectId) return res.status(400).json({ error: 'Invalid project id' });
    const role = getProjectRole(projectId, req.user.id);
    if (!role) return res.status(403).json({ error: 'Not a member of this project' });
    if (!allowed.includes(role)) return res.status(403).json({ error: 'Insufficient permissions' });
    req.projectRole = role;
    req.projectId = projectId;
    next();
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  authRequired,
  getProjectRole,
  requireProjectRole,
};
