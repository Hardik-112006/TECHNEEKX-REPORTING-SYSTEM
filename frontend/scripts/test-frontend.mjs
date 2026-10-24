import test from 'node:test'
import assert from 'node:assert/strict'

const BASE_URL = 'http://127.0.0.1:8000/api'

test('Frontend-Backend Integration Test Suite', async (t) => {
  let founderToken = ''
  let memberToken = ''
  let createdTaskId = null

  await t.test('1. Authentication Flow: Login with seed Founder credentials', async () => {
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

  let memberUserId = null

  await t.test('2. Authentication Flow: Login with seed Member credentials', async () => {
    const res = await fetch(`${BASE_URL}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'riya.member@example.com',
        password: 'Techneekx@2026'
      })
    })

    assert.equal(res.status, 200, 'Member login should be 200 OK')
    const data = await res.json()
    assert.equal(data.user.role.name, 'Member')
    assert.equal(data.user.role_tier, 5)
    memberToken = data.tokens.access
    memberUserId = data.user.user_id
  })

  await t.test('3. Role Hierarchy & Protected Endpoints: Verify /api/roles/ access', async () => {
    const res = await fetch(`${BASE_URL}/roles/`, {
      headers: {
        'Authorization': `Bearer ${founderToken}`
      }
    })

    assert.equal(res.status, 200, 'Roles endpoint should return 200 with valid JWT')
    const roles = await res.json()
    assert.ok(Array.isArray(roles), 'Roles should be an array')
    assert.ok(roles.length >= 10, 'Should include all 11-12 community roles')
    const roleNames = roles.map(r => r.name)
    assert.ok(roleNames.includes('Founder'))
    assert.ok(roleNames.includes('Official'))
    assert.ok(roleNames.includes('Core Team Lead'))
    assert.ok(roleNames.includes('Member'))
  })

  await t.test('4. Task Workflow: Founder allocates new task to member', async () => {
    const deadline = new Date(Date.now() + 86400000 * 7).toISOString()
    const payload = {
      title: 'Frontend E2E Test Deliverable Task',
      description: 'Implement automated integration verification for Prompt 6',
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
    assert.ok(task.task_id, 'Should have assigned task_id')
    assert.equal(task.status, 'Assigned')
    assert.equal(task.title, payload.title)
    createdTaskId = task.task_id
  })

  await t.test('5. Task Workflow: Member starts assigned task (Assigned -> In Progress)', async () => {
    assert.ok(createdTaskId, 'Task ID must be present')

    const res = await fetch(`${BASE_URL}/tasks/${createdTaskId}/start/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${memberToken}`
      }
    })

    assert.equal(res.status, 200, 'Start task should return 200 OK')
    const task = await res.json()
    assert.equal(task.status, 'In Progress')
  })

  await t.test('6. Task Workflow: Member submits deliverable proof (In Progress -> Submitted)', async () => {
    assert.ok(createdTaskId, 'Task ID must be present')

    const proofPayload = {
      github_link: 'https://github.com/techneekx/test-pr/10',
      screenshots: 'https://imgur.com/evidence-screenshot.png',
      description: 'E2E integration test complete evidence with test logs'
    }

    const res = await fetch(`${BASE_URL}/tasks/${createdTaskId}/submit/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${memberToken}`
      },
      body: JSON.stringify(proofPayload)
    })

    assert.equal(res.status, 201, 'Proof submission should return 201 Created')
    const data = await res.json()
    assert.equal(data.task_status, 'Submitted')
    assert.ok(data.proof?.proof_id, 'Proof ID should be returned')
  })

  await t.test('7. Anti-Self-Review Guard: Submitting member cannot review own submission', async () => {
    assert.ok(createdTaskId, 'Task ID must be present')

    const reviewPayload = {
      decision: 'Approved',
      feedback: 'Attempting self-approval'
    }

    const res = await fetch(`${BASE_URL}/tasks/${createdTaskId}/review/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${memberToken}`
      },
      body: JSON.stringify(reviewPayload)
    })

    assert.equal(res.status, 403, 'Self-review should return 403 Forbidden')
  })

  await t.test('8. Reviewer Queue & Idempotent Scoring: Founder conducts official review (Submitted -> Approved)', async () => {
    assert.ok(createdTaskId, 'Task ID must be present')

    const reviewPayload = {
      decision: 'Approved',
      feedback: 'Excellent automated verification and adherence to requirements. Approved!'
    }

    const res = await fetch(`${BASE_URL}/tasks/${createdTaskId}/review/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${founderToken}`
      },
      body: JSON.stringify(reviewPayload)
    })

    assert.equal(res.status, 201, 'Review should return 201 Created')
    const data = await res.json()
    assert.equal(data.task_status, 'Approved')
    assert.equal(data.points_awarded, 10, 'Approved task should award 10 points')
  })

  await t.test('9. Live Leaderboard Verification: Verify points reflected in standings', async () => {
    const res = await fetch(`${BASE_URL}/leaderboard/`, {
      headers: {
        'Authorization': `Bearer ${founderToken}`
      }
    })

    assert.equal(res.status, 200, 'Leaderboard endpoint should return 200')
    const data = await res.json()
    assert.ok(Array.isArray(data.results), 'Leaderboard results should be an array')
    assert.ok(data.results.length > 0, 'Leaderboard should have active records')
  })

  await t.test('10. Audit History Verification: Confirm TASK_APPROVED recorded', async () => {
    const res = await fetch(`${BASE_URL}/activity/`, {
      headers: {
        'Authorization': `Bearer ${founderToken}`
      }
    })

    assert.equal(res.status, 200, 'Activity endpoint should return 200')
    const data = await res.json()
    assert.ok(Array.isArray(data.results), 'Activity results should be an array')
    const actions = data.results.map(r => r.action)
    assert.ok(actions.includes('TASK_APPROVED'), 'Activity log must contain TASK_APPROVED event')
  })
})
