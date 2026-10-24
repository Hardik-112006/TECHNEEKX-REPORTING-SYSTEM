# TechNeekX Community Reporting System
## Tasks, Workflows, Submissions, Reviews, Scoring & Activity (Phase 4)

### 1. Task Lifecycle State Machine

The task workflow is strictly enforced by the backend API:

```
[Assigned] ─────────── (Member clicks Start) ───────────> [In Progress]
     │                                                          │
     │                                                 (Submit Evidence)
     │                                                          │
     │                                                          ▼
     └──────────────── (Direct Submission) ──────────────> [Submitted]
                                                                │
                            ┌───────────────────────────────────┴───────────────────────────────────┐
                            │ (Review Decision)                                                     │ (Review Decision)
                            ▼                                                                       ▼
                  [Changes Requested]                                                           [Approved]
                            │                                                                       │
                    (Resubmit Proof)                                                                ▼
                            │                                                          Atomic Point Award (+10 pts)
                            ▼                                                            Idempotency Lock Engaged
                       [Submitted]                                                                  │
                                                                                                    ▼
                                                                                                [Closed]
```

#### Status Transition Rules:
1. **`Assigned` -> `In Progress`:** Executed by calling `POST /api/tasks/<id>/start/`. Only the assigned member or members of the assigned team can start the task.
2. **`In Progress` (or `Assigned`) -> `Submitted`:** Executed by submitting evidence via `POST /api/tasks/<id>/submit/`. The task automatically advances to `Submitted`.
3. **`Submitted` -> `Approved`:** Executed by calling `POST /api/tasks/<id>/review/` with `decision='Approved'`. Triggers atomic, idempotent point award (+10 points).
4. **`Submitted` -> `Changes Requested`:** Executed with `decision='Changes Requested'`. Reviewer **must** provide feedback detailing corrections.
5. **`Changes Requested` -> `Submitted`:** Member resubmits evidence via `POST /api/tasks/<id>/submit/`. Advances task back to `Submitted` for re-review.

---

### 2. Scoring Model & Idempotency Rules

- **Fixed MVP Scoring Rule:**
  - Each task approved by an authorized reviewer awards **+10 points** to the submitter's record in the `performance` table.
- **Strict Idempotency Guards:**
  - The review and scoring operation is enclosed in a database transaction (`transaction.atomic()`).
  - Row-level lock (`select_for_update()`) is acquired on the submitter's `performance` record.
  - The scoring engine verifies that no prior `Approved` review exists for this task.
  - Repeated review attempts on an already approved task are rejected with `HTTP 400 Bad Request` or return 0 additional points.
  - Resubmission iterations on rejected tasks do **not** award points until final approval, and only once.
- **Live Leaderboard Query:**
  - `GET /api/leaderboard/` dynamically retrieves users from `performance` ordered by `points DESC`, computing dense ranks (`rank`).

---

### 3. Reviewer Authorization & Anti-Self-Review Constraints

- **Reviewer Permissions:** Reviewers must possess Tier 1 (`Founder`, `Chairman`, `Managing Director`), Tier 2 (`President`, `CTO`, `Director of Operations`, `Official`), or Tier 3/4 (`Mentor`, `Core Team Lead`, `Deputy`, `Group Leader`).
- **Strict Self-Review Invariant:**
  - A reviewer **cannot** review a submission if they submitted the proof (`submitted_by_id == reviewer_id`).
  - A reviewer **cannot** review a task if they are the primary assignee (`assigned_to_id == reviewer_id`).
  - Self-review attempts are rejected with `HTTP 403 Forbidden`.

---

### 4. API Endpoints Catalog

| Method | Endpoint | Required Permission | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/tasks/` | Authenticated | Scoped task list (Tier 1/2: all; Tier 3/4: team/created; Tier 5: assigned/team only). |
| `POST` | `/api/tasks/` | Tier 1, 2, 3 (`IsCoreLeadOrAbove`) | Creates a task with title, description, deadline, assigned user/team. |
| `GET` | `/api/tasks/<id>/` | Authenticated | Task details with deadline, assignment, and status. |
| `PATCH` | `/api/tasks/<id>/` | Creator or Tier 1/2 | Updates task title, description, deadline, or assignment. |
| `DELETE` | `/api/tasks/<id>/` | Creator or Tier 1 | Deletes task. |
| `POST` | `/api/tasks/<id>/start/` | Assigned User / Team | Transitions task from `Assigned` to `In Progress`. |
| `GET` | `/api/tasks/<id>/submissions/` | Authenticated | Chronological submission history of proofs for this task. |
| `GET` | `/api/tasks/<id>/reviews/` | Authenticated | Review decisions and feedback for this task. |
| `POST` | `/api/tasks/<id>/submit/` | Assigned User / Team | Submits evidence proof (GitHub URL, screenshots, description) and marks task `Submitted`. |
| `POST` | `/api/tasks/<id>/review/` | Authorized Reviewer (Non-Self) | Conducts review (`Approved` or `Changes Requested` with feedback). |
| `GET` | `/api/submissions/` | Authenticated | Read-only list of all task proofs (filterable by `?task_id=`). |
| `GET` | `/api/reviews/` | Authenticated | Read-only list of all reviews (filterable by `?task_id=`). |
| `GET` | `/api/leaderboard/` | Authenticated | Real-time community leaderboard ranked by points descending. |
| `GET` | `/api/announcements/` | Authenticated | Lists community announcements. |
| `POST` | `/api/announcements/` | Tier 1, 2, 3 (`IsCoreLeadOrAbove`) | Publishes a new announcement. |
| `GET` | `/api/activity/` | Authenticated | Scoped audit history logs (Tier 1/2: all; Tier 5: self actions). |

---

### 5. Representative Request & Response Payloads

#### A. Task Creation (`POST /api/tasks/`)
```json
// Request (from Core Team Lead)
{
  "title": "Build Task Submission REST API",
  "description": "Implement proof submission, review endpoints, and scoring logic.",
  "assigned_to_id": 5,
  "team_id": 3,
  "deadline": "2026-11-01T18:00:00Z"
}

// Response (201 Created)
{
  "task_id": 4,
  "title": "Build Task Submission REST API",
  "description": "Implement proof submission, review endpoints, and scoring logic.",
  "created_by": {
    "user_id": 3,
    "name": "Aarav Core Lead",
    "email": "aarav.lead@example.com",
    "role_id": 3,
    "role_name": "Core Team Lead",
    "team_id": 3,
    "team_name": "Development Team",
    "status": "Active",
    "role_tier": 3
  },
  "assigned_to": {
    "user_id": 5,
    "name": "Riya Member",
    "email": "riya.member@example.com",
    "role_id": 5,
    "role_name": "Member",
    "team_id": 3,
    "team_name": "Development Team",
    "status": "Active",
    "role_tier": 5
  },
  "team": 3,
  "team_name": "Development Team",
  "status": "Assigned",
  "deadline": "2026-11-01T18:00:00Z",
  "created_at": "2026-10-24T18:10:00Z",
  "proofs_count": 0,
  "is_overdue": false
}
```

#### B. Proof Submission (`POST /api/tasks/4/submit/`)
```json
// Request (from Riya Member)
{
  "github_link": "https://github.com/techneekx/submission-endpoints",
  "description": "Completed proof submission, reviews, and test cases."
}

// Response (201 Created)
{
  "message": "Proof submitted successfully. Task is now Submitted for review.",
  "proof": {
    "proof_id": 3,
    "task_id": 4,
    "task_title": "Build Task Submission REST API",
    "submitted_by": {
      "user_id": 5,
      "name": "Riya Member",
      "email": "riya.member@example.com",
      "role_id": 5,
      "role_name": "Member",
      "team_id": 3,
      "team_name": "Development Team",
      "status": "Active",
      "role_tier": 5
    },
    "github_link": "https://github.com/techneekx/submission-endpoints",
    "screenshots": null,
    "description": "Completed proof submission, reviews, and test cases.",
    "submitted_at": "2026-10-24T18:15:00Z"
  },
  "task_status": "Submitted"
}
```

#### C. Review Approval & Atomic Scoring (`POST /api/tasks/4/review/`)
```json
// Request (from Aarav Core Lead)
{
  "decision": "Approved",
  "feedback": "All test cases pass and clean architecture verified. Approved!"
}

// Response (201 Created)
{
  "message": "Review completed with decision 'Approved'.",
  "review": {
    "review_id": 2,
    "task_id": 4,
    "task_title": "Build Task Submission REST API",
    "proof_id": 3,
    "reviewer": {
      "user_id": 3,
      "name": "Aarav Core Lead",
      "email": "aarav.lead@example.com",
      "role_id": 3,
      "role_name": "Core Team Lead",
      "team_id": 3,
      "team_name": "Development Team",
      "status": "Active",
      "role_tier": 3
    },
    "decision": "Approved",
    "feedback": "All test cases pass and clean architecture verified. Approved!",
    "reviewed_at": "2026-10-24T18:20:00Z"
  },
  "task_status": "Approved",
  "points_awarded": 10,
  "scoring_info": "Successfully awarded 10 points to Riya Member."
}
```

#### D. Leaderboard (`GET /api/leaderboard/`)
```json
// Response (200 OK)
{
  "count": 3,
  "next": null,
  "previous": null,
  "results": [
    {
      "performance_id": 2,
      "user": {
        "user_id": 6,
        "name": "Kabir Member",
        "email": "kabir.member@example.com",
        "role_id": 5,
        "role_name": "Member",
        "team_id": 3,
        "team_name": "Development Team",
        "status": "Active",
        "role_tier": 5
      },
      "points": 35,
      "rank": 1,
      "updated_at": "2026-10-24T17:40:48.874134Z"
    },
    {
      "performance_id": 1,
      "user": {
        "user_id": 5,
        "name": "Riya Member",
        "email": "riya.member@example.com",
        "role_id": 5,
        "role_name": "Member",
        "team_id": 3,
        "team_name": "Development Team",
        "status": "Active",
        "role_tier": 5
      },
      "points": 30,
      "rank": 2,
      "updated_at": "2026-10-24T18:20:00Z"
    }
  ]
}
```
