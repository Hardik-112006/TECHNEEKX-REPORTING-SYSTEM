# TechNeekX Phase 6: Frontend/API Integration & Core User Flows

## 1. Feature-to-Endpoint Mapping

| Frontend Feature / UI Action | HTTP Method & Endpoint | Payload / Parameters | Success Response / Outcome |
| :--- | :--- | :--- | :--- |
| **Authentication: Login** | `POST /api/auth/login/` | `{ email, password }` | Returns user details, role tier, JWT access & refresh tokens |
| **Authentication: Registration** | `POST /api/auth/register/` | `{ name, email, password }` | Safe default role assignment (`Member`), returns 201 Created |
| **Authentication: Token Refresh** | `POST /api/auth/refresh/` | `{ refresh }` | Silent background token renewal on 401 response |
| **Authentication: Current Profile** | `GET /api/auth/me/` | Bearer Token header | Current user profile, role tier, and team membership |
| **Authentication: Logout** | `POST /api/auth/logout/` | `{ refresh }` | Blacklists refresh token, clears client localStorage |
| **Roles Directory** | `GET /api/roles/` | Bearer Token header | Array of all 11-12 community roles |
| **Tasks Directory** | `GET /api/tasks/` | `?status=&team_id=&assigned_to=&overdue=&search=&page=` | Scoped task listing with pagination |
| **Task Creation** | `POST /api/tasks/` | `{ title, description, deadline, assigned_to_id, team_id, priority }` | Server-side assignment validation, returns 201 Created |
| **Task Lifecycle: Start Work** | `POST /api/tasks/<id>/start/` | Empty / Bearer Token | Advances state `Assigned` → `In Progress` |
| **Member Workflow: Submit Proof** | `POST /api/tasks/<id>/submit/` | `{ github_link, screenshots, description }` | Advances state `In Progress` → `Submitted`, logs activity |
| **Task Inspection: Proofs** | `GET /api/tasks/<id>/submissions/` | Bearer Token header | Array of deliverable proofs, submitter metadata, URLs |
| **Task Inspection: Reviews** | `GET /api/tasks/<id>/reviews/` | Bearer Token header | Chronological official reviews and feedback text |
| **Reviewer Queue: Official Review** | `POST /api/tasks/<id>/review/` | `{ decision: 'Approved' \| 'Changes Requested', feedback }` | Anti-self-review enforced; awards +10 pts on approval; advances state |
| **Teams: Directory Listing** | `GET /api/teams/` | `?type=&parent_team_id=` | Hierarchical teams, sub-teams, and group counts |
| **Teams: Team Detail & Roster** | `GET /api/teams/<id>/` | Bearer Token header | Detailed team record with active member roster and groups |
| **Teams: Member Addition** | `POST /api/teams/<id>/add_member/` | `{ user_id }` | Lead authorization required; assigns member to team |
| **Teams: Member Removal** | `POST /api/teams/<id>/remove_member/` | `{ user_id }` | Lead authorization required; removes member from team |
| **Live Leaderboard** | `GET /api/leaderboard/` | `?page=` | Ranked points leaderboard, tasks completed count |
| **Announcements: Feed** | `GET /api/announcements/` | `?page=` | Public community broadcast notices |
| **Announcements: Publish** | `POST /api/announcements/` | `{ title, content }` | Tier 1-3 lead authorization required |
| **Audit Logs: System Event Stream** | `GET /api/activity/` | `?action=&user_id=&page=` | Immutable audit trail; Tier 1-2 full org, Tier 5 self-logs |

---

## 2. Authentication, Token Lifecycle & Session Safety

- **Configurable Base URL**: Sourced from `VITE_API_BASE_URL` (default `http://127.0.0.1:8000/api`). No secrets or credentials bundled in client build.
- **Token Storage**: `techneekx_access_token` and `techneekx_refresh_token` in browser `localStorage`.
- **Automatic Token Refresh**: The typed client in `frontend/src/services/api.ts` intercepts HTTP 401 responses, initiates a single refresh request against `/api/auth/refresh/`, updates storage, and transparently replays the original request.
- **Graceful Session Expiry**: If token refresh fails, the client clears tokens, triggers an `auth:expired` event, and redirects to the authentication screen without crashing.
- **Live Persona Authenticator**: TopBar switcher allows instant role toggles between seeded demo users (`Founder`, `Official`, `Core Team Lead`, `Member`) using real API login calls (`Techneekx@2026`).

---

## 3. Workflow State Machine & Anti-Self-Review Guards

1. **State Machine Transitions**:
   - `Assigned` → `In Progress` (`POST /api/tasks/<id>/start/`)
   - `In Progress` → `Submitted` (`POST /api/tasks/<id>/submit/`)
   - `Submitted` → `Approved` (`POST /api/tasks/<id>/review/` with decision `Approved` → awards exactly 10 points)
   - `Submitted` → `Changes Requested` (`POST /api/tasks/<id>/review/` with mandatory written feedback)
   - `Changes Requested` → `In Progress` (Member clicks "Start") or directly resubmits evidence via `Submit Proof`.
2. **Anti-Self-Review Enforcement**:
   - Client disables the "Review" action and displays a `Self Submission` badge if the current user is the submitter or assigned member.
   - Server strictly verifies `latest_proof.submitted_by != reviewer` and `task.assigned_to != reviewer`, rejecting any attempt with `HTTP 403 Forbidden`.

---

## 4. Manual End-to-End Test Instructions

1. **Start Backend & Frontend Servers**:
   ```powershell
   # Terminal 1: Backend Django Server
   python backend\manage.py runserver 127.0.0.1:8000

   # Terminal 2: Frontend Vite Dev Server
   npm --prefix frontend run dev
   ```
2. **Access the Application**:
   - Open `http://localhost:5173/` in your browser.
3. **Login / Quick Demo Authentication**:
   - If not logged in, select **Founder (Tier 1)** or **Member (Tier 5)** from the demo tiles on the login screen.
4. **Create a Task (as Founder or Core Team Lead)**:
   - Click **Allocate New Task** on the Tasks view.
   - Enter a Title, Description, Deadline, and select Assignee: **Riya Member**. Click **Create Task**.
5. **Start & Submit Proof (as Member)**:
   - Switch role to **Member** using the topbar Persona Authenticator.
   - Locate the task in the table. Click **Start** (transitions to *In Progress*).
   - Click **Submit Proof**, enter GitHub PR URL and description notes, and submit (transitions to *Submitted*).
6. **Conduct Official Review (as Founder / Official)**:
   - Switch role to **Founder** or **Official**.
   - Note that if you are logged in as the member, self-review is disabled.
   - Click **Review**, select **Approve (+10 Pts)**, enter commendation feedback, and submit.
   - Notice the success banner confirming **10 points awarded**.
7. **Verify Live Leaderboard & Audit Logs**:
   - Navigate to **Leaderboard** in sidebar: verify member's points incremented by +10.
   - Navigate to **Activity Logs**: verify `TASK_APPROVED` event is recorded with timestamp and details.
