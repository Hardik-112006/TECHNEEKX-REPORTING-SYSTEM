import os
import sys
from pathlib import Path

# Setup paths and environment
BASE_DIR = Path(__file__).resolve().parent.parent
WORKSPACE_DIR = BASE_DIR.parent
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BASE_DIR / 'apps'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()

from django.db import connection, transaction, IntegrityError
from apps.accounts.models import Role, User
from apps.teams.models import Team, Group
from apps.tasks.models import Task
from apps.submissions.models import TaskProof, Review
from apps.scoring.models import Performance
from apps.announcements.models import Announcement
from apps.activity.models import HistoryLog, ExtraMaterial

def run_verification():
    print("==================================================")
    print("TECHNEEKX DATABASE INTEGRATION VERIFICATION SUITE")
    print("==================================================")

    # 1. Verify Connection & Database Engine
    db_engine = connection.settings_dict['ENGINE']
    db_name = connection.settings_dict['NAME']
    print(f"[OK] Database Engine: {db_engine}")
    print(f"[OK] Connected to Database: {db_name}")
    assert 'postgresql' in db_engine, "Expected PostgreSQL engine, got different backend!"

    # 2. Verify Seed Record Counts
    roles_count = Role.objects.count()
    teams_count = Team.objects.count()
    groups_count = Group.objects.count()
    users_count = User.objects.count()
    tasks_count = Task.objects.count()
    proofs_count = TaskProof.objects.count()
    reviews_count = Review.objects.count()
    perf_count = Performance.objects.count()
    ann_count = Announcement.objects.count()
    logs_count = HistoryLog.objects.count()
    mat_count = ExtraMaterial.objects.count()

    print(f"[OK] Seed Counts - Roles: {roles_count}, Teams: {teams_count}, Groups: {groups_count}, Users: {users_count}")
    print(f"[OK] Seed Counts - Tasks: {tasks_count}, Proofs: {proofs_count}, Reviews: {reviews_count}, Performance: {perf_count}")
    print(f"[OK] Seed Counts - Announcements: {ann_count}, Logs: {logs_count}, Materials: {mat_count}")

    assert roles_count >= 5, f"Expected at least 5 roles, found {roles_count}"
    assert teams_count >= 5, f"Expected at least 5 teams, found {teams_count}"
    assert groups_count >= 2, f"Expected at least 2 groups, found {groups_count}"
    assert users_count >= 6, f"Expected at least 6 users, found {users_count}"
    assert tasks_count >= 3, f"Expected at least 3 tasks, found {tasks_count}"

    # 3. Verify User Authentication / Password Hashes
    founder = User.objects.get(email='founder@example.com')
    assert founder.check_password('Techneekx@2026'), "Founder password hash check failed!"
    assert founder.role.name == 'Founder', "Founder role association mismatch!"
    assert founder.is_superuser is True, "Founder is_superuser property mismatch!"
    assert founder.is_staff is True, "Founder is_staff property mismatch!"
    assert founder.is_active is True, "Founder is_active property mismatch!"
    print(f"[OK] Verified user authentication and role properties for: {founder.email}")

    # 4. Verify Relationships & Querying
    dev_team = Team.objects.get(name='Development Team')
    sub_teams = dev_team.sub_teams.all()
    print(f"[OK] Development team sub-teams: {[t.name for t in sub_teams]}")

    dev_groups = dev_team.groups.all()
    print(f"[OK] Development team groups: {[g.name for g in dev_groups]}")
    assert dev_groups.count() == 2, "Expected 2 groups under Development Team!"

    # 5. Test CRUD & Relational Lifecycle
    print("\n--- Testing Full Task Lifecycle & Atomic Point Award ---")
    member = User.objects.get(email='riya.member@example.com')
    lead = User.objects.get(email='aarav.lead@example.com')

    # A. Create a task assigned to both user and team
    test_task = Task.objects.create(
        title='Verify Database Resilience Test',
        description='Automated integration testing for assignment and submission flow',
        created_by=lead,
        assigned_to=member,
        team=dev_team,
        status='Assigned'
    )
    print(f"[OK] Created Task #{test_task.task_id}: {test_task.title} (Assigned to {member.name})")

    # B. Transition to In Progress
    test_task.status = 'In Progress'
    test_task.save()
    assert Task.objects.get(task_id=test_task.task_id).status == 'In Progress'

    # C. Submit Evidence Proof
    test_proof = TaskProof.objects.create(
        task=test_task,
        submitted_by=member,
        github_link='https://github.com/techneekx/test-repo',
        description='Implementation completed and verified locally'
    )
    test_task.status = 'Submitted'
    test_task.save()
    print(f"[OK] Created Proof #{test_proof.proof_id} for Task #{test_task.task_id}")

    # D. Review and Idempotent Points Award
    with transaction.atomic():
        test_review = Review.objects.create(
            task=test_task,
            proof=test_proof,
            reviewer=lead,
            decision='Approved',
            feedback='Excellent work, test passed.'
        )
        test_task.status = 'Approved'
        test_task.save()

        # Update performance points atomically
        perf, _ = Performance.objects.get_or_create(user=member)
        old_points = perf.points
        perf.points += 10
        perf.save()

        # Record activity history
        HistoryLog.objects.create(
            user=lead,
            action='TASK_APPROVED',
            details=f"Task #{test_task.task_id} approved for user #{member.user_id}"
        )

    perf.refresh_from_db()
    assert perf.points == old_points + 10, "Points increment failed!"
    print(f"[OK] Task approved and {member.name} points updated: {old_points} -> {perf.points}")

    # 6. Test Database Constraint Enforcement
    print("\n--- Testing Database Constraints ---")

    # A. Duplicate Email Unique Constraint
    duplicate_email_caught = False
    try:
        with transaction.atomic():
            User.objects.create(
                name='Duplicate User',
                email='founder@example.com',
                password='somepassword',
                role=founder.role
            )
    except IntegrityError:
        duplicate_email_caught = True
    assert duplicate_email_caught, "Failed to catch duplicate email constraint violation!"
    print("[OK] Duplicate email unique constraint enforced by PostgreSQL.")

    # B. Task Proof Multi-Field Check Constraint
    with connection.cursor() as cursor:
        check_constraint_caught = False
        try:
            with transaction.atomic():
                cursor.execute(
                    "INSERT INTO task_proofs (task_id, submitted_by, github_link, screenshots, description) "
                    "VALUES (%s, %s, NULL, NULL, NULL)",
                    [test_task.task_id, member.user_id]
                )
        except Exception:
            check_constraint_caught = True
        assert check_constraint_caught, "Failed to catch task_proofs check constraint violation!"
    print("[OK] Task proof non-empty check constraint enforced by PostgreSQL.")

    # 7. Clean up test records
    test_task.delete() # Cascades to test_proof and test_review
    perf.points = old_points
    perf.save()
    print("\n[OK] Test records cleaned up successfully.")
    print("==================================================")
    print("ALL POSTGRESQL INTEGRATION CHECKS PASSED (100%)")
    print("==================================================")

if __name__ == '__main__':
    run_verification()
