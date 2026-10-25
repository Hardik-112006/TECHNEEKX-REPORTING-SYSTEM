from datetime import time, timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.accounts.models import Role, User
from apps.teams.models import Team, Group
from apps.tasks.models import Task
from apps.submissions.models import TaskProof, Review
from apps.scoring.models import Performance
from apps.board.models import Warning, RemovalReview
from apps.announcements.models import Announcement

class Command(BaseCommand):
    help = 'Seeds realistic, idempotent development demo data matching the official TechNeekX hierarchy'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Initializing TechNeekX 4-Level Hierarchy Demo Dataset..."))

        # 1. ROLES (5 Canonical Categories: Founder, Officials, Director of Core Operations, Core Leads, Members)
        roles_data = [
            # 1. Founder
            ('Founder', 'Highest administrative authority, org-wide governance and approvals'),
            # 2. Officials
            ('Chairman', 'Official Team executive oversight and strategic guidance'),
            ('Managing Director', 'Official Team operations management and resource allocation'),
            ('President', 'Official Team executive leadership and community representation'),
            ('Official', 'Official Team administrative authority and organization management'),
            # 3. Director of Core Operations
            ('Director of Core Operations', 'Monitoring Core Leads, group progress, task deadlines, warnings & revised deadlines'),
            # 4. Core Leads
            ('Core Team Lead', 'Core Team lead, task delegation to group members, proof reviews'),
            ('Core Lead', 'Core Team lead, group management, authorized submissions review'),
            # 5. Members
            ('Member', 'TechNeekX Family member, task completion, GitHub & proof submissions'),
        ]

        roles = {}
        for name, desc in roles_data:
            role_obj, _ = Role.objects.update_or_create(
                name=name,
                defaults={'description': desc}
            )
            roles[name] = role_obj

        # 2. TEAMS AND GROUPS
        eng_team, _ = Team.objects.get_or_create(
            name='Engineering Core',
            defaults={'type': 'Technical', 'description': 'Primary software engineering and infrastructure division'}
        )
        emerging_team, _ = Team.objects.get_or_create(
            name='Emerging Tech & Innovation',
            defaults={'type': 'Innovation', 'description': 'Research in artificial intelligence, mobile apps, and developer tools'}
        )

        frontend_group, _ = Group.objects.get_or_create(
            team=eng_team,
            name='Frontend & UI Engineering',
            defaults={'description': 'Modern web interfaces, design system components, and client-side performance'}
        )
        backend_group, _ = Group.objects.get_or_create(
            team=eng_team,
            name='Backend & Cloud Architecture',
            defaults={'description': 'Scalable REST APIs, database persistence, cloud deployments, and security'}
        )
        ai_group, _ = Group.objects.get_or_create(
            team=emerging_team,
            name='AI & Machine Learning Research',
            defaults={'description': 'Agentic systems, natural language processing, and automated evaluations'}
        )

        # 3. USERS (Common Password: Techneekx@2026)
        demo_users_data = [
            # 1. Founder
            ('founder@example.com', 'Demo Founder', 'Founder', None, None, 'Founder'),
            # 2. Officials
            ('chairman@example.com', 'David Chairman', 'Chairman', None, None, 'Chairman'),
            ('md@example.com', 'Suresh MD', 'Managing Director', None, None, 'Managing Director'),
            ('president@example.com', 'Elena President', 'President', None, None, 'President'),
            ('cto@example.com', 'Marcus Official', 'Official', eng_team, None, 'Chief Technology Officer (CTO)'),
            ('official@example.com', 'Demo Official', 'Official', None, None, 'Official'),

            # 3. Director of Core Operations
            ('director.ops@example.com', 'Anita Director', 'Director of Core Operations', eng_team, None, 'Director of Operations'),

            # 4. Core Leads
            ('corelead.vikram@example.com', 'Vikram Core Lead', 'Core Team Lead', eng_team, frontend_group, 'Frontend Lead'),
            ('corelead.ananya@example.com', 'Ananya Core Lead', 'Core Team Lead', eng_team, backend_group, 'Backend Lead'),
            ('deputy.rohit@example.com', 'Rohit Core Lead', 'Core Team Lead', eng_team, frontend_group, 'Frontend Co-Lead'),
            ('deputy.sneha@example.com', 'Sneha Core Lead', 'Core Team Lead', eng_team, backend_group, 'Backend Co-Lead'),

            # 5. Members — TechNeekX Family
            ('mentor.riya@example.com', 'Riya Member', 'Member', eng_team, None, 'Senior Member'),
            ('mentor.arjun@example.com', 'Arjun Member', 'Member', emerging_team, None, 'Senior Member'),
            ('member.dev@example.com', 'Dev Member', 'Member', eng_team, frontend_group, 'UI Engineer'),
            ('member.kavya@example.com', 'Kavya Member', 'Member', eng_team, frontend_group, 'Frontend Developer'),
            ('member.rahul@example.com', 'Rahul Member', 'Member', eng_team, backend_group, 'Backend Engineer'),
            ('member.pooja@example.com', 'Pooja Member', 'Member', eng_team, backend_group, 'Cloud Engineer'),
        ]

        users = {}
        for email, name, role_name, team_obj, group_obj, position in demo_users_data:
            user_obj, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'name': name,
                    'role': roles[role_name],
                    'team': team_obj,
                    'group': group_obj,
                    'position': position,
                    'is_demo': True,
                    'status': 'Active'
                }
            )
            user_obj.name = name
            user_obj.role = roles[role_name]
            user_obj.team = team_obj
            user_obj.group = group_obj
            user_obj.position = position
            user_obj.is_demo = True
            user_obj.status = 'Active'
            user_obj.set_password('Techneekx@2026')
            user_obj.save()
            users[email] = user_obj

        # 4. TASKS WITH DOWNWARD DELEGATION
        now = timezone.now()
        today_end = timezone.make_aware(
            timezone.datetime.combine(now.date(), time(23, 59, 59)),
            timezone.get_current_timezone()
        )
        tomorrow_end = today_end + timedelta(days=1)
        future_14_days = today_end + timedelta(days=14)
        future_7_days = today_end + timedelta(days=7)
        past_3_days = today_end - timedelta(days=3)

        # Top-level Org Task: Founder -> Official Marcus
        task_top, _ = Task.objects.update_or_create(
            title='Q4 Platform Architecture & Scalability Release',
            defaults={
                'description': 'Organization-wide architecture upgrade: Implement high-performance caching, clean SaaS design system, and multi-tenant permission layers.',
                'created_by': users['founder@example.com'],
                'assigned_to': users['cto@example.com'],
                'team': eng_team,
                'status': 'In Progress',
                'deadline': future_14_days,
            }
        )

        # Delegated Task: Official Marcus -> Core Lead Vikram (Frontend)
        task_fe_delegated, _ = Task.objects.update_or_create(
            title='Develop Accessible SaaS Component Library',
            defaults={
                'description': 'Deliver complete accessible React UI library with WCAG AA contrast tokens, responsive layouts, and zero visual clutter.',
                'created_by': users['cto@example.com'],
                'assigned_to': users['corelead.vikram@example.com'],
                'team': eng_team,
                'group': frontend_group,
                'parent_task': task_top,
                'status': 'In Progress',
                'deadline': future_7_days,
            }
        )

        # Delegated Subtask: Vikram -> Member Dev (Due today)
        task_sub_dev, _ = Task.objects.update_or_create(
            title='Implement WCAG AA Compliant Status Badges',
            defaults={
                'description': 'Create reusable Badge components with high contrast indicators for Approved, Pending, Overdue, and In Progress states.',
                'created_by': users['corelead.vikram@example.com'],
                'assigned_to': users['member.dev@example.com'],
                'team': eng_team,
                'group': frontend_group,
                'parent_task': task_fe_delegated,
                'status': 'Assigned',
                'deadline': today_end, # Same-day task!
            }
        )

        # Delegated Subtask: Vikram -> Member Kavya (Submitted with GitHub proof)
        task_sub_kavya, _ = Task.objects.update_or_create(
            title='Implement Responsive Mobile Navigation Drawer',
            defaults={
                'description': 'Build accessible responsive navigation menu that smoothly collapses on screen widths < 768px with full keyboard trap navigation.',
                'created_by': users['corelead.vikram@example.com'],
                'assigned_to': users['member.kavya@example.com'],
                'team': eng_team,
                'group': frontend_group,
                'parent_task': task_fe_delegated,
                'status': 'Submitted',
                'deadline': tomorrow_end,
            }
        )

        # TaskProof for Kavya
        TaskProof.objects.update_or_create(
            task=task_sub_kavya,
            submitted_by=users['member.kavya@example.com'],
            defaults={
                'github_link': 'https://github.com/techneekx-community/frontend-mobile-nav/pull/42',
                'screenshots': 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800',
                'description': 'Completed mobile responsive navigation drawer with touch gestures and ARIA attributes.',
            }
        )

        # Delegated Subtask: Ananya -> Member Rahul (Changes Requested)
        task_sub_rahul, _ = Task.objects.update_or_create(
            title='Optimize PostgreSQL / SQLite Query Indexing',
            defaults={
                'description': 'Add database indexes on task status, deadlines, and foreign keys to eliminate full table scans.',
                'created_by': users['corelead.ananya@example.com'],
                'assigned_to': users['member.rahul@example.com'],
                'team': eng_team,
                'group': backend_group,
                'status': 'Changes Requested',
                'deadline': tomorrow_end,
            }
        )

        proof_rahul, _ = TaskProof.objects.update_or_create(
            task=task_sub_rahul,
            submitted_by=users['member.rahul@example.com'],
            defaults={
                'github_link': 'https://github.com/techneekx-community/backend-query-optimization/pull/18',
                'description': 'Initial migration for task query indexing.',
            }
        )

        Review.objects.update_or_create(
            task=task_sub_rahul,
            proof=proof_rahul,
            reviewer=users['corelead.ananya@example.com'],
            defaults={
                'decision': 'Changes Requested',
                'feedback': 'Please ensure composite indexes include status filters and add execution plan benchmarks.',
            }
        )

        # Overdue Task: Rahul
        Task.objects.update_or_create(
            title='Legacy API Endpoint Security Audit',
            defaults={
                'description': 'Audit all unauthenticated endpoints to ensure strict RBAC and query isolation.',
                'created_by': users['corelead.ananya@example.com'],
                'assigned_to': users['member.rahul@example.com'],
                'team': eng_team,
                'group': backend_group,
                'status': 'Assigned',
                'deadline': past_3_days, # Overdue!
            }
        )

        # Completed & Approved Task: Pooja
        task_pooja, _ = Task.objects.update_or_create(
            title='Design System Dark & Light Theme Token Palette',
            defaults={
                'description': 'Define standard CSS variables for typography, spacing, surface contrasts, and brand gradients.',
                'created_by': users['corelead.vikram@example.com'],
                'assigned_to': users['member.pooja@example.com'],
                'team': eng_team,
                'group': frontend_group,
                'status': 'Approved',
                'deadline': past_3_days,
            }
        )

        proof_pooja, _ = TaskProof.objects.update_or_create(
            task=task_pooja,
            submitted_by=users['member.pooja@example.com'],
            defaults={
                'github_link': 'https://github.com/techneekx-community/design-tokens/pull/5',
                'screenshots': 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800',
                'description': 'Tokens.css finalized with WCAG AA compliance.',
            }
        )

        Review.objects.update_or_create(
            task=task_pooja,
            proof=proof_pooja,
            reviewer=users['corelead.vikram@example.com'],
            defaults={
                'decision': 'Approved',
                'feedback': 'Exceptional execution. Design tokens cleanly integrate with all dashboard components.',
            }
        )

        # 5. PERFORMANCE SCORING RECORDS
        Performance.objects.update_or_create(
            user=users['member.pooja@example.com'],
            defaults={'points': 250, 'rank': 1}
        )
        Performance.objects.update_or_create(
            user=users['member.kavya@example.com'],
            defaults={'points': 180, 'rank': 2}
        )
        Performance.objects.update_or_create(
            user=users['member.dev@example.com'],
            defaults={'points': 120, 'rank': 3}
        )
        Performance.objects.update_or_create(
            user=users['member.rahul@example.com'],
            defaults={'points': 75, 'rank': 4}
        )

        # 6. BOARD WARNINGS (Max 5 active rule verified)
        Warning.objects.update_or_create(
            target_user=users['member.rahul@example.com'],
            reason='Missed reporting deadline for Task #6 (Legacy API Endpoint Security Audit) by >48 hours without prior notice.',
            defaults={
                'target_group': backend_group,
                'issued_by': users['director.ops@example.com'],
                'status': 'Active',
                'expiry_date': (now + timedelta(days=30)).date(),
            }
        )

        # 7. OFFICIAL ANNOUNCEMENTS (Official Team Only)
        Announcement.objects.update_or_create(
            title='Official Launch: TechNeekX 4-Level Governance Architecture',
            defaults={
                'content': 'Welcome to the streamlined TechNeekX Community Reporting Platform. Our official hierarchy (Official Team -> Board -> Core Team -> Members) is now in active effect with role data isolation and downward task delegation.',
                'created_by': users['founder@example.com'],
            }
        )

        Announcement.objects.update_or_create(
            title='Engineering Sprint: Accessible UI Components & Mobile Optimization',
            defaults={
                'content': 'All teams and groups are requested to prioritize responsive design and strict server-side validation. Submit all PR links and proof screenshots through your member dashboard.',
                'created_by': users['cto@example.com'],
            }
        )

        self.stdout.write(self.style.SUCCESS("TechNeekX 4-Level Hierarchy Demo Dataset seeded successfully!"))
        self.stdout.write(self.style.SUCCESS(f"Total Users: {User.objects.count()} | Groups: {Group.objects.count()} | Tasks: {Task.objects.count()}"))
