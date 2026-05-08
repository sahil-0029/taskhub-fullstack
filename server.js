const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const {
  hashPassword,
  verifyPassword,
  signToken,
  authRequired,
  getProjectRole,
  requireProjectRole,
} = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());

const EMAIL_RE =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
const isEmail = (s) =>
  typeof s === 'string' && s.length <= 254 && EMAIL_RE.test(s) && !s.includes('..');
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

// ---------- AUTH ----------

app.post('/api/auth/signup', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!nonEmpty(name)) return res.status(400).json({ error: 'Name required' });
  if (!isEmail(email)) return res.status(400).json({ error: 'Valid email required' });
  if (!nonEmpty(password) || password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const info = db
    .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
    .run(name.trim(), email.toLowerCase(), hashPassword(password));
  const user = { id: info.lastInsertRowid, name: name.trim(), email: email.toLowerCase() };
  res.json({ user, token: signToken(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!isEmail(email) || !nonEmpty(password))
    return res.status(400).json({ error: 'Email and password required' });
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!row || !verifyPassword(password, row.password_hash))
    return res.status(401).json({ error: 'Invalid credentials' });
  const user = { id: row.id, name: row.name, email: row.email };
  res.json({ user, token: signToken(user) });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

// ---------- PROJECTS ----------

app.get('/api/projects', authRequired, (req, res) => {
  const projects = db
    .prepare(
      `SELECT p.*, pm.role
       FROM projects p
       JOIN project_members pm ON pm.project_id = p.id
       WHERE pm.user_id = ?
       ORDER BY p.created_at DESC`
    )
    .all(req.user.id);
  res.json({ projects });
});

app.post('/api/projects', authRequired, (req, res) => {
  const { name, description } = req.body || {};
  if (!nonEmpty(name)) return res.status(400).json({ error: 'Project name required' });
  const create = db.transaction((uid, n, d) => {
    const info = db
      .prepare('INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)')
      .run(n.trim(), d || null, uid);
    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(
      info.lastInsertRowid,
      uid,
      'admin'
    );
    return info.lastInsertRowid;
  });
  const id = create(req.user.id, name, description);
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  res.json({ project: { ...project, role: 'admin' } });
});

app.get('/api/projects/:id', authRequired, requireProjectRole(['admin', 'member']), (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.projectId);
  const members = db
    .prepare(
      `SELECT u.id, u.name, u.email, pm.role
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = ?
       ORDER BY pm.role DESC, u.name ASC`
    )
    .all(req.projectId);
  res.json({ project: { ...project, role: req.projectRole }, members });
});

app.delete('/api/projects/:id', authRequired, requireProjectRole(['admin']), (req, res) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.projectId);
  res.json({ ok: true });
});

// Add member (admin only)
app.post(
  '/api/projects/:id/members',
  authRequired,
  requireProjectRole(['admin']),
  (req, res) => {
    const { email, role } = req.body || {};
    if (!isEmail(email)) return res.status(400).json({ error: 'Valid email required' });
    const r = role === 'admin' ? 'admin' : 'member';
    const user = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user) return res.status(404).json({ error: 'User with that email not found' });
    const exists = db
      .prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(req.projectId, user.id);
    if (exists) return res.status(409).json({ error: 'User already a member' });
    db.prepare(
      'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)'
    ).run(req.projectId, user.id, r);
    res.json({ member: { ...user, role: r } });
  }
);

// Update member role (admin only)
app.put(
  '/api/projects/:id/members/:userId',
  authRequired,
  requireProjectRole(['admin']),
  (req, res) => {
    const userId = Number(req.params.userId);
    const { role } = req.body || {};
    if (!['admin', 'member'].includes(role))
      return res.status(400).json({ error: 'Invalid role' });
    const project = db.prepare('SELECT owner_id FROM projects WHERE id = ?').get(req.projectId);
    if (project.owner_id === userId)
      return res.status(400).json({ error: "Owner's role cannot be changed" });
    const info = db
      .prepare('UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?')
      .run(role, req.projectId, userId);
    if (info.changes === 0) return res.status(404).json({ error: 'Member not found' });
    res.json({ ok: true });
  }
);

// Remove member (admin only)
app.delete(
  '/api/projects/:id/members/:userId',
  authRequired,
  requireProjectRole(['admin']),
  (req, res) => {
    const userId = Number(req.params.userId);
    const project = db.prepare('SELECT owner_id FROM projects WHERE id = ?').get(req.projectId);
    if (project.owner_id === userId)
      return res.status(400).json({ error: 'Cannot remove project owner' });
    db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(
      req.projectId,
      userId
    );
    res.json({ ok: true });
  }
);

// ---------- TASKS ----------

app.get(
  '/api/projects/:id/tasks',
  authRequired,
  requireProjectRole(['admin', 'member']),
  (req, res) => {
    const tasks = db
      .prepare(
        `SELECT t.*, u.name AS assignee_name, u.email AS assignee_email
         FROM tasks t
         LEFT JOIN users u ON u.id = t.assignee_id
         WHERE t.project_id = ?
         ORDER BY
           CASE t.status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
           t.due_date IS NULL, t.due_date ASC, t.created_at DESC`
      )
      .all(req.projectId);
    res.json({ tasks });
  }
);

app.post(
  '/api/projects/:id/tasks',
  authRequired,
  requireProjectRole(['admin']),
  (req, res) => {
    const { title, description, assignee_id, due_date, status } = req.body || {};
    if (!nonEmpty(title)) return res.status(400).json({ error: 'Title required' });
    const st = ['todo', 'in_progress', 'done'].includes(status) ? status : 'todo';
    if (assignee_id) {
      const isMember = db
        .prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?')
        .get(req.projectId, assignee_id);
      if (!isMember) return res.status(400).json({ error: 'Assignee must be a project member' });
    }
    const info = db
      .prepare(
        `INSERT INTO tasks (project_id, title, description, assignee_id, status, due_date, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        req.projectId,
        title.trim(),
        description || null,
        assignee_id || null,
        st,
        due_date || null,
        req.user.id
      );
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid);
    res.json({ task });
  }
);

app.put('/api/tasks/:taskId', authRequired, (req, res) => {
  const taskId = Number(req.params.taskId);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const role = getProjectRole(task.project_id, req.user.id);
  if (!role) return res.status(403).json({ error: 'Not a member of this project' });

  const { title, description, assignee_id, due_date, status } = req.body || {};
  const isAdmin = role === 'admin';
  const isAssignee = task.assignee_id === req.user.id;

  // Members (non-admin) can only update status of tasks assigned to them
  if (!isAdmin) {
    if (!isAssignee) return res.status(403).json({ error: 'Only assignee or admin can update' });
    if (
      title !== undefined ||
      description !== undefined ||
      assignee_id !== undefined ||
      due_date !== undefined
    ) {
      return res.status(403).json({ error: 'Members can only change status' });
    }
  }

  const updates = [];
  const params = [];
  if (title !== undefined) {
    if (!nonEmpty(title)) return res.status(400).json({ error: 'Title cannot be empty' });
    updates.push('title = ?');
    params.push(title.trim());
  }
  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description || null);
  }
  if (assignee_id !== undefined) {
    if (assignee_id) {
      const isMember = db
        .prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?')
        .get(task.project_id, assignee_id);
      if (!isMember) return res.status(400).json({ error: 'Assignee must be a project member' });
    }
    updates.push('assignee_id = ?');
    params.push(assignee_id || null);
  }
  if (due_date !== undefined) {
    updates.push('due_date = ?');
    params.push(due_date || null);
  }
  if (status !== undefined) {
    if (!['todo', 'in_progress', 'done'].includes(status))
      return res.status(400).json({ error: 'Invalid status' });
    updates.push('status = ?');
    params.push(status);
  }
  if (updates.length === 0) return res.json({ task });

  params.push(taskId);
  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  res.json({ task: updated });
});

app.delete('/api/tasks/:taskId', authRequired, (req, res) => {
  const taskId = Number(req.params.taskId);
  const task = db.prepare('SELECT project_id FROM tasks WHERE id = ?').get(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const role = getProjectRole(task.project_id, req.user.id);
  if (role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
  res.json({ ok: true });
});

// ---------- DASHBOARD ----------

app.get('/api/dashboard', authRequired, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const allTasks = db
    .prepare(
      `SELECT t.*, p.name AS project_name, u.name AS assignee_name
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
       LEFT JOIN users u ON u.id = t.assignee_id
       ORDER BY t.due_date IS NULL, t.due_date ASC, t.created_at DESC`
    )
    .all(req.user.id);

  const myTasks = allTasks.filter((t) => t.assignee_id === req.user.id);
  const isOverdue = (t) => t.status !== 'done' && t.due_date && t.due_date < today;

  const counts = {
    total: allTasks.length,
    todo: allTasks.filter((t) => t.status === 'todo').length,
    in_progress: allTasks.filter((t) => t.status === 'in_progress').length,
    done: allTasks.filter((t) => t.status === 'done').length,
    overdue: allTasks.filter(isOverdue).length,
    my_total: myTasks.length,
    my_overdue: myTasks.filter(isOverdue).length,
  };

  const projectsCount = db
    .prepare('SELECT COUNT(*) AS c FROM project_members WHERE user_id = ?')
    .get(req.user.id).c;

  res.json({ counts, projectsCount, myTasks, allTasks });
});

// ---------- STATIC ----------

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- START ----------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
