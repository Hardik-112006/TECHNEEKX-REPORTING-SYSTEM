import React, { useState, useEffect } from 'react'
import { Activity, RefreshCw, Download } from 'lucide-react'
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
  Button,
  Badge,
  Pagination,
  Skeleton,
  EmptyState,
  Breadcrumbs,
  Alert
} from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { activityApi } from '../services/api'
import type { HistoryLog } from '../types/api'

export const ActivityLogsView: React.FC = () => {
  const { roleTier } = useAuth()
  const [logs, setLogs] = useState<HistoryLog[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const loadLogs = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await activityApi.getActivityLogs({ page })
      setLogs(res.results || [])
      setTotalCount(res.count || 0)
    } catch (err: any) {
      setError(err?.message || 'Failed to load activity logs.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportCsv = async () => {
    setIsExporting(true)
    setError(null)
    try {
      const blob = await activityApi.exportCsv()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `techneekx_audit_history_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err: any) {
      setError(err?.message || 'Failed to export audit history.')
    } finally {
      setIsExporting(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [page])

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'System' }, { label: 'Activity & Audit History' }]} />

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit & Security Activity Logs</h1>
          <p className="text-sm text-gray-500">
            {roleTier <= 2
              ? 'Complete organization-wide immutable audit trail of actions, logins, task status shifts, and point awards.'
              : 'Your personal audit log trail of submissions and state changes.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            isLoading={isExporting}
            leftIcon={<Download size={14} />}
          >
            Download / Export (CSV)
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadLogs}
            isLoading={isLoading}
            leftIcon={<RefreshCw size={14} />}
          >
            Refresh Logs
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="danger" title="Notice" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>System Event Stream</CardTitle>
          <CardDescription>Chronological sequence of verified actions recorded in database.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton height="40px" />
              <Skeleton height="40px" />
              <Skeleton height="40px" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Activity size={32} />}
                title="No Events Recorded"
                description="No audit trail events have occurred in this scope yet."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <tbody>
                {logs.map((log) => (
                  <TableRow key={log.log_id}>
                    <TableCell>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="table-member-cell">
                        <span className="member-name">{log.user?.name || 'System User'}</span>
                        <span className="member-email">{log.user?.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" size="sm">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-gray-700 leading-normal">{log.details}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          )}

          {totalCount > 20 && (
            <div className="p-4 border-t border-gray-200 flex justify-end">
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
