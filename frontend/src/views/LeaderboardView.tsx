import React, { useState, useEffect } from 'react'
import { Trophy, Medal, Award, Flame, RefreshCw, AlertCircle } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Table,
  TableHeader,
  TableRow,
  TableCell,
  TableHead,
  Breadcrumbs,
  Button,
  Badge,
  Pagination,
  Skeleton,
  EmptyState,
  Alert
} from '../components/ui'
import { scoringApi } from '../services/api'
import type { Performance } from '../types/api'
import './LeaderboardView.css'

export const LeaderboardView: React.FC = () => {
  const [standings, setStandings] = useState<Performance[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const loadLeaderboard = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await scoringApi.getLeaderboard(page)
      setStandings(res.results || [])
      setTotalCount(res.count || 0)
    } catch (err: any) {
      setError(err?.message || 'Failed to load live leaderboard.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadLeaderboard()
  }, [page])

  const topThree = standings.slice(0, 3)

  return (
    <div className="leaderboard-page">
      <Breadcrumbs items={[{ label: 'Community' }, { label: 'Leaderboard Rankings' }]} />

      <div className="leaderboard-hero-row">
        <div className="leaderboard-hero">
          <div className="hero-icon-bubble">
            <Trophy size={28} />
          </div>
          <div>
            <h2 className="leaderboard-heading">Community Performance Leaderboard</h2>
            <p className="leaderboard-subheading">
              Points are awarded automatically when a submission is approved; each task carries its own points value.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadLeaderboard}
          isLoading={isLoading}
          leftIcon={<RefreshCw size={14} />}
        >
          Refresh Standings
        </Button>
      </div>

      {error && (
        <Alert
          variant="danger"
          title="Data Synchronization Notice"
          description={error}
          className="mb-4"
        />
      )}

      {/* Top 3 Podium Cards */}
      {topThree.length > 0 && (
        <div className="podium-grid">
          {topThree.map((item, idx) => {
            const rank = idx + 1
            return (
              <Card key={item.performance_id} hoverable className={`podium-card podium-card-${rank}`}>
                <CardContent className="podium-content">
                  <div className="podium-rank-badge">
                    {rank === 1 && <Trophy size={18} className="podium-icon-gold" />}
                    {rank === 2 && <Medal size={18} className="podium-icon-silver" />}
                    {rank === 3 && <Award size={18} className="podium-icon-bronze" />}
                    <span>Rank #{rank}</span>
                  </div>
                  <div className="podium-avatar">
                    {item.user?.name ? item.user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <h3 className="podium-name">{item.user?.name || 'Anonymous Member'}</h3>
                  <span className="podium-team">{item.user?.team_name || 'Community Member'}</span>
                  <div className="podium-points-pill">
                    <Flame size={14} className="flame-icon" />
                    <span>{item.points} Points</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Full Leaderboard Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Community Rankings</CardTitle>
          <CardDescription>Live standings updated in real time from database performance records.</CardDescription>
        </CardHeader>
        <CardContent className="table-card-content">
          {isLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton height="40px" />
              <Skeleton height="50px" />
              <Skeleton height="50px" />
            </div>
          ) : standings.length === 0 ? (
            <EmptyState
              icon={<AlertCircle size={32} />}
              title="No Leaderboard Records"
              description="No approved task completions have been recorded in the database yet."
            />
          ) : (
            <div className="table-wrapper">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Completed Tasks</TableHead>
                    <TableHead style={{ textAlign: 'right' }}>Total Points</TableHead>
                  </TableRow>
                </TableHeader>
                <tbody>
                  {standings.map((item, idx) => {
                    const displayRank = (page - 1) * 20 + idx + 1
                    return (
                      <TableRow key={item.performance_id}>
                        <TableCell>
                          <span className={`table-rank-pill ${displayRank <= 3 ? `top-rank-${displayRank}` : ''}`}>
                            #{displayRank}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="table-member-cell">
                            <span className="member-name">{item.user?.name}</span>
                            <span className="member-email">{item.user?.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" size="sm">
                            {item.user?.role?.name || item.user?.role_name || 'Member'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.user?.team_name || <span className="text-muted">Unassigned</span>}
                        </TableCell>
                        <TableCell>
                          <strong>{item.tasks_completed}</strong> completed
                        </TableCell>
                        <TableCell style={{ textAlign: 'right' }}>
                          <span className="table-points-text">{item.points} pts</span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </tbody>
              </Table>
            </div>
          )}

          {totalCount > 20 && (
            <div className="table-pagination-footer">
              <Pagination
                currentPage={page}
                totalPages={Math.ceil(totalCount / 20)}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
