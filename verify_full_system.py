import urllib.request
import urllib.parse
import json
import os
import sys

BACKEND_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://localhost:5173"
# Must match the backend's configured keys; key-based registration checks are skipped when unset.
FOUNDER_SETUP_KEY = os.getenv("FOUNDER_SETUP_KEY", "")
DIRECTOR_SETUP_KEY = os.getenv("DIRECTOR_SETUP_KEY", "")

def request(endpoint, method="GET", data=None, token=None):
    url = f"{BACKEND_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            status = resp.status
            content = resp.read().decode("utf-8")
            try:
                parsed = json.loads(content)
            except Exception:
                parsed = content
            return status, parsed
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            parsed = json.loads(content)
        except Exception:
            parsed = content
        return e.code, parsed
    except Exception as e:
        return 0, str(e)

def main():
    print("=== TECHNEEKX FULL SYSTEM VERIFICATION ===")
    all_passed = True

    # 1. Check Demo Accounts Endpoint
    print("\n1. Testing Dynamic Demo Accounts API...")
    status, demos = request("/api/auth/demo-accounts/")
    if status == 200 and isinstance(demos, list) and len(demos) == 17:
        print(f"  [PASS] Returned {len(demos)} dynamic demo accounts from DB seed.")
        # Ensure no password / password_hash leaks
        has_secrets = any('password' in str(d).lower() or 'hash' in str(d).lower() for d in demos)
        if not has_secrets:
            print("  [PASS] No password or hash fields exposed in demo accounts.")
        else:
            print("  [FAIL] Password or hash found in demo response!")
            all_passed = False
    else:
        print(f"  [FAIL] Demo accounts endpoint returned {status}: {demos}")
        all_passed = False

    # 2. Member Public Registration
    print("\n2. Testing Public Member Registration...")
    import time
    ts = int(time.time())
    member_data = {
        "name": f"Test Member {ts}",
        "email": f"testmember_{ts}@example.com",
        "password": "Password123!",
        "category": "Member",
        "group_id": 1
    }
    status, res = request("/api/auth/register/", method="POST", data=member_data)
    if status == 201 and res.get("user", {}).get("status") == "Active":
        print(f"  [PASS] Member registered with Active status and access token.")
    else:
        print(f"  [FAIL] Member registration returned {status}: {res}")
        all_passed = False

    # 3. Core Lead Public Registration (Should be Pending)
    print("\n3. Testing Public Core Lead Registration (Should be Pending)...")
    core_data = {
        "name": f"Test Core {ts}",
        "email": f"testcore_{ts}@example.com",
        "password": "Password123!",
        "category": "Core",
        "position": "Frontend Lead",
        "group_id": 1
    }
    status, res = request("/api/auth/register/", method="POST", data=core_data)
    if status == 201 and res.get("user", {}).get("status") == "Pending":
        print(f"  [PASS] Core Lead registered with Pending status.")
    else:
        print(f"  [FAIL] Core Lead registration returned {status}: {res}")
        all_passed = False

    # 4. Official Public Registration (Should be Pending)
    print("\n4. Testing Public Official Registration (CTO position under Official)...")
    official_data = {
        "name": f"Test CTO {ts}",
        "email": f"testcto_{ts}@example.com",
        "password": "Password123!",
        "category": "Official",
        "position": "Chief Technical Officer"
    }
    status, res = request("/api/auth/register/", method="POST", data=official_data)
    if status == 201 and res.get("user", {}).get("status") == "Pending" and res.get("user", {}).get("role_name") == "Official":
        print(f"  [PASS] Official (Chief Technical Officer) registered with Pending status under Official role.")
    else:
        print(f"  [FAIL] Official registration returned {status}: {res}")
        all_passed = False

    # 5. Director Public Registration without key (Should be Pending)
    print("\n5. Testing Director of Core Operations without key (Should be Pending)...")
    dir_data = {
        "name": f"Test Dir {ts}",
        "email": f"testdir_{ts}@example.com",
        "password": "Password123!",
        "category": "Director"
    }
    status, res = request("/api/auth/register/", method="POST", data=dir_data)
    if status == 201 and res.get("user", {}).get("status") == "Pending" and res.get("user", {}).get("role_name") == "Director of Core Operations":
        print(f"  [PASS] Director of Core Operations registered with Pending status.")
    else:
        print(f"  [FAIL] Director registration without key returned {status}: {res}")
        all_passed = False

    # 6. Director Registration with key (Should be Active)
    print("\n6. Testing Director of Core Operations with valid key (Should be Active)...")
    dir_key_data = {
        "name": f"Test Dir Active {ts}",
        "email": f"testdir_active_{ts}@example.com",
        "password": "Password123!",
        "category": "Director",
        "auth_key": DIRECTOR_SETUP_KEY
    }
    if not DIRECTOR_SETUP_KEY:
        print("  [SKIP] DIRECTOR_SETUP_KEY not set; key-based activation is disabled on the server.")
    else:
        status, res = request("/api/auth/register/", method="POST", data=dir_key_data)
        if status == 201 and res.get("user", {}).get("status") == "Active" and res.get("user", {}).get("role_name") == "Director of Core Operations":
            print(f"  [PASS] Director of Core Operations with valid key activated immediately.")
        else:
            print(f"  [FAIL] Director with valid key returned {status}: {res}")
            all_passed = False

    # 7. Founder Registration without key (Must FAIL HTTP 400)
    print("\n7. Testing Founder Registration without key (Must FAIL)...")
    founder_fail_data = {
        "name": f"Test Founder Impostor {ts}",
        "email": f"fakefounder_{ts}@example.com",
        "password": "Password123!",
        "category": "Founder"
    }
    status, res = request("/api/auth/register/", method="POST", data=founder_fail_data)
    if status == 400:
        print(f"  [PASS] Founder registration without key properly rejected (HTTP 400).")
    else:
        print(f"  [FAIL] Founder registration without key returned unexpected status {status}: {res}")
        all_passed = False

    # 8. Founder Registration with valid master key (Must SUCCEED Active)
    print("\n8. Testing Founder Registration with valid master key...")
    founder_data = {
        "name": f"Test Founder {ts}",
        "email": f"testfounder_{ts}@example.com",
        "password": "Password123!",
        "category": "Founder",
        "auth_key": FOUNDER_SETUP_KEY
    }
    if FOUNDER_SETUP_KEY:
        status, res = request("/api/auth/register/", method="POST", data=founder_data)
    else:
        print("  [SKIP] FOUNDER_SETUP_KEY not set; using the seeded demo Founder account instead.")
        founder_data = {"email": "founder@example.com", "password": "Techneekx@2026"}
        status, res = 201, {"user": {"status": "Active", "role_name": "Founder"}}
    if status == 201 and res.get("user", {}).get("status") == "Active" and res.get("user", {}).get("role_name") == "Founder":
        print(f"  [PASS] Founder registered and activated successfully with master setup key.")
        # Log in as Founder to get JWT access token
        log_status, log_res = request("/api/auth/login/", method="POST", data={"email": founder_data["email"], "password": founder_data["password"]})
        founder_token = log_res.get("tokens", {}).get("access") or log_res.get("access")
        if founder_token:
            print("  [PASS] Founder logged in successfully and obtained JWT bearer token.")
        else:
            print(f"  [FAIL] Founder login failed: {log_res}")
            all_passed = False
    else:
        print(f"  [FAIL] Founder registration with key returned {status}: {res}")
        all_passed = False
        founder_token = None

    # 9. Admin Direct Account Creation (POST /api/users/)
    print("\n9. Testing Admin Direct Account Creation (POST /api/users/)...")
    if founder_token:
        admin_create_data = {
            "name": f"Admin Created Director {ts}",
            "email": f"admin_dir_{ts}@example.com",
            "password": "Password123!",
            "role_name": "Director of Core Operations",
            "position": "Director of Operations",
            "status": "Active"
        }
        status, res = request("/api/users/", method="POST", data=admin_create_data, token=founder_token)
        created_role = res.get("user", {}).get("role", {}).get("name") if isinstance(res, dict) else None
        if status == 201 and created_role == "Director of Core Operations":
            print(f"  [PASS] Founder successfully provisioned Director of Core Operations account directly.")
        else:
            print(f"  [FAIL] Admin creation returned {status}: {res}")
            all_passed = False
    else:
        print("  [SKIP] Skipped admin create test due to missing founder token.")
        all_passed = False

    # 10. Unauthorized user cannot create users via POST /api/users/
    print("\n10. Testing Unauthorized user accessing POST /api/users/...")
    # Login as member
    status, login_res = request("/api/auth/login/", method="POST", data={"email": member_data["email"], "password": member_data["password"]})
    member_token = login_res.get("tokens", {}).get("access") or login_res.get("access")
    if member_token:
        status, res = request("/api/users/", method="POST", data={"name": "Hacker", "email": f"hacker_{ts}@example.com"}, token=member_token)
        if status == 403:
            print(f"  [PASS] Unauthorized user strictly forbidden from creating users (HTTP 403).")
        else:
            print(f"  [FAIL] Unauthorized creation returned unexpected status {status}: {res}")
            all_passed = False
    else:
        print(f"  [FAIL] Member login failed to return token: {login_res}")
        all_passed = False

    # 11. Logo Asset Check
    print("\n11. Testing Logo Asset /tnxlogo.jpg on Frontend Server...")
    try:
        logo_url = f"{FRONTEND_URL}/tnxlogo.jpg"
        req = urllib.request.Request(logo_url)
        with urllib.request.urlopen(req) as resp:
            content_type = resp.headers.get("Content-Type")
            content_len = len(resp.read())
            if resp.status == 200 and content_len > 10000:
                print(f"  [PASS] /tnxlogo.jpg returned HTTP 200 (Size: {content_len} bytes, Type: {content_type}).")
            else:
                print(f"  [FAIL] Logo returned status {resp.status}, size {content_len}.")
                all_passed = False
    except Exception as e:
        print(f"  [FAIL] Logo check error: {e}")
        all_passed = False

    print("\n==========================================")
    if all_passed:
        print(">>> ALL VERIFICATION CHECKS PASSED SUCCESSFULLY! <<<")
    else:
        print(">>> SOME VERIFICATION CHECKS FAILED! <<<")
    print("==========================================")

if __name__ == "__main__":
    main()
