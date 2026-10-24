import React from 'react';
import {
  CheckCircle2,
  Clock,
  FileText,
  Trophy,
  ArrowRight
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Alert } from '../components/ui/Alert';
import './DashboardView.css';

export interface DashboardViewProps {
  onNavigateToTasks: () => void;
  onNavigateToLeaderboard: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToTasks,
  onNavigateToLeaderboard
}) => {
  // Prototype metrics for layout verification
  const metrics = [
    { title: 'Assigned Tasks', count: 12, icon: <FileText size={20} />, change: '+2 new today', color: 'primary' },
    { title: 'In Progress', count: 8, icon: <Clock size={20} />, change: '3 active', color: 'warning' },
    { title: 'Submitted for Review', count: 5, icon: <CheckCircle2 size={20} />, change: 'Needs action', color: 'info' },
    { title: 'Approved Tasks', count: 42, icon: <Trophy size={20} />, change: '+400 points', color: 'success' },
  ];

  const recentTasks = [
    { id: 1, title: 'Build task dashboard UI', assignee: 'Riya Member', team: 'Development Team', status: 'In Progress', deadline: 'In 5 days' },
    { id: 2, title: 'Prepare API documentation', assignee: 'Kabir Member', team: 'Development Team', status: 'Submitted', deadline: 'In 3 days' },
    { id: 3, title: 'Publish onboarding announcement', assignee: 'Meera Group Leader', team: 'Official Team', status: 'Approved', deadline: 'Completed' },
    { id: 4, title: 'Setup PostgreSQL migrations', assignee: 'Aarav Core Lead', team: 'Development Team', status: 'Assigned', deadline: 'In 7 days' },
  ];

  return (
    <div className="dashboard-page">
      {/* Welcome Banner */}
      <Alert
        variant="info"
        title="Community Sprint Active"
      >
        Sprint #3 is currently underway. Team leads should review pending task proofs before the weekly sync.
      </Alert>

      {/* Metric Cards Grid */}
      <div className="metrics-grid">
        {metrics.map((m) => (
          <Card key={m.title} hoverable className="metric-card">
            <CardContent className="metric-content">
              <div className="metric-header">
                <span className="metric-label">{m.title}</span>
                <div className={`metric-icon-bubble metric-icon-${m.color}`}>
                  {m.icon}
                </div>
              </div>
              <div className="metric-value-row">
                <span className="metric-number">{m.count}</span>
                <span className="metric-change">{m.change}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="dashboard-grid-layout">
        {/* Recent Tasks */}
        <div className="dashboard-main-col">
          <Card>
            <CardHeader className="card-header-action">
              <div>
                <CardTitle>Recent Task Activity</CardTitle>
                <CardDescription>Latest task assignments and review progress across your teams.</CardDescription>
              </div>
              <Button size="sm" variant="outline" rightIcon={<ArrowRight size={14} />} onClick={onNavigateToTasks}>
                View All
              </Button>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Deadline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTasks.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <span className="task-row-title">{t.title}</span>
                    </TableCell>
                    <TableCell>{t.assignee}</TableCell>
                    <TableCell>
                      <span className="team-subtext">{t.team}</span>
                    </TableCell>
                    <TableCell>
                      <Badge status={t.status} dot />
                    </TableCell>
                    <TableCell>
                      <span className="deadline-text">{t.deadline}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* Sidebar Column: Leaderboard preview */}
        <div className="dashboard-side-col">
          <Card>
            <CardHeader className="card-header-action">
              <div>
                <CardTitle>Top Contributors</CardTitle>
                <CardDescription>Community leaderboard</CardDescription>
              </div>
              <Button size="sm" variant="ghost" onClick={onNavigateToLeaderboard}>
                Full Board
              </Button>
            </CardHeader>
            <CardContent className="leaderboard-preview-list">
              <div className="leader-item">
                <div className="leader-rank rank-1">#1</div>
                <div className="leader-info">
                  <span className="leader-name">Kabir Member</span>
                  <span className="leader-team">Development Team</span>
                </div>
                <Badge variant="primary">35 pts</Badge>
              </div>
              <div className="leader-item">
                <div className="leader-rank rank-2">#2</div>
                <div className="leader-info">
                  <span className="leader-name">Riya Member</span>
                  <span className="leader-team">Development Team</span>
                </div>
                <Badge variant="primary">30 pts</Badge>
              </div>
              <div className="leader-item">
                <div className="leader-rank rank-3">#3</div>
                <div className="leader-info">
                  <span className="leader-name">Meera Group Leader</span>
                  <span className="leader-team">Official Team</span>
                </div>
                <Badge variant="primary">15 pts</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
