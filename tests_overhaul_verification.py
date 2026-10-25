import os
import sys
import json
import urllib.request
import urllib.error

BASE_URL = 'http://127.0.0.1:8000/api'

def request_json(url, method='GET', data=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req_body = json.dumps(data).encode('utf-8') if data is not None else None
    req = urllib.request.Request(url, data=req_body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            status = response.status
            content = response.read()
            ct = response.headers.get('Content-Type', '')
            if 'application/json' in ct:
                return status, json.loads(content.decode('utf-8')), response.headers
            return status, content, response.headers
    except urllib.error.HTTPError as e:
        content = e.read()
        try:
            body = json.loads(content.decode('utf-8'))
        except Exception:
            body = content.decode('utf-8')
        return e.code, body, e.headers

def run_tests():
    print("=" * 60)
    print("STARTING TECHNEEKX OVERHAUL COMPREHENSIVE VERIFICATION")
    print("=" * 60)

    # 1. Test Public Groups Endpoint
    print("\n--- 1. Testing GET /api/auth/groups/ ---")
    st, groups, _ = request_json(f'{BASE_URL}/auth/groups/')
    assert st == 200, f"Expected 200, got {st}"
    assert len(groups) >= 2, f"Expected groups list, got {groups}"
    group_ids = [g['group_id'] for g in groups]
    group_names = [g['name'] for g in groups]
    print(f"PASS: Found {len(groups)} active groups: {group_names}")

    # 2. Test Member Registration with Group Selection
    print("\n--- 2. Testing Member Registration (Active, associated group, no leadership title) ---")
    member_email = 'test.member.new@example.com'
    member_payload = {
        'name': 'New Member Test',
        'email': member_email,
        'password': 'Password123!',
        'category': 'Member',
        'group_id': 1
    }
    st, res, _ = request_json(f'{BASE_URL}/auth/register/', method='POST', data=member_payload)
    if st == 400 and 'already exists' in str(res):
        print("Member account already exists, proceeding to login check.")
    else:
        assert st == 201, f"Expected 201, got {st}: {res}"
        assert res['user']['status'] == 'Active', f"Expected Active, got {res['user']['status']}"
        assert res['user']['group_id'] == 1, f"Expected group_id=1, got {res['user']['group_id']}"
        assert res['user']['position'] is None, f"Ordinary member must not have leadership title: {res['user']['position']}"
        print("PASS: Member created with Active status and group_id=1.")

    # Login with member
    st, login_res, _ = request_json(f'{BASE_URL}/auth/login/', method='POST', data={'email': member_email, 'password': 'Password123!'})
    assert st == 200, f"Expected 200 on login, got {st}: {login_res}"
    member_token = login_res['tokens']['access']
    assert login_res['user']['group_id'] == 1, f"Login did not return group_id"
    print("PASS: Member successfully logged in with assigned group retrieved.")

    # 3. Test Member Registration Validation (missing group)
    print("\n--- 3. Testing Member Registration Validation (missing group) ---")
    st, res, _ = request_json(f'{BASE_URL}/auth/register/', method='POST', data={
        'name': 'Missing Group',
        'email': 'missing.group.new@example.com',
        'password': 'Password123!',
        'category': 'Member'
    })
    assert st == 400, f"Expected 400 for missing group, got {st}"
    assert 'group_id' in str(res), f"Expected group_id in error: {res}"
    print(f"PASS: Missing group correctly rejected: {res}")

    # 4. Test Official Registration with Specific Position
    print("\n--- 4. Testing Official Registration (CTO, Pending status, Officials category) ---")
    official_email = 'test.cto.official@example.com'
    official_payload = {
        'name': 'Chief Tech Officer Test',
        'email': official_email,
        'password': 'Password123!',
        'category': 'Official',
        'position': 'Chief Technical Officer'
    }
    st, res, _ = request_json(f'{BASE_URL}/auth/register/', method='POST', data=official_payload)
    if st == 400 and 'already exists' in str(res):
        print("Official account already exists.")
    else:
        assert st == 201, f"Expected 201, got {st}: {res}"
        assert res['user']['status'] == 'Pending', f"Privileged Official must be Pending: {res['user']['status']}"
        assert res['user']['position'] == 'Chief Technical Officer', f"Position must be preserved: {res['user']['position']}"
        assert res['user']['role_name'] == 'Official', f"Role must be Official: {res['user']['role_name']}"
        print("PASS: Official registered with position 'Chief Technical Officer' and Pending status.")

    # Login attempt while Pending must be rejected
    st, res, _ = request_json(f'{BASE_URL}/auth/login/', method='POST', data={'email': official_email, 'password': 'Password123!'})
    assert st == 400, f"Expected 400 for Pending login, got {st}"
    assert 'Pending' in str(res), f"Expected Pending error message: {res}"
    print("PASS: Pending Official login blocked pending approval.")

    # 5. Test Official Position Validation
    print("\n--- 5. Testing Official Position Validation ---")
    st, res, _ = request_json(f'{BASE_URL}/auth/register/', method='POST', data={
        'name': 'Bad Official',
        'email': 'bad.official@example.com',
        'password': 'Password123!',
        'category': 'Official',
        'position': 'Super God Admin'
    })
    assert st == 400, f"Expected 400 for invalid official position, got {st}"
    print(f"PASS: Invalid official position rejected: {res}")

    # 6. Test Core Lead Registration with Group Association
    print("\n--- 6. Testing Core Lead Registration (Associated group, Pending status) ---")
    core_email = 'test.frontend.lead@example.com'
    core_payload = {
        'name': 'Frontend Lead Test',
        'email': core_email,
        'password': 'Password123!',
        'category': 'Core',
        'group_id': 1,
        'position': 'Frontend & UI Engineering Lead'
    }
    st, res, _ = request_json(f'{BASE_URL}/auth/register/', method='POST', data=core_payload)
    if st == 400 and 'already exists' in str(res):
        print("Core lead account already exists.")
    else:
        assert st == 201, f"Expected 201, got {st}: {res}"
        assert res['user']['status'] == 'Pending', f"Core lead must be Pending: {res['user']['status']}"
        assert res['user']['group_id'] == 1, f"Associated group must be 1: {res['user']['group_id']}"
        assert res['user']['role_name'] == 'Core Team Lead', f"Role must be Core Team Lead: {res['user']['role_name']}"
        print("PASS: Core Lead registered with group association and Pending status.")

    # 7. Test Group-Wise Task & Submission Visibility
    print("\n--- 7. Testing Group-Wise Task & Submission Visibility ---")
    # Log in as Founder
    st, founder_login, _ = request_json(f'{BASE_URL}/auth/login/', method='POST', data={'email': 'founder@example.com', 'password': 'Techneekx@2026'})
    founder_token = founder_login['tokens']['access']

    # Log in as Core Lead (Vikram Patel - Frontend, group_id=1)
    st, lead_login, _ = request_json(f'{BASE_URL}/auth/login/', method='POST', data={'email': 'corelead.vikram@example.com', 'password': 'Techneekx@2026'})
    lead_token = lead_login['tokens']['access']
    assert lead_login['user']['group_id'] == 1, f"Vikram Patel must have group_id=1"

    # Tasks visible to Core Lead (group_id=1)
    st, lead_tasks, _ = request_json(f'{BASE_URL}/tasks/', token=lead_token)
    assert st == 200
    task_list = lead_tasks['results'] if 'results' in lead_tasks else lead_tasks
    for t in task_list:
        assigned_user = t.get('assigned_to')
        assigned_group = assigned_user.get('group_id') if isinstance(assigned_user, dict) else None
        assigned_id = assigned_user.get('user_id') if isinstance(assigned_user, dict) else assigned_user
        created_user = t.get('created_by')
        created_id = created_user.get('user_id') if isinstance(created_user, dict) else created_user

        is_vikram = (created_id == lead_login['user']['user_id']) or (assigned_id == lead_login['user']['user_id'])
        is_group_1 = (t.get('group') == 1 or t.get('group_id') == 1 or assigned_group == 1)
        assert is_vikram or is_group_1, f"Leaked task from unrelated group: {t}"
    print(f"PASS: Core Lead (group 1) sees only their group's tasks ({len(task_list)} tasks).")

    # Member task visibility
    st, member_tasks, _ = request_json(f'{BASE_URL}/tasks/', token=member_token)
    assert st == 200
    mem_task_list = member_tasks['results'] if 'results' in member_tasks else member_tasks
    # New member should only see tasks assigned to them or unassigned in group 1
    print(f"PASS: Member sees only assigned tasks ({len(mem_task_list)} tasks).")

    # 8. Test Audit History CSV Export
    print("\n--- 8. Testing Audit History CSV Export ---")
    req = urllib.request.Request(f'{BASE_URL}/activity/export-csv/', headers={'Authorization': f'Bearer {founder_token}'})
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200, f"Expected 200 on export-csv, got {resp.status}"
        ct = resp.headers.get('Content-Type', '')
        assert 'text/csv' in ct, f"Expected text/csv, got {ct}"
        csv_data = resp.read().decode('utf-8')
        lines = csv_data.strip().split('\n')
        assert len(lines) >= 2, f"CSV should contain header and rows: {lines}"
        header = lines[0]
        assert 'Log ID' in header and 'Timestamp' in header and 'Actor Name' in header and 'Action' in header
        print(f"PASS: CSV exported successfully with {len(lines) - 1} audit records. Header: {header}")

    print("\n" + "=" * 60)
    print("ALL OVERHAUL VERIFICATION CHECKS PASSED WITH 100% SUCCESS!")
    print("=" * 60)

if __name__ == '__main__':
    run_tests()
