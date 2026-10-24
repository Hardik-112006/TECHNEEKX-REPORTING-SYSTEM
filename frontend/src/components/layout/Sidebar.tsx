import React from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  UploadCloud,
  Trophy,
  Users,
  Megaphone,
  Activity,
  LogOut,
  X,
  Layers,
  Briefcase,
  Award,
  FileText,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import './Sidebar.css';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
}

export interface SidebarProps {
  activeNav: string;
  onNavigate: (navId: string) => void;
  isOpen: boolean;
  onCloseMobile: () => void;
  user?: {
    name: string;
    email: string;
    role: string;
  };
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeNav,
  onNavigate,
  isOpen,
  onCloseMobile,
  user = { name: 'Demo Official', email: 'official@example.com', role: 'Official' },
  onLogout
}) => {
  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'tasks', label: 'Tasks', icon: <CheckSquare size={18} />, badge: '3' },
    { id: 'submissions', label: 'Submissions', icon: <UploadCloud size={18} /> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={18} /> },
    { id: 'career', label: 'Career & Resume', icon: <Briefcase size={18} /> },
    { id: 'hackathons', label: 'Hackathons & Recruitment', icon: <Award size={18} /> },
    { id: 'documents', label: 'Official Documents', icon: <FileText size={18} /> },
    { id: 'analytics', label: 'Analytics & Reports', icon: <TrendingUp size={18} /> },
    { id: 'approvals', label: 'Governance Approvals', icon: <ShieldCheck size={18} /> },
    { id: 'teams', label: 'Teams & Groups', icon: <Users size={18} /> },
    { id: 'announcements', label: 'Announcements', icon: <Megaphone size={18} /> },
    { id: 'activity', label: 'Activity Logs', icon: <Activity size={18} /> },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside className={`app-sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        {/* Brand header */}
        <div className="sidebar-brand">
          <div className="brand-logo-wrapper">
            <Layers className="brand-logo-icon" size={20} />
          </div>
          <div className="brand-text-block">
            <h1 className="brand-title">TechNeekX</h1>
            <span className="brand-subtitle">Reporting System</span>
          </div>
          <button
            type="button"
            className="mobile-close-btn"
            onClick={onCloseMobile}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation items */}
        <nav className="sidebar-nav">
          <div className="nav-group-title">MAIN MENU</div>
          <ul className="nav-list">
            {navItems.map((item) => {
              const isActive = activeNav === item.id;
              return (
                <li key={item.id} className="nav-item">
                  <button
                    type="button"
                    className={`nav-button ${isActive ? 'nav-button-active' : ''}`}
                    onClick={() => {
                      onNavigate(item.id);
                      onCloseMobile();
                    }}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                    {item.badge && (
                      <span className="nav-badge-pill">{item.badge}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Profile Card & Logout */}
        <div className="sidebar-footer">
          <div className="user-profile-card">
            <div className="user-avatar">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="user-info-text">
              <span className="user-name">{user.name}</span>
              <Badge variant="primary" size="sm" className="user-role-badge">
                {user.role}
              </Badge>
            </div>
          </div>
          {onLogout && (
            <button
              type="button"
              className="sidebar-logout-btn"
              onClick={onLogout}
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
