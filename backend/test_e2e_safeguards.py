import urllib.request
import json
import sys

def post(url, payload, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

def get(url, token):
    headers = {'Authorization': f'Bearer {token}'}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

def run_checks():
    print("=== 1. TESTING 4-LEVEL LOGINS & ROLES ===")
    users_to_test = [
        ('founder@example.com', 'Founder', 1, 'Founder'),
        ('director.ops@example.com', 'Director of Core Operations', 3, 'Director of Core Operations'),
        ('corelead.vikram@example.com', 'Core Team Lead', 4, 'Core Leads'),
        ('member.dev@example.com', 'Member', 5, 'Members')
    ]

    for email, expected_role, expected_level, expected_category in users_to_test:
        code, res = post('http://127.0.0.1:8000/api/auth/login/', {'email': email, 'password': 'Techneekx@2026'})
        if code != 200:
            print(f"[FAIL] Login failed for {email}: {res}")
            sys.exit(1)
        u = res['user']
        role_name = u['role']['name']
        level = u.get('hierarchy_level')
        category = u.get('category')
        print(f"[PASS] {u['name']} -> Role: {role_name} (Level {level}, Category: {category})")
        assert role_name == expected_role
        assert level == expected_level
        assert category == expected_category

    print("\n=== 2. STRICT BACKEND DATA ISOLATION & PERMISSION GUARDS ===")
    # Member token
    _, m_res = post('http://127.0.0.1:8000/api/auth/login/', {'email': 'member.dev@example.com', 'password': 'Techneekx@2026'})
    member_token = m_res['tokens']['access']

    # Member cannot create groups
    code, res = post('http://127.0.0.1:8000/api/groups/', {'name': 'Unauthorized Group', 'team': 1}, member_token)
    assert code == 403, f"Security breach: Member could create group! Code: {code}"
    print("[PASS] Member blocked from group administration (HTTP 403)")

    # Member cannot post official announcements
    code, res = post('http://127.0.0.1:8000/api/announcements/', {'title': 'Hack announcement', 'content': 'spam'}, member_token)
    assert code == 403, f"Security breach: Member could post announcement! Code: {code}"
    print("[PASS] Member blocked from publishing announcements (HTTP 403)")

    # Core Lead token
    _, l_res = post('http://127.0.0.1:8000/api/auth/login/', {'email': 'corelead.vikram@example.com', 'password': 'Techneekx@2026'})
    lead_token = l_res['tokens']['access']

    # Core Lead cannot post official announcements by default
    code, res = post('http://127.0.0.1:8000/api/announcements/', {'title': 'Lead Announcement', 'content': 'test'}, lead_token)
    assert code == 403, f"Security breach: Core Lead could post announcement! Code: {code}"
    print("[PASS] Core Lead blocked from publishing official announcements (HTTP 403)")

    # Founder token can post announcements
    _, f_res = post('http://127.0.0.1:8000/api/auth/login/', {'email': 'founder@example.com', 'password': 'Techneekx@2026'})
    founder_token = f_res['tokens']['access']
    code, res = post('http://127.0.0.1:8000/api/announcements/', {
        'title': 'Official Sprint Directive',
        'content': 'All quarterly milestones verified.'
    }, founder_token)
    assert code == 201, f"Founder failed to create announcement: {res}"
    print("[PASS] Official Team authorized to publish announcements (HTTP 201)")

    print("\n=== 3. BOARD COMPLIANCE & MONITORING SYSTEM ===")
    _, b_res = post('http://127.0.0.1:8000/api/auth/login/', {'email': 'director.ops@example.com', 'password': 'Techneekx@2026'})
    board_token = b_res['tokens']['access']

    # Board metrics endpoint
    code, b_metrics = get('http://127.0.0.1:8000/api/board/metrics/', board_token)
    assert code == 200, f"Board metrics retrieval failed: {b_metrics}"
    print(f"[PASS] Board Monitoring Metrics: Overdue={b_metrics['total_overdue']}, Missing={b_metrics['total_missing_reports']}, ActiveWarnings={b_metrics['total_active_warnings']}")

    # Board Warning issuance
    code, w_res = post('http://127.0.0.1:8000/api/board/warnings/', {
        'target_user_id': m_res['user']['user_id'],
        'reason': 'Overdue sprint deliverable for E2E testing.'
    }, board_token)
    if code == 201:
        print(f"[PASS] Board warning issued successfully (Warning ID: {w_res['warning_id']})")
    elif code == 400 and 'already has 5 active warnings' in str(w_res):
        print(f"[PASS] Board warning guard verified: Member reached 5-warning cap and was flagged for Official removal review.")
    else:
        assert False, f"Board failed to issue warning: {w_res}"

    print("\n=== 4. REGISTRATION SAFEGUARDS & ROLE ESCALATION PREVENTION ===")
    # Attempt to register as privileged CTO
    import time
    test_email = f'attempt_privilege_{int(time.time())}@example.com'
    code, reg_res = post('http://127.0.0.1:8000/api/auth/register/', {
        'name': 'Escalation Attempter',
        'email': test_email,
        'password': 'Password123!',
        'category': 'Official',
        'position': 'Chief Technical Officer'
    })
    assert code == 201, f"Registration failed: {reg_res}"
    assert reg_res['user']['status'] == 'Pending', f"Privileged registration was not set to Pending! {reg_res}"
    print(f"[PASS] Privileged registration intercepted: User created with status='{reg_res['user']['status']}'")

    # Attempt login with pending account
    code, login_res = post('http://127.0.0.1:8000/api/auth/login/', {
        'email': test_email,
        'password': 'Password123!'
    })
    assert code == 400, f"Pending account was permitted to log in! {login_res}"
    print(f"[PASS] Pending user login prevented: '{login_res.get('non_field_errors', [login_res])[0]}'")

    print("\n=== ALL E2E VERIFICATION CHECKS PASSED WITH 100% SUCCESS ===")

if __name__ == '__main__':
    run_checks()
