# 🚀 Team Task Manager (Full-Stack | Production Deployed)

A scalable full-stack team collaboration platform designed to manage projects, assign tasks, and enforce role-based workflows in real time.

🔗 **Live Demo:**
👉 [https://team-task-manager-full-stack-production-3cc0.up.railway.app](https://team-task-manager-full-stack-production-3cc0.up.railway.app)

---

## 📌 Overview

This project is a **production-ready task management system** that enables teams to efficiently collaborate through structured workflows, secure authentication, and role-based access control.

It is built with a focus on:

* Clean backend architecture
* Real-world API design
* Secure authentication flows
* Scalable deployment

---

## 🧠 Key Highlights

* 🔐 Secure Authentication using JWT + bcrypt
* 👥 Role-Based Access (Admin / Member)
* 📊 Real-Time Dashboard Insights
* 🧩 Modular REST API Design
* ⚡ Lightweight & Fast (SQLite + Node.js)
* 🌐 Fully Deployed on Railway

---

## ⚙️ Tech Stack

| Layer          | Technology                       |
| -------------- | -------------------------------- |
| Backend        | Node.js, Express                 |
| Database       | SQLite (better-sqlite3)          |
| Authentication | JWT, bcrypt                      |
| Frontend       | Vanilla JavaScript, Tailwind CSS |
| Deployment     | Railway                          |

---

## ✨ Features

### 🔑 Authentication

* User signup & login with JWT-based sessions
* Secure password hashing using bcrypt

---

### 📁 Project Management

* Create and manage projects
* Project creator automatically assigned as **Admin**
* Add/remove members using email
* Update user roles dynamically

---

### 📝 Task Management

* Admin can:

  * Create, assign, update, delete tasks
* Members can:

  * Update status of assigned tasks

---

### 📊 Dashboard

* Total task counts
* Personal task tracking
* Overdue task indicators
* Real-time visibility of project progress

---

### 🔒 Access Control

* Role-based permissions enforced at backend level
* Admin vs Member capabilities clearly separated

---

## 🏗️ System Architecture

```
Frontend (Vanilla JS + Tailwind)
        ↓
REST API (Node.js + Express)
        ↓
SQLite Database (better-sqlite3)
        ↓
Authentication Layer (JWT)
```

---

## 🚀 Getting Started (Local Setup)

```bash
# Install dependencies
npm install

# Start server
npm start
```

Open:
👉 [http://localhost:3000](http://localhost:3000)

---

## 🔐 Environment Variables

| Variable   | Default Value        | Description                   |
| ---------- | -------------------- | ----------------------------- |
| PORT       | 3000                 | Server port                   |
| JWT_SECRET | dev-secret-change-me | Change in production          |
| DB_PATH    | ./data/app.db        | Use `/data/app.db` in Railway |

---

## ☁️ Deployment (Railway)

This project is deployed using **Railway** with persistent storage.

### Steps:

1. Push project to GitHub
2. Deploy via Railway → “Deploy from GitHub”
3. Add environment variables:

   * `JWT_SECRET`
   * `DB_PATH=/data/app.db`
4. Attach volume at `/data`

Railway automatically handles:

* Build (`npm install`)
* Start (`npm start`)

---

## 🔌 API Endpoints (Summary)

### Auth

```
POST   /api/auth/signup
POST   /api/auth/login
GET    /api/auth/me
```

### Projects

```
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
DELETE /api/projects/:id              (Admin)
```

### Members

```
POST   /api/projects/:id/members
PUT    /api/projects/:id/members/:userId
DELETE /api/projects/:id/members/:userId
```

### Tasks

```
GET    /api/projects/:id/tasks
POST   /api/projects/:id/tasks        (Admin)
PUT    /api/tasks/:taskId             (Role-based)
DELETE /api/tasks/:taskId             (Admin)
```

### Dashboard

```
GET    /api/dashboard
```

---

## 👤 Role Permissions

| Role   | Permissions                             |
| ------ | --------------------------------------- |
| Admin  | Full control (projects, members, tasks) |
| Member | Update assigned task status             |

---

## 📈 Real-World Relevance

This project demonstrates:

* Backend system design
* API structuring
* Authentication flows
* Data modeling
* Role-based access control

It reflects real-world use cases such as:

* Team collaboration tools
* Project tracking systems
* SaaS workflow platforms

---

## 🔮 Future Improvements

* WebSocket-based real-time updates
* Notifications system
* Multi-project analytics
* Role hierarchy (Manager, Viewer)
* Migration to PostgreSQL for scalability

---

## 👨‍💻 Author

**Shourya Mukhi**
Computer Science Engineer | Full-Stack Developer
