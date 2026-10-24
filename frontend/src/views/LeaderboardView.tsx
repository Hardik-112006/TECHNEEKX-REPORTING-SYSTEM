import React from 'react';
import { Trophy, Medal, Award, Flame } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import './LeaderboardView.css';

export const LeaderboardView: React.FC = () => {
  const leaders = [
    { rank: 1, name: 'Kabir Member', email: 'kabir.member@example.com', team: 'Development Team', points: 35, tasksApproved: 3, badge: 'Gold Contributor' },
    { rank: 2, name: 'Riya Member', email: 'riya.member@example.com', team: 'Development Team', points: 30, tasksApproved: 3, badge: 'Silver Contributor' },
    { rank: 3, name: 'Meera Group Leader', email: 'meera.leader@example.com', team: 'Official Team', points: 15, tasksApproved: 1, badge: 'Bronze Contributor' },
    { rank: 4, name: 'Aarav Core Lead', email: 'aarav.lead@example.com', team: 'Development Team', points: 10, tasksApproved: 1, badge: 'Sprint Contributor' },
    { rank: 5, name: 'Demo Official', email: 'official@example.com', team: 'Official Team', points: 0, tasksApproved: 0, badge: 'Official Reviewer' },
  ];

  return (
    <div className="leaderboard-page">
      <Breadcrumbs items={[{ label: 'Community' }, { label: 'Leaderboard Rankings' }]} />

      <div className="leaderboard-hero">
        <div className="hero-icon-bubble">
          <Trophy size={28} />
        </div>
        <h2 className="leaderboard-heading">Community Performance Leaderboard</h2>
        <p className="leaderboard-subheading">
          Points are awarded automatically upon task approval (+10 points per approved submission).
        </p>
      </div>

      {/* Top 3 Podium Cards */}
      <div className="podium-grid">
        {leaders.slice(0, 3).map((item) => (
          <Card key={item.name} hoverable className={`podium-card podium-card-${item.rank}`}>
            <CardContent className="podium-content">
              <div className="podium-rank-badge">
                {item.rank === 1 && <Trophy size={18} className="podium-icon-gold" />}
                {item.rank === 2 && <Medal size={18} className="podium-icon-silver" />}
                {item.rank === 3 && <Award size={18} className="podium-icon-bronze" />}
                <span>Rank #{item.rank}</span>
              </div>
              <div className="podium-avatar">
                {item.name.charAt(0)}
              </div>
              <h3 className="podium-name">{item.name}</h3>
              <span className="podium-team">{item.team}</span>
              <div className="podium-points-pill">
                <Flame size={14} className="flame-icon" />
                <span>{item.points} Points</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Full Leaderboard Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Community Rankings</CardTitle>
          <CardDescription>Live standings updated in real time with each approved task.</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Approved Tasks</TableHead>
              <TableHead>Recognition</TableHead>
              <TableHead>Total Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaders.map((leader) => (
              <TableRow key={leader.email}>
                <TableCell>
                  <span className={`table-rank-pill ${leader.rank <= 3 ? `top-rank-${leader.rank}` : ''}`}>
                    #{leader.rank}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="table-member-cell">
                    <span className="member-name">{leader.name}</span>
                    <span className="member-email">{leader.email}</span>
                  </div>
                </TableCell>
                <TableCell>{leader.team}</TableCell>
                <TableCell>{leader.tasksApproved} tasks</TableCell>
                <TableCell>
                  <Badge variant={leader.rank === 1 ? 'warning' : 'primary'} size="sm">
                    {leader.badge}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="table-points-text">{leader.points} pts</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};
