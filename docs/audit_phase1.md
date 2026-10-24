# TechNeekX Community Reporting & Task Management System
## Phase 1 Repository & Architecture Audit

### 1. Repository Inventory & Initial State
- **Workspace Path:** `d:\PROJECTS\TECHNEEKX REPORTING SYSTEM`
- **Initial Files Present:** Only `techneekx_reporting_schema_seed.sql` (11,792 bytes, 227 lines).
- **Initial Git State:** Uninitialized (`fatal: not a git repository`). Initialized into branch `main` during Phase 1.
- **Git Remotes:** None configured initially.
- **Local Toolchain Verified:**
  - **Python:** 3.14.3 (64-bit Windows)
  - **Node.js:** v24.4.1 / npm 11.6.0
  - **Git:** 2.54.0.windows.1
  - **PostgreSQL:** 18.4 (`C:\Program Files\PostgreSQL\18\bin\psql.exe`, service `postgresql-x64-18` status: **Running**).

---

### 2. Current vs. Missing MVP Feature Matrix

| Functional Area | Target MVP Requirement | Current State | Missing / Required Action |
| :--- | :--- | :--- | :--- |
| **Database Schema** | Relational schema with roles, teams, groups, users, tasks, proofs, reviews, performance, history logs, extra material | Provided in `techneekx_reporting_schema_seed.sql` | Needs model synchronization in Django ORM, managed migrations, and validation against running PostgreSQL 18 (Prompt 2). |
| **Authentication & RBAC** | Registration, login, token refresh, password hashing, role permissions, role hierarchy enforcement | **Missing** (Only placeholder hashes in seed SQL) | Implement Django REST Framework JWT auth, custom User model, secure password hashing, and permission policies (Prompt 3). |
| **Organization & Teams** | Teams, child teams, groups, membership links | Defined in SQL schema | Model integration, DRF serializers, and role-scoped endpoints (Prompt 3). |
| **Tasks & Assignments** | Tasks with title, description, deadline, status workflow, individual/team assignment | Defined in SQL schema | Status transitions, assignment rules, Django models, views, and validation (Prompt 4). |
| **Proof Submission** | Evidence submission (GitHub link, screenshot URLs, description) with multi-field check | Defined in SQL schema | Validation logic, file/link handling, preventing invalid submissions (Prompt 4). |
| **Review & Resubmission** | Review decisions ('Approved', 'Changes Requested'), feedback, resubmission loop | Defined in SQL schema | Reviewer authorization check (prevent self-review), update task status, state machine (Prompt 4). |
| **Scoring & Leaderboard** | Idempotent points ledger, rank calculation, prevent duplicate awards | Table `performance` exists in SQL | Safe atomic transactions, idempotent point awards, leaderboard API (Prompt 4). |
| **Announcements** | General and targeted announcements | Defined in SQL schema | CRUD endpoints with role-based write permissions (Prompt 4). |
| **Activity History** | Audit log for task creation, submissions, reviews, score changes | Defined in SQL table `history_logs` | Signal/service layer hooks to record all critical actions (Prompt 4). |
| **Frontend UI/UX** | Responsive SaaS interface (Primary #635BFF, Inter font, role dashboards, task queues) | **Missing** | Initialize Vite + React + TypeScript with custom CSS design tokens conforming to the style guide (Prompt 5 & 6). |
| **API Client & Integration** | Typed API service layer, state management, auth interceptors | **Missing** | Centralized Axios/fetch client, JWT refresh handlers, and reactive UI hooks (Prompt 6). |
| **Automated Testing** | End-to-end tests, unit tests for auth, RBAC, scoring idempotency, task workflows | **Missing** | Pytest / Django test suite and frontend unit tests (Prompt 7). |

---

### 3. Scope Boundaries & Deferred Features

The following features are **explicitly deferred from the MVP** to maintain strict project focus:
- ATS / Resume Builder & Career Profiles
- Hackathon Registration, certificate-based scoring, and external recruitment
- Form generators for extra materials (MoU, event proposals, sponsorship decks)
- Advanced analytics / multi-level approvals / automated SMS/email escalations

---

### 4. Technical Risks & Mitigation Plan

1. **Python 3.14 Compatibility:**
   - *Risk:* Python 3.14 is very recent; certain binary packages (e.g. legacy `psycopg2-binary`) may fail to build wheels without a C compiler.
   - *Mitigation:* Use `psycopg` (v3) or test `psycopg2-binary` wheel availability, falling back to standard supported packages.
2. **Database Integrity & Sequence Desynchronization:**
   - *Risk:* Seed data in `techneekx_reporting_schema_seed.sql` specifies explicit IDs (`OVERRIDING SYSTEM VALUE` or explicit identity inserts). If sequences are not advanced, subsequent `INSERT` operations will fail with unique constraint violations.
   - *Mitigation:* Seed script already includes `SELECT setval(pg_get_serial_sequence(...))` calls; Django migrations must respect existing sequences or manage table creation cleanly without collisions.
3. **Double Scoring & Race Conditions:**
   - *Risk:* Concurrent or repeated approval API requests could grant duplicate performance points.
   - *Mitigation:* Wrap review and scoring in `transaction.atomic()`, enforce unique review constraints per proof/task iteration, and verify task status transition idempotency.
4. **Elevation of Privilege on Registration:**
   - *Risk:* Users registering via public endpoints granting themselves elevated roles (`Founder`, `Official`, `Core Team Lead`).
   - *Mitigation:* Hardcode default registration role to `Member` (or require official invite/approval for higher roles). Backend permission classes must strictly reject unauthorized role assignment.

---

### 5. Recommended Execution Roadmap

- **Phase 1 (Completed):** Repository audit, git initialization, safe environment configuration (`.env.example`), `.gitignore`, setup documentation, baseline tests.
- **Phase 2 (Prompt 2):** Comprehensive SQL inspection, PostgreSQL connection & migration strategy, database initialization, schema validation.
- **Phase 3 (Prompt 3):** Backend foundation, custom user authentication (JWT), RBAC hierarchy, teams/groups API.
- **Phase 4 (Prompt 4):** Core business workflows: Tasks, assignments, proofs, reviews, idempotent scoring, announcements, audit logging.
- **Phase 5 (Prompt 5):** Modern Vite + React + TypeScript frontend foundation, design tokens (Primary #635BFF, Inter), reusable UI components.
- **Phase 6 (Prompt 6):** Frontend API integration, role-specific dashboards, task lifecycle flows, empty/loading/error states.
- **Phase 7 (Prompt 7):** Comprehensive test suite, security verification, documentation finalization, and git status validation.
