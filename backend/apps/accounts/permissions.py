from rest_framework import permissions

# Documented Role Hierarchy Tiers
TIER_1_EXECUTIVE_ADMIN = {
    'Founder',
    'Chairman',
    'Managing Director'
}

TIER_2_EXECUTIVE_LEADERSHIP = TIER_1_EXECUTIVE_ADMIN | {
    'President',
    'CTO',
    'Director of Core Operations',
    'Official'
}

TIER_3_CORE_LEAD = TIER_2_EXECUTIVE_LEADERSHIP | {
    'Mentor',
    'Core Team Lead'
}

TIER_4_GROUP_LEAD = TIER_3_CORE_LEAD | {
    'Deputy',
    'Group Leader'
}

TIER_5_ALL = TIER_4_GROUP_LEAD | {
    'Member'
}

def get_role_tier(role_name: str) -> int:
    if role_name in TIER_1_EXECUTIVE_ADMIN:
        return 1
    if role_name in TIER_2_EXECUTIVE_LEADERSHIP:
        return 2
    if role_name in TIER_3_CORE_LEAD:
        return 3
    if role_name in TIER_4_GROUP_LEAD:
        return 4
    return 5

def user_has_tier(user, max_tier: int) -> bool:
    if not user or not user.is_authenticated or not user.role:
        return False
    return get_role_tier(user.role.name) <= max_tier


class IsFounderOrAdmin(permissions.BasePermission):
    """
    Tier 1 permissions: Founder, Chairman, Managing Director.
    Full authority to assign roles, system configuration, and audit management.
    """
    def has_permission(self, request, view):
        return user_has_tier(request.user, 1)


class IsExecutiveOrLeader(permissions.BasePermission):
    """
    Tier 2 permissions: Executive Leadership & Officials.
    Can create/manage teams, assign members, post community announcements.
    """
    def has_permission(self, request, view):
        return user_has_tier(request.user, 2)


class IsCoreLeadOrAbove(permissions.BasePermission):
    """
    Tier 3 permissions: Core Team Leads and Mentors.
    Can assign tasks to their teams, review proofs, request changes.
    """
    def has_permission(self, request, view):
        return user_has_tier(request.user, 3)


class IsGroupLeadOrAbove(permissions.BasePermission):
    """
    Tier 4 permissions: Group Leaders and Deputies.
    Can manage group coordination and assist in reviews.
    """
    def has_permission(self, request, view):
        return user_has_tier(request.user, 4)


class IsSelfOrAdmin(permissions.BasePermission):
    """
    Allows users to read/update their own profile, or Tier 1/2 leaders to view/manage.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if user_has_tier(request.user, 2):
            return True
        return hasattr(obj, 'user_id') and obj.user_id == request.user.user_id


class ReadOnlyOrExecutive(permissions.BasePermission):
    """
    Read access for all authenticated users; mutation only for Tier 2 and above.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return user_has_tier(request.user, 2)
