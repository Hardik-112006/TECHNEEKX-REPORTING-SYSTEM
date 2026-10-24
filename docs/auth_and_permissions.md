# TechNeekX Community Reporting System
## Authentication, Organization & RBAC Permissions (Phase 3)

### 1. Documented Role Hierarchy & Tiering Architecture

| Tier | Role Name | System Authority & Permissions |
| :--- | :--- | :--- |
| **Tier 1** | `Founder`<br>`Chairman`<br>`Managing Director` | **Executive Administration:** System oversight, modify user roles, create/delete teams, manage all tasks/announcements, full audit log access. |
| **Tier 2** | `President`<br>`CTO`<br>`Director of Core Operations`<br>`Official` | **Executive Leadership & Operations:** Create/update teams, assign members to teams, promote/manage users up to Tier 2, issue community announcements, escalate reviews. |
| **Tier 3** | `Mentor`<br>`Core Team Lead` | **Core Leadership & Mentorship:** Manage team-assigned tasks, review submissions, request changes, coordinate group leads, assign/remove members within team scope. |
| **Tier 4** | `Deputy`<br>`Group Leader` | **Group & Deputy Leadership:** Coordinate group activities, assist in task review for their group, assign tasks within group scope. |
| **Tier 5** | `Member` | **Community Member (Safe Default):** Public registration default. View assigned personal and team tasks, submit evidence proof, resubmit corrected work, view leaderboard and announcements. **Strictly forbidden from modifying roles, teams, or other users' profiles.** |

---

### 2. API Endpoints Catalog

#### Authentication & Profile Endpoints
| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register/` | Public (`AllowAny`) | Registers new user. **Strictly assigns role `Member`**; ignores elevated role injection. |
| `POST` | `/api/auth/login/` | Public (`AllowAny`) | Validates credentials and active status. Returns user profile, role tier, and JWT access/refresh tokens. |
| `POST` | `/api/auth/refresh/` | Public (`AllowAny`) | Generates a new access token using a valid refresh token. |
| `POST` | `/api/auth/logout/` | Authenticated | Invalidates the session / acknowledges logout. |
| `GET` | `/api/auth/me/` | Authenticated | Retrieves current authenticated user's profile and role details. |
| `PATCH` | `/api/auth/me/` | Authenticated | Updates current user's profile (`name` only; cannot alter `role`, `email`, `team`, or `status`). |

#### Roles & User Management Endpoints
| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/roles/` | Authenticated | Lists all 12 system roles with their permission tier. |
| `GET` | `/api/users/` | Authenticated | Paginated user list with filtering by `role_id`, `team_id`, `status`, and text `search`. |
| `GET` | `/api/users/<id>/` | Authenticated | Retrieves user detail. |
| `PATCH` | `/api/users/<id>/manage/` | Tier 1 & 2 Only | Administrative update of user `role`, `team`, or `status`. (Tier 1 roles require Tier 1 admin). |

#### Teams & Groups Endpoints
| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/teams/` | Authenticated | Lists all teams, sub-teams, and group counts. Supports `?type=` and `?parent_team_id=`. |
| `POST` | `/api/teams/` | Tier 1 & 2 Only | Creates a new team or hierarchical sub-team (`parent_team`). |
| `GET` | `/api/teams/<id>/` | Authenticated | Detailed team view with nested members, groups, and sub-teams. |
| `PATCH` | `/api/teams/<id>/` | Tier 1 & 2 Only | Updates team details. |
| `DELETE` | `/api/teams/<id>/` | Tier 1 Only | Deletes team (`parent_team` references set to NULL). |
| `GET` | `/api/teams/<id>/members/` | Authenticated | Lists all members assigned to the team. |
| `POST` | `/api/teams/<id>/add_member/` | Tier 1, 2, 3 | Assigns user to the specified team. |
| `POST` | `/api/teams/<id>/remove_member/` | Tier 1, 2, 3 | Removes user from the specified team. |
| `GET` | `/api/groups/` | Authenticated | Lists groups, filterable by `?team_id=`. |
| `POST` | `/api/groups/` | Tier 1, 2, 3 | Creates a new group within a team. |
| `GET` | `/api/groups/<id>/` | Authenticated | Retrieves group details. |
| `PATCH` | `/api/groups/<id>/` | Tier 1, 2, 3 | Updates group details. |

---

### 3. Example Request & Response Payloads

#### A. Registration (`POST /api/auth/register/`)
```json
// Request
{
  "name": "Aanya Sharma",
  "email": "aanya@example.com",
  "password": "SecurePassword123!"
}

// Response (201 Created)
{
  "message": "Registration successful. Account created as Member.",
  "user": {
    "user_id": 7,
    "name": "Aanya Sharma",
    "email": "aanya@example.com",
    "role_id": 5,
    "role_name": "Member",
    "team_id": null,
    "team_name": null,
    "status": "Active",
    "role_tier": 5
  }
}
```

#### B. Login (`POST /api/auth/login/`)
```json
// Request
{
  "email": "aarav.lead@example.com",
  "password": "Techneekx@2026"
}

// Response (200 OK)
{
  "user": {
    "user_id": 3,
    "name": "Aarav Core Lead",
    "email": "aarav.lead@example.com",
    "role": {
      "role_id": 3,
      "name": "Core Team Lead",
      "description": "Leads a core team and can assign work within authorized scope",
      "tier": 3
    },
    "team_id": 3,
    "team_name": "Development Team",
    "status": "Active",
    "created_at": "2026-10-24T17:40:48.874134Z",
    "role_tier": 3
  },
  "tokens": {
    "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### C. Add Member to Team (`POST /api/teams/3/add_member/`)
```json
// Request (Authenticated as Core Lead, Tier 3)
{
  "user_id": 7
}

// Response (200 OK)
{
  "message": "User 'Aanya Sharma' successfully added to team 'Development Team'.",
  "team_id": 3,
  "user_id": 7
}
```
