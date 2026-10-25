import os
import sys
import json
import urllib.request
import urllib.error

BASE_URL = 'http://127.0.0.1:8000/api'

def http_get(path):
    req = urllib.request.Request(f"{BASE_URL}{path}", headers={'Accept': 'application/json'})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def http_post(path, data):
    body = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=body,
        headers={'Content-Type': 'application/json', 'Accept': 'application/json'}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def run_tests():
    print("=================================================================")
    print("VERIFYING DYNAMIC DEMO ACCOUNT SYSTEM (TechNeekX)")
    print("=================================================================")

    # 1. Inspect Demo Accounts endpoint
    print("\n[Step 1] Fetching GET /api/auth/demo-accounts/ ...")
    demo_accounts = http_get('/auth/demo-accounts/')
    print(f"-> Total demo accounts returned: {len(demo_accounts)}")
    assert len(demo_accounts) >= 17, f"Expected at least 17 demo accounts, got {len(demo_accounts)}"

    # Check data integrity & security
    emails = set()
    categories = set()
    for acc in demo_accounts:
        emails.add(acc['email'])
        categories.add(acc.get('category'))
        
        # Security checks: NO secrets exposed
        assert 'password' not in acc, f"SECURITY LEAK: 'password' found in {acc['email']}"
        assert 'password_hash' not in acc, f"SECURITY LEAK: 'password_hash' found in {acc['email']}"
        assert 'token' not in acc, f"SECURITY LEAK: 'token' found in {acc['email']}"
        assert 'access' not in acc, f"SECURITY LEAK: 'access' found in {acc['email']}"
        assert 'refresh' not in acc, f"SECURITY LEAK: 'refresh' found in {acc['email']}"

        # Field validation
        assert acc.get('name'), f"Missing name for {acc['email']}"
        assert acc.get('role'), f"Missing role for {acc['email']}"
        assert acc.get('tier') in (1, 2, 3, 4, 5), f"Invalid tier for {acc['email']}"
        assert acc.get('hierarchy_level') in (1, 2, 3, 4, 5), f"Invalid hierarchy_level for {acc['email']}"
        assert acc.get('description'), f"Missing description for {acc['email']}"

    print(f"-> Verified all 5 canonical categories present: {categories}")
    expected_categories = {'Founder', 'Officials', 'Director of Core Operations', 'Core Leads', 'Members'}
    assert expected_categories.issubset(categories), f"Missing categories: {expected_categories - categories}"
    print("-> Security verified: 0 credentials or secrets exposed in API response.")

    # 2. Test dynamic login for sample accounts across different tiers
    print("\n[Step 2] Testing real JWT login for demo accounts...")
    test_emails = [
        'founder@example.com',
        'official@example.com',
        'director.ops@example.com',
        'corelead.vikram@example.com',
        'member.dev@example.com'
    ]
    for email in test_emails:
        assert email in emails, f"Demo account {email} not found in seeded list"
        login_res = http_post('/auth/login/', {'email': email, 'password': 'Techneekx@2026'})
        assert 'tokens' in login_res and 'access' in login_res['tokens'], f"Login failed for {email}"
        user_data = login_res.get('user', {})
        assert user_data.get('email') == email, f"User email mismatch for {email}"
        print(f"   [OK] Authenticated: {email} as {user_data.get('name')} (Role: {user_data.get('role_name')})")

    # 3. Test reflection of database changes (Add new seeded demo user)
    print("\n[Step 3] Testing dynamic reflection when database seed changes...")
    import django
    sys.path.append(os.path.abspath('backend'))
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    django.setup()

    from apps.accounts.models import User, Role
    from apps.teams.models import Group

    test_demo_email = 'member.testdynamic@example.com'
    member_role = Role.objects.get(name='Member')
    frontend_group = Group.objects.filter(name__icontains='Frontend').first()

    # Create new demo user in DB
    new_user, created = User.objects.update_or_create(
        email=test_demo_email,
        defaults={
            'name': 'Dynamic Test Member',
            'role': member_role,
            'group': frontend_group,
            'position': 'Interactive Tester',
            'is_demo': True,
            'status': 'Active'
        }
    )
    new_user.set_password('Techneekx@2026')
    new_user.save()
    print(f"-> Created new seeded demo user in DB: {test_demo_email}")

    # Immediately query the API without any frontend modification
    updated_demos = http_get('/auth/demo-accounts/')
    updated_emails = [d['email'] for d in updated_demos]
    assert test_demo_email in updated_emails, f"Newly seeded user {test_demo_email} did not appear dynamically in API!"
    new_demo_item = next(d for d in updated_demos if d['email'] == test_demo_email)
    print(f"-> Successfully reflected in API: {new_demo_item['name']} ({new_demo_item['label']})")
    assert new_demo_item['category'] == 'Members'
    assert new_demo_item['tier'] == 5

    # 4. Test account deactivation / removal reflection
    print("\n[Step 4] Testing graceful handling of Inactive demo accounts...")
    new_user.status = 'Inactive'
    new_user.save()

    updated_demos_after_deactivation = http_get('/auth/demo-accounts/')
    emails_after_deactivation = [d['email'] for d in updated_demos_after_deactivation]
    assert test_demo_email not in emails_after_deactivation, "Inactive demo account should NOT appear in API!"
    print(f"-> Verified: Deactivated demo user {test_demo_email} immediately disappeared from public API.")

    # Clean up test user
    new_user.delete()
    print("-> Test demo user cleanly removed.")

    # 5. Security Boundary Check: Wrong password should be rejected
    print("\n[Step 5] Security boundary: Unauthorized login attempts are strictly rejected...")
    try:
        http_post('/auth/login/', {'email': 'founder@example.com', 'password': 'WrongPassword123!'})
        assert False, "Unauthorized login should have thrown HTTPError 400"
    except urllib.error.HTTPError as e:
        assert e.code == 400
        print("   [OK] Unauthorized login with invalid password returned HTTP 400.")

    print("\n=================================================================")
    print("ALL DYNAMIC DEMO ACCOUNT VERIFICATIONS PASSED SUCCESSFULLY! (5/5)")
    print("=================================================================")

if __name__ == '__main__':
    run_tests()
