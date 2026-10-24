import React from 'react';
import { Menu, Search, ShieldCheck } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { NotificationCenter } from '../notifications/NotificationCenter';
import './TopBar.css';

export interface TopBarProps {
  onToggleMobileMenu: () => void;
  title: string;
  subtitle?: string;
  userRole?: string;
  onSearchChange?: (val: string) => void;
  searchValue?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  onToggleMobileMenu,
  title,
  subtitle,
  userRole = 'Official',
  onSearchChange,
  searchValue = ''
}) => {
  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-menu-toggle"
          onClick={onToggleMobileMenu}
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>

        <div className="topbar-title-block">
          <h2 className="topbar-title">{title}</h2>
          {subtitle && <p className="topbar-subtitle">{subtitle}</p>}
        </div>
      </div>

      <div className="topbar-right">
        {onSearchChange && (
          <div className="topbar-search-box">
            <Search size={16} className="search-box-icon" />
            <input
              type="text"
              placeholder="Search tasks, teams, members..."
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="search-box-input"
            />
          </div>
        )}

        <div className="topbar-actions">
          <NotificationCenter />

          <div className="topbar-role-badge">
            <ShieldCheck size={14} className="role-icon" />
            <span>Role:</span>
            <Badge variant="primary" size="sm">
              {userRole}
            </Badge>
          </div>
        </div>
      </div>
    </header>
  );
};
