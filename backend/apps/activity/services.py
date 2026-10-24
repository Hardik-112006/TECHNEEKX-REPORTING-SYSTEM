from apps.activity.models import HistoryLog

def log_activity(user, action: str, details: str = None):
    """
    Central helper to record audit logs in the history_logs table.
    """
    try:
        return HistoryLog.objects.create(
            user=user if getattr(user, 'is_authenticated', False) else None,
            action=action,
            details=details
        )
    except Exception as e:
        # Logging failure should not break user transactions, but print to stderr
        print(f"[ActivityLog Warning] Failed to log activity '{action}': {e}")
        return None
