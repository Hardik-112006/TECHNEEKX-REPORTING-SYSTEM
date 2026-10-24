# TechNeekX Community Reporting & Task Management System

TechNeekX Community Reporting & Task Management System is a role-based platform designed for assigning, executing, reviewing, and tracking community tasks, submissions, rankings, announcements, and activity history.

---

## 🛠️ Technology Stack & Prerequisites

- **Backend:** Python 3.14+, Django 5.x, Django REST Framework, SimpleJWT
- **Frontend:** React 19 / Vite, TypeScript, Vanilla CSS Design System
- **Database:** PostgreSQL 18.x (with sample seed schema)
- **Tooling:** Git, Node.js 24+, npm 11+

---

## 📁 Repository Structure

```
TECHNEEKX REPORTING SYSTEM/
├── .env.example                                # Safe configuration placeholders
├── .gitignore                                  # Git exclusion rules
├── README.md                                   # Project documentation
├── techneekx_reporting_schema_seed.sql         # Original PostgreSQL schema + seed data
├── database/
│   └── techneekx_reporting_schema_seed.sql     # Database SQL reference copy
├── docs/
│   ├── architecture.md                         # Architecture, roles & workflow specs
│   └── audit_phase1.md                         # Initial audit & MVP feature matrix
├── backend/                                    # Django backend application (Phase 2 & 3)
└── frontend/                                   # React + Vite frontend application (Phase 5)
```

---

## 🚀 Getting Started

### 1. Environment Configuration
Copy `.env.example` to create your local `.env`:
```bash
cp .env.example .env
```
Update `.env` with your local PostgreSQL credentials:
```env
DB_NAME=techneekx_db
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
```

### 2. Database Setup (Phase 2)
Ensure PostgreSQL service is running:
```powershell
Get-Service -Name "*postgres*"
```
Database creation and schema migration will be executed during Phase 2.

---

## 📅 Seven-Phase Execution Plan

1. **Phase 1 (Completed):** Repository audit, git initialization, safe configuration foundation (`.gitignore`, `.env.example`, `docs/`).
2. **Phase 2:** PostgreSQL schema inspection, migration strategy, and database integration.
3. **Phase 3:** Authentication (JWT), custom User model, role hierarchy, and organization/teams API.
4. **Phase 4:** Task lifecycle, evidence submissions, reviews, idempotent scoring, and announcements.
5. **Phase 5:** Modern Vite + React + TypeScript frontend foundation and design token system.
6. **Phase 6:** Frontend API client integration, role dashboards, and interactive task workflows.
7. **Phase 7:** End-to-end testing, security review, documentation, and final deployment readiness.
