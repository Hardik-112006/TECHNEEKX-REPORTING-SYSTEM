from rest_framework import permissions

# ==============================================================================
# OFFICIAL TECHNEEKX HIERARCHY — 5 CANONICAL ROLE CATEGORIES
# ==============================================================================

# 1. FOUNDER — Organization-wide overview, user & role management, teams & groups,
# high-level approvals, official announcements.
FOUNDER_ROLES = {
    'Founder'
}

# 2. OFFICIALS — Administrative authority (Chairman, MD, President, Official).
# Creates & assigns tasks, reviews reports & deliverables, publishes official announcements.
# (CTO is unified under Officials).
OFFICIALS_ROLES = {
    'Founder',
    'Chairman',
    'Managing Director',
    'President',
    'Official'
}

# 3. DIRECTOR OF CORE OPERATIONS — Monitors Core Leads, group progress, task deadlines,
# inspects monitored tasks & submissions (INSPECTION ONLY — NO REVIEW/APPROVE ACTIONS),
# tracks overdue work, generates warnings, sets revised deadlines, escalates issues.
DIRECTOR_ROLES = {
    'Director of Core Operations'
}

# 4. CORE LEADS — Group management, task delegation within authorized scope,
# reviews member submissions (approves / requests corrections), reports upward.
CORE_LEAD_ROLES = {
    'Core Lead',
    'Core Team Lead'
}

# 5. MEMBERS — TechNeekX Family
# View own tasks, deadlines, submissions, feedback, relevant announcements;
# submit work and evidence, complete corrections and resubmit.
MEMBER_ROLES = {
    'Member'
}

# Aliases for backward compatibility
OFFICIAL_TEAM_ROLES = OFFICIALS_ROLES
BOARD_ROLES = DIRECTOR_ROLES
CORE_TEAM_ROLES = CORE_LEAD_ROLES

def get_user_hierarchy_level(role_name: str) -> int:
    """
    Returns 1-5 hierarchy level:
    1 = Founder
    2 = Officials
    3 = Director of Core Operations
    4 = Core Leads
    5 = Members
    """
    if role_name in FOUNDER_ROLES:
        return 1
    if role_name in OFFICIALS_ROLES:
        return 2
    if role_name in DIRECTOR_ROLES:
        return 3
    if role_name in CORE_LEAD_ROLES:
        return 4
    return 5

def get_role_category(role_name: str) -> str:
    if role_name in FOUNDER_ROLES:
        return 'Founder'
    if role_name in OFFICIALS_ROLES:
        return 'Officials'
    if role_name in DIRECTOR_ROLES:
        return 'Director of Core Operations'
    if role_name in CORE_LEAD_ROLES:
        return 'Core Leads'
    return 'Members'

# Legacy Tier Mapping for backward compatibility
TIER_1_EXECUTIVE_ADMIN = {'Founder', 'Chairman', 'Managing Director'}
TIER_2_EXECUTIVE_LEADERSHIP = TIER_1_EXECUTIVE_ADMIN | {'President', 'Official'}
TIER_3_CORE_LEAD = TIER_2_EXECUTIVE_LEADERSHIP | {'Director of Core Operations', 'Core Team Lead', 'Core Lead'}
TIER_4_GROUP_LEAD = TIER_3_CORE_LEAD
TIER_5_ALL = TIER_4_GROUP_LEAD | {'Member'}

def get_role_tier(role_name: str) -> int:
    if role_name in TIER_1_EXECUTIVE_ADMIN:
        return 1
    if role_name in TIER_2_EXECUTIVE_LEADERSHIP:
        return 2
    if role_name in DIRECTOR_ROLES:
        return 2 # Board monitoring tier
    if role_name in CORE_LEAD_ROLES:
        return 3
    return 4

def user_has_tier(user, max_tier: int) -> bool:
    if not user or not user.is_authenticated or not user.role:
        return False
    return get_role_tier(user.role.name) <= max_tier

def is_founder(user) -> bool:
    return bool(user and user.is_authenticated and user.role and user.role.name in FOUNDER_ROLES)

def is_official(user) -> bool:
    return bool(user and user.is_authenticated and user.role and user.role.name in OFFICIALS_ROLES)

def is_director_of_operations(user) -> bool:
    return bool(user and user.is_authenticated and user.role and user.role.name in DIRECTOR_ROLES)

def is_core_lead(user) -> bool:
    return bool(user and user.is_authenticated and user.role and user.role.name in CORE_LEAD_ROLES)

def is_member(user) -> bool:
    return bool(user and user.is_authenticated and user.role and user.role.name in MEMBER_ROLES)

def is_board(user) -> bool:
    return is_director_of_operations(user)

def is_core_team(user) -> bool:
    return is_core_lead(user)

def is_board_or_official(user) -> bool:
    return is_official(user) or is_director_of_operations(user)

def can_review_submissions(user) -> bool:
    """
    STRICT REQUIREMENT: Director of Core Operations has inspection-only oversight
    and CANNOT approve or reject submissions.
    Only Founder, Officials, and Core Leads can conduct reviews.
    """
    if not user or not user.is_authenticated or not user.role:
        return False
    if is_director_of_operations(user):
        return False
    return is_founder(user) or is_official(user) or is_core_lead(user)


# ==============================================================================
# PERMISSION CLASSES
# ==============================================================================

class IsOfficialTeam(permissions.BasePermission):
    """
    Level 1: Official Team only (Founder, Chairman, MD, President, CTO, Official).
    Authorized to create official tasks, manage groups, and post announcements.
    """
    def has_permission(self, request, view):
        return is_official(request.user)


class IsFounderOnly(permissions.BasePermission):
    """
    Founder highest administrative authority.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role and request.user.role.name == 'Founder')


class IsBoardMember(permissions.BasePermission):
    """
    Level 2: Board members (Director of Core Operations, Mentors).
    """
    def has_permission(self, request, view):
        return is_board(request.user)


class IsBoardOrOfficial(permissions.BasePermission):
    """
    Board or Official Team (Monitoring, warnings, escalations).
    """
    def has_permission(self, request, view):
        return is_board_or_official(request.user)


class IsCoreTeamOrAbove(permissions.BasePermission):
    """
    Core Team, Board, or Official Team.
    """
    def has_permission(self, request, view):
        return is_official(request.user) or is_board(request.user) or is_core_team(request.user)


class CanCreateOrDelegateTask(permissions.BasePermission):
    """
    Officials can create top-level tasks.
    Core Leads and Deputies can delegate tasks to their group members.
    Board and Members CANNOT create tasks.
    """
    def has_permission(self, request, view):
        return is_official(request.user) or is_core_team(request.user)


class IsFounderOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return is_official(request.user)


class IsExecutiveOrLeader(permissions.BasePermission):
    def has_permission(self, request, view):
        return is_official(request.user)


class IsCoreLeadOrAbove(permissions.BasePermission):
    def has_permission(self, request, view):
        return is_official(request.user) or is_board(request.user) or is_core_team(request.user)


class IsGroupLeadOrAbove(permissions.BasePermission):
    def has_permission(self, request, view):
        return is_official(request.user) or is_board(request.user) or is_core_team(request.user)


class IsSelfOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if is_official(request.user):
            return True
        return hasattr(obj, 'user_id') and obj.user_id == request.user.user_id


class ReadOnlyOrExecutive(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return is_official(request.user)

