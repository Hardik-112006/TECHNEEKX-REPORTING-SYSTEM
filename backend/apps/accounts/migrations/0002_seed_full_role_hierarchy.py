from django.db import migrations

def seed_full_roles(apps, schema_editor):
    Role = apps.get_model('accounts', 'Role')
    roles_data = [
        ('Founder', 'System founder with overall access and final decision authority'),
        ('Chairman', 'Executive chairman with organizational oversight'),
        ('Managing Director', 'Managing director overseeing organizational operations'),
        ('President', 'Community president leading executive operations'),
        ('CTO', 'Chief Technology Officer leading technical architecture and development'),
        ('Director of Core Operations', 'Director overseeing core workflows and team logistics'),
        ('Official', 'Official team member who manages tasks and announcements'),
        ('Mentor', 'Advises teams, mentors contributors, and assists in review guidance'),
        ('Core Team Lead', 'Leads a core team and can assign and review work within authorized scope'),
        ('Deputy', 'Deputy team leader assisting with group assignments and coordination'),
        ('Group Leader', 'Coordinates group members and their assigned work'),
        ('Member', 'Completes assigned tasks and submits proof for review'),
    ]

    for name, desc in roles_data:
        Role.objects.get_or_create(
            name=name,
            defaults={'description': desc}
        )

def unseed_roles(apps, schema_editor):
    pass

class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_full_roles, unseed_roles),
    ]
