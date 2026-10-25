from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from apps.accounts.views import (
    RegisterView,
    PublicGroupListView,
    PublicDemoAccountListView,
    LoginView,
    LogoutView,
    CurrentUserView,
    RoleListView,
    UserViewSet
)

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')

urlpatterns = [
    # Authentication endpoints
    path('auth/register/', RegisterView.as_view(), name='auth-register'),
    path('auth/groups/', PublicGroupListView.as_view(), name='auth-public-groups'),
    path('auth/demo-accounts/', PublicDemoAccountListView.as_view(), name='auth-demo-accounts'),
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('auth/me/', CurrentUserView.as_view(), name='auth-me'),

    # Roles endpoint
    path('roles/', RoleListView.as_view(), name='role-list'),

    # Users router
    path('', include(router.urls)),
]
