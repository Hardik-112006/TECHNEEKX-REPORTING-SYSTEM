import React, { useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { DashboardView } from './views/DashboardView';
import { TasksView } from './views/TasksView';
import { LeaderboardView } from './views/LeaderboardView';
import { ComponentsShowcaseView } from './views/ComponentsShowcaseView';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './components/ui/Card';
import { Badge } from './components/ui/Badge';
import { Button } from './components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './components/ui/Table';
import { Sparkles } from 'lucide-react';

export const App: React.FC = () => {
  const [activeNav, setActiveNav] = useState<string>('dashboard');
  const [currentRole, setCurrentRole] = useState<string>('Official');
  const [searchTerm, setSearchTerm] = useState('');

  // Sample user profile reflecting active role
  const currentUser = {
    name: currentRole === 'Founder' ? 'Demo Founder' :
          currentRole === 'Official' ? 'Demo Official' :
          currentRole === 'Core Team Lead' ? 'Aarav Core Lead' : 'Riya Member',
    email: currentRole === 'Founder' ? 'founder@example.com' :
           currentRole === 'Official' ? 'official@example.com' :
           currentRole === 'Core Team Lead' ? 'aarav.lead@example.com' : 'riya.member@example.com',
    role: currentRole
  };

  const getPageInfo = () => {
    switch (activeNav) {
      case 'dashboard':
        return { title: 'Executive Overview', subtitle: 'Real-time task velocity, metrics, and submissions summary' };
      case 'tasks':
        return { title: 'Tasks & Assignments', subtitle: 'Manage, start, and submit proof for community tasks' };
      case 'submissions':
        return { title: 'Evidence Review Queue', subtitle: 'Review task proof submissions and provide feedback' };
      case 'leaderboard':
        return { title: 'Community Leaderboard', subtitle: 'Points ledger and live ranking standings' };
      case 'teams':
        return { title: 'Teams & Groups', subtitle: 'Organizational hierarchy, core teams, and sub-groups' };
      case 'announcements':
        return { title: 'Community Announcements', subtitle: 'Important updates and sprint guidelines' };
      case 'activity':
        return { title: 'Audit Activity Logs', subtitle: 'System-wide event tracking and verification history' };
      case 'components':
        return { title: 'UI Component Library', subtitle: 'Living design tokens and accessible component suite' };
      default:
        return { title: 'TechNeekX Platform', subtitle: 'Community Reporting & Task Management' };
    }
  };

  const { title, subtitle } = getPageInfo();

  return (
    <AppShell
      activeNav={activeNav}
      onNavigate={(id) => setActiveNav(id)}
      title={title}
      subtitle={subtitle}
      user={currentUser}
      onLogout={() => alert('Logout action. Integrated with JWT blacklist in Phase 6.')}
      onSearchChange={(val) => setSearchTerm(val)}
      searchValue={searchTerm}
    >
      {/* Role Preview Switcher Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: 'var(--space-6)',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color="var(--color-primary)" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)' }}>
            Phase 5 UI Preview Mode:
          </span>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            Switch active preview persona:
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {['Founder', 'Official', 'Core Team Lead', 'Member'].map((role) => (
            <Button
              key={role}
              size="sm"
              variant={currentRole === role ? 'primary' : 'secondary'}
              onClick={() => setCurrentRole(role)}
            >
              {role}
            </Button>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveNav('components')}
          >
            Design System
          </Button>
        </div>
      </div>

      {/* Render Selected View */}
      {activeNav === 'dashboard' && (
        <DashboardView
          onNavigateToTasks={() => setActiveNav('tasks')}
          onNavigateToLeaderboard={() => setActiveNav('leaderboard')}
        />
      )}

      {activeNav === 'tasks' && <TasksView />}

      {activeNav === 'leaderboard' && <LeaderboardView />}

      {activeNav === 'components' && <ComponentsShowcaseView />}

      {activeNav === 'submissions' && (
        <Card>
          <CardHeader>
            <CardTitle>Evidence Review Queue</CardTitle>
            <CardDescription>Submissions requiring authorized review.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Submitted By</TableHead>
                  <TableHead>Evidence</TableHead>
                  <TableHead>Submitted At</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell><strong>#2 Prepare API documentation</strong></TableCell>
                  <TableCell>Kabir Member</TableCell>
                  <TableCell>
                    <a href="https://github.com/example/api-docs" target="_blank" rel="noreferrer">
                      github.com/example/api-docs
                    </a>
                  </TableCell>
                  <TableCell>2 hours ago</TableCell>
                  <TableCell>
                    <Button size="sm" variant="primary">Review Submission</Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {activeNav === 'teams' && (
        <Card>
          <CardHeader>
            <CardTitle>Organization Teams & Sub-Groups</CardTitle>
            <CardDescription>Hierarchical team structure from PostgreSQL schema.</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {[
                { name: 'Official Team', type: 'Official', count: 2, parent: 'None (Root)' },
                { name: 'Core Operations', type: 'Core', count: 1, parent: 'Official Team' },
                { name: 'Development Team', type: 'Core', count: 4, parent: 'Official Team' },
                { name: 'Web Group', type: 'Group', count: 2, parent: 'Development Team' },
                { name: 'AI Group', type: 'Group', count: 2, parent: 'Development Team' }
              ].map((t) => (
                <Card key={t.name} hoverable style={{ border: '1px solid var(--color-border)' }}>
                  <CardContent style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontWeight: 600 }}>{t.name}</h4>
                      <Badge variant="primary" size="sm">{t.type}</Badge>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      Parent Team: {t.parent}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      Assigned Members: {t.count} members
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeNav === 'announcements' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card>
            <CardHeader>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <CardTitle>Welcome to TechNeekX Reporting Platform</CardTitle>
                <Badge variant="primary">Official</Badge>
              </div>
              <CardDescription>Posted by Demo Official • Oct 24, 2026</CardDescription>
            </CardHeader>
            <CardContent>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--color-text-main)' }}>
                Welcome to the official TechNeekX task tracking and community reporting system. Use this platform to view your assigned work, collaborate with your teams, submit proof of completion, and earn points on the live leaderboard.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <CardTitle>Sprint #3 Task Review Deadline</CardTitle>
                <Badge variant="warning">Notice</Badge>
              </div>
              <CardDescription>Posted by Demo Founder • Oct 24, 2026</CardDescription>
            </CardHeader>
            <CardContent>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--color-text-main)' }}>
                Team leads: Please ensure all pending proofs are reviewed before the end of the sprint cycle. Any submissions requiring changes should include detailed feedback for the submitter.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {activeNav === 'activity' && (
        <Card>
          <CardHeader>
            <CardTitle>System Audit History</CardTitle>
            <CardDescription>Immutable audit events recorded in database table `history_logs`.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { action: 'POINTS_AWARDED', actor: 'Aarav Core Lead', details: 'Awarded 10 pts to Riya Member for Task #4', time: '10 mins ago' },
                  { action: 'TASK_APPROVED', actor: 'Aarav Core Lead', details: 'Task #4 approved with feedback: Approved!', time: '10 mins ago' },
                  { action: 'PROOF_SUBMITTED', actor: 'Riya Member', details: 'Submitted proof #3 for Task #4', time: '25 mins ago' },
                  { action: 'TASK_CREATED', actor: 'Aarav Core Lead', details: 'Created Task #4: Build task dashboard UI', time: '1 hour ago' },
                ].map((log, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Badge variant="info" size="sm">{log.action}</Badge>
                    </TableCell>
                    <TableCell><strong>{log.actor}</strong></TableCell>
                    <TableCell>{log.details}</TableCell>
                    <TableCell><span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{log.time}</span></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
};

export default App;
