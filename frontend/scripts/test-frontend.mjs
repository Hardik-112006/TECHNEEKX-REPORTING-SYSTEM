import test from 'node:test'
import assert from 'node:assert/strict'

const BASE_URL = 'http://127.0.0.1:8000/api'

test('Comprehensive Acceptance, Security, & Boundary Test Suite', async (t) => {
  let founderToken = ''
  let memberToken = ''
  let secondMemberToken = ''
  let memberUserId = null
  let createdTaskId = null

  // 1. Unauthenticated Security Boundary
  await t.test('1. Security Boundary: Unauthenticated requests strictly rejected (401)', async () => {
    const protectedUrls = ['/auth/me/', '/tasks/', '/teams/', '/activity/', '/roles/']
    for (const path of protectedUrls) {
      const res = await fetch(`${BASE_URL}${path}`)
      assert.equal(res.status, 401, `Unauthenticated request to ${path} must return 401 Unauthorized`)
    }
  })

  // 2. Authentication Flows
  await t.test('2. Authentication Flow: Login with seed Founder credentials', async () => {
    const res = await fetch(`${BASE_URL}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'founder@example.com',
        password: 'Techneekx@2026'
      })
    })

    assert.equal(res.status, 200, 'Login response should be 200 OK')
    const data = await res.json()
    assert.ok(data.tokens?.access, 'Should return access token')
    assert.ok(data.tokens?.refresh, 'Should return refresh token')
    assert.equal(data.user.role.name, 'Founder')
    assert.equal(data.user.role_tier, 1)
    founderToken = data.tokens.access
  })

  await t.test('3. Authentication Flow: Login with seed Member credentials', async () => {
    const res = await fetch(`${BASE_URL}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'member.dev@example.com',
        password: 'Techneekx@2026'
      })
    })

    assert.equal(res.status, 200, 'Member login should be 200 OK')
    const data = await res.json()
    assert.equal(data.user.role.name, 'Member')
    assert.equal(data.user.role_tier, 4)
    memberToken = data.tokens.access
    memberUserId = data.user.user_id
  })

  await t.test('4. Authentication Flow: Login with second Member (Kavya)', async () => {
    const res = await fetch(`${BASE_URL}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'member.kavya@example.com',
        password: 'Techneekx@2026'
      })
    })

    assert.equal(res.status, 200, 'Second member login should be 200 OK')
    const data = await res.json()
    assert.equal(data.user.role.name, 'Member')
    secondMemberToken = data.tokens.access
  })

  // 3. Permission Boundaries for Members
  await t.test('5. Permission Boundary: Members cannot create tasks directly (403)', async () => {
    const res = await fetch(`${BASE_URL}/tasks/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${memberToken}`
      },
      body: JSON.stringify({
        title: 'Unauthorized Task',
        description: 'Should be rejected',
        deadline: new Date(Date.now() + 86400000).toISOString(),
        assigned_to_id: memberUserId
      })
    })

    assert.equal(res.status, 403, 'Member should be forbidden from creating tasks')
  })

  await t.test('6. Permission Boundary: Members cannot post announcements (403)', async () => {
    const res = await fetch(`${BASE_URL}/announcements/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${memberToken}`
      },
      body: JSON.stringify({
        title: 'Unauthorized Announcement',
        content: 'Should be rejected'
      })
    })

    assert.equal(res.status, 403, 'Member should be forbidden from posting announcements')
  })

  // 4. Core Acceptance Scenario: Full Lifecycle with Changes Requested & Resubmission
  await t.test('7. Task Workflow: Founder allocates task to member (Assigned)', async () => {
    const deadline = new Date(Date.now() + 86400000 * 7).toISOString()
    const payload = {
      title: 'Full Lifecycle Deliverable Verification',
      description: 'End-to-end task exercising state transitions and review correction',
      deadline: deadline,
      assigned_to_id: memberUserId
    }

    const res = await fetch(`${BASE_URL}/tasks/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${founderToken}`
      },
      body: JSON.stringify(payload)
    })

    assert.equal(res.status, 201, 'Task creation should return 201 Created')
    const task = await res.json()
    assert.ok(task.task_id, 'Should return task_id')
    assert.equal(task.status, 'Assigned')
    createdTaskId = task.task_id
  })

  await t.test('8. Task Workflow: Member starts assigned task (Assigned -> In Progress)', async () => {
    assert.ok(createdTaskId)
    const res = await fetch(`${BASE_URL}/tasks/${createdTaskId}/start/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${memberToken}` }
    })

    assert.equal(res.status, 200)
    const task = await res.json()
    assert.equal(task.status, 'In Progress')
  })

  await t.test('9. Task Workflow: Member submits initial proof (In Progress -> Submitted)', async () => {
    assert.ok(createdTaskId)
    const res = await fetch(`${BASE_URL}/tasks/${createdTaskId}/submit/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${memberToken}`
      },
      body: JSON.stringify({
        github_link: 'https://github.com/techneekx/pr/1',
        description: 'Initial draft deliverable'
      })
    })

    assert.equal(res.status, 201)
    const data = await res.json()
    assert.equal(data.task_status, 'Submitted')
  })

  await t.test('10. Reviewer Feedback: Reviewer requests changes with mandatory feedback (Submitted -> Changes Requested)', async () => {
    assert.ok(createdTaskId)
    const res = await fetch(`${BASE_URL}/tasks/${createdTaskId}/review/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${founderToken}`
      },
      body: JSON.stringify({
        decision: 'Changes Requested',
        feedback: 'Please include unit tests and complete the documentation section before approval.'
      })
    })

    assert.equal(res.status, 201)
    const data = await res.json()
    assert.equal(data.task_status, 'Changes Requested')
    assert.equal(data.points_awarded, 0, 'No points should be awarded when changes are requested')
  })

  await t.test('11. Member Resubmission: Member addresses feedback and resubmits corrected proof (Changes Requested -> Submitted)', async () => {
    assert.ok(createdTaskId)
    const res = await fetch(`${BASE_URL}/tasks/${createdTaskId}/submit/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${memberToken}`
      },
      body: JSON.stringify({
        github_link: 'https://github.com/techneekx/pr/1-corrected',
        screenshots: 'https://imgur.com/all-tests-passing.png',
        description: 'Added comprehensive test suite with 100% passing tests and complete documentation.'
      })
    })

    assert.equal(res.status, 201)
    const data = await res.json()
    assert.equal(data.task_status, 'Submitted')
  })

  await t.test('12. Security Boundary: Self-review strictly blocked (403)', async () => {
    assert.ok(createdTaskId)
    const res = await fetch(`${BASE_URL}/tasks/${createdTaskId}/review/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${memberToken}`
      },
      body: JSON.stringify({
        decision: 'Approved',
        feedback: 'Member trying to approve own deliverable'
      })
    })

    assert.equal(res.status, 403, 'Self-review must be forbidden')
  })

  await t.test('13. Security Boundary: Unassigned peer member cannot review (403)', async () => {
    assert.ok(createdTaskId)
    const res = await fetch(`${BASE_URL}/tasks/${createdTaskId}/review/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secondMemberToken}`
      },
      body: JSON.stringify({
        decision: 'Approved',
        feedback: 'Peer member trying to approve'
      })
    })

    assert.equal(res.status, 403, 'Peer member without lead tier must be forbidden from reviewing')
  })

  await t.test('14. Review Approval: Official reviewer approves corrected submission (Submitted -> Approved)', async () => {
    assert.ok(createdTaskId)
    const res = await fetch(`${BASE_URL}/tasks/${createdTaskId}/review/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${founderToken}`
      },
      body: JSON.stringify({
        decision: 'Approved',
        feedback: 'All feedback addressed thoroughly. Excellent quality work!'
      })
    })

    assert.equal(res.status, 201)
    const data = await res.json()
    assert.equal(data.task_status, 'Approved')
    assert.equal(data.points_awarded, 10, 'Approved task must award exactly 10 points')
  })

  // 5. Invariant Checks: Idempotent Scoring & Invalid Transitions
  await t.test('15. Idempotent Scoring Guard: Re-reviewing an approved task is rejected', async () => {
    assert.ok(createdTaskId)
    const res = await fetch(`${BASE_URL}/tasks/${createdTaskId}/review/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${founderToken}`
      },
      body: JSON.stringify({
        decision: 'Approved',
        feedback: 'Duplicate review attempt'
      })
    })

    assert.equal(res.status, 400, 'Re-reviewing an already approved task must return 400 Bad Request')
  })

  await t.test('16. State Machine Integrity: Cannot start an already Approved task', async () => {
    assert.ok(createdTaskId)
    const res = await fetch(`${BASE_URL}/tasks/${createdTaskId}/start/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${memberToken}` }
    })

    assert.equal(res.status, 400, 'Starting an already approved task must return 400 Bad Request')
  })

  // 6. Community Data Verification: Leaderboard, Announcements & Audit Trail
  await t.test('17. Live Leaderboard Verification: Active rankings reflected', async () => {
    const res = await fetch(`${BASE_URL}/leaderboard/`, {
      headers: { 'Authorization': `Bearer ${founderToken}` }
    })

    assert.equal(res.status, 200)
    const data = await res.json()
    assert.ok(Array.isArray(data.results))
    assert.ok(data.results.length > 0)
    const memberEntry = data.results.find(p => p.user.user_id === memberUserId)
    assert.ok(memberEntry, 'Member performance entry must exist')
    assert.ok(memberEntry.points >= 10, 'Member should have at least 10 points')
  })

  await t.test('18. Community Announcements: Public announcements readable by all roles', async () => {
    const res = await fetch(`${BASE_URL}/announcements/`, {
      headers: { 'Authorization': `Bearer ${memberToken}` }
    })

    assert.equal(res.status, 200)
    const data = await res.json()
    assert.ok(Array.isArray(data.results))
  })

  await t.test('19. Audit Trail Verification: All lifecycle events recorded', async () => {
    const res = await fetch(`${BASE_URL}/activity/`, {
      headers: { 'Authorization': `Bearer ${founderToken}` }
    })

    assert.equal(res.status, 200)
    const data = await res.json()
    assert.ok(Array.isArray(data.results))
    const actions = data.results.map(r => r.action)
    assert.ok(actions.includes('TASK_CREATED'), 'Audit trail must contain TASK_CREATED')
    assert.ok(actions.includes('PROOF_SUBMITTED'), 'Audit trail must contain PROOF_SUBMITTED')
    assert.ok(actions.includes('CHANGES_REQUESTED'), 'Audit trail must contain CHANGES_REQUESTED')
    assert.ok(actions.includes('TASK_APPROVED'), 'Audit trail must contain TASK_APPROVED')
  })
})
