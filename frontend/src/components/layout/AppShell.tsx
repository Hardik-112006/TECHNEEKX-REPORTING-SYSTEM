import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import './AppShell.css';

export interface AppShellProps {
  children: React.ReactNode;
  activeNav: string;
  onNavigate: (navId: string) => void;
  title: string;
  subtitle?: string;
  user?: {
    name: string;
    email: string;
    role: string;
  };
  onLogout?: () => void;
  onSearchChange?: (val: string) => void;
  searchValue?: string;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  activeNav,
  onNavigate,
  title,
  subtitle,
  user,
  onLogout,
  onSearchChange,
  searchValue
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="app-shell-container">
      <Sidebar
        activeNav={activeNav}
        onNavigate={onNavigate}
        isOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        user={user}
        onLogout={onLogout}
      />
      <div className="app-shell-main">
        <TopBar
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
          title={title}
          subtitle={subtitle}
          userRole={user?.role}
          onSearchChange={onSearchChange}
          searchValue={searchValue}
        />
        <main className="app-shell-content">
          <div className="content-inner">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
