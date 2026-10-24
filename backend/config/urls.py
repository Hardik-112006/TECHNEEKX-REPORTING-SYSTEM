from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    # Accounts, Auth, Roles & Users API
    path('api/', include('apps.accounts.urls')),
    # Teams & Groups API
    path('api/', include('apps.teams.urls')),
]
