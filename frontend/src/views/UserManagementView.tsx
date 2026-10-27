import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search, ShieldCheck, UserCheck, UserX, Megaphone } from 'lucide-react'
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
  Input,
  Select,
  Alert,
  Skeleton,
  EmptyState,
  Pagination
} from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { authApi, teamsApi, usersApi } from '../services/api'
import type { Group, Role, UserSummary } from '../types/api'
import './UserManagementView.css'

const PAGE_SIZE = 20

// Mirrors backend get_user_hierarchy_level so the UI only offers changes the API will accept
const ROLE_LEVELS: Record<string, number> = {
  Founder: 1,
  Chairman: 2,
  'Managing Director': 2,
  President: 2,
  Official: 2,
  'Director of Core Operations': 3,
  'Core Lead': 4,
  'Core Team Lead': 4,
  Member: 5
}
const roleLevel = (name?: string) => (name && ROLE_LEVELS[name]) || 5

export const UserManagementView: React.FC = () => {
  const { user: me, roleName } = useAuth()
  const isFounder = roleName === 'Founder'
  const myLevel = roleLevel(roleName)

  const [users, setUsers] = useState<UserSummary[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [roles, setRoles] = useState<Role[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [savingUserId, setSavingUserId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [list, pending] = await Promise.all([
        usersApi.getUsers({ page, page_size: PAGE_SIZE, search: search.trim() || undefined, status: statusFilter || undefined }),
        usersApi.getUsers({ status: 'Pending', page_size: 1 })
      ])
      setUsers(list.results || [])
      setTotalCount(list.count || 0)
      setPendingCount(pending.count || 0)
    } catch (err: any) {
      setError(err?.message || 'Failed to load users.')
    } finally {
      setIsLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => {
    const timer = window.setTimeout(loadUsers, search ? 300 : 0)
    return () => window.clearTimeout(timer)
  }, [loadUsers, search])

  useEffect(() => {
    authApi.getRoles().then(setRoles).catch(() => setRoles([]))
    teamsApi.getGroups().then((res) => setGroups(res.results || [])).catch(() => setGroups([]))
  }, [])

  // Roles the current user may grant: strictly below their own level (Founder: any)
  const grantableRoles = useMemo(
    () => roles.filter((r) => isFounder || roleLevel(r.name) > myLevel),
    [roles, isFounder, myLevel]
  )

  const canManage = (target: UserSummary) =>
    target.user_id !== me?.user_id && (isFounder || roleLevel(target.role_name) > myLevel)

  const applyChange = async (
    target: UserSummary,
    changes: Parameters<typeof usersApi.manageUser>[1],
    message: string
  ) => {
    setSavingUserId(target.user_id)
    setError(null)
    try {
      const res = await usersApi.manageUser(target.user_id, changes)
      setUsers((prev) => prev.map((u) => (u.user_id === target.user_id ? { ...u, ...res.user } : u)))
      if (changes.status) {
        setPendingCount((c) => Math.max(0, c + (target.status === 'Pending' ? -1 : 0)))
      }
      setSuccess(message)
    } catch (err: any) {
      setError(err?.message || `Failed to update ${target.name}.`)
    } finally {
      setSavingUserId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div className="user-mgmt-container">
      <div className="user-mgmt-header">
        <div>
          <h1 className="user-mgmt-title">Members & Roles</h1>
          <p className="user-mgmt-subtitle">
            Approve registrations, assign roles and groups, and grant announcement rights.
            {!isFounder && ' You can manage users ranked below you.'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadUsers} isLoading={isLoading} leftIcon={<RefreshCw size={14} />}>
          Refresh
        </Button>
      </div>

      {success && (
        <Alert variant="success" title="Saved" description={success} onClose={() => setSuccess(null)} className="mb-4" />
      )}
      {error && (
        <Alert variant="danger" title="Could not complete the change" description={error} onClose={() => setError(null)} className="mb-4" />
      )}

      {pendingCount > 0 && statusFilter !== 'Pending' && (
        <button type="button" className="user-mgmt-pending-banner" onClick={() => { setStatusFilter('Pending'); setPage(1) }}>
          <UserCheck size={18} aria-hidden="true" />
          <span>
            <strong>{pendingCount}</strong> registration{pendingCount === 1 ? '' : 's'} awaiting approval
          </span>
          <span className="user-mgmt-pending-cta">Review</span>
        </button>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Community Directory</CardTitle>
          <CardDescription>{totalCount} account{totalCount === 1 ? '' : 's'} match the current filters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="user-mgmt-filters">
            <div className="user-mgmt-search">
              <Search size={16} className="user-mgmt-search-icon" aria-hidden="true" />
              <Input
                aria-label="Search by name or email"
                placeholder="Search by name or email"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
            <Select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              options={[
                { value: '', label: 'All statuses' },
                { value: 'Active', label: 'Active' },
                { value: 'Pending', label: 'Pending approval' },
                { value: 'Inactive', label: 'Inactive' }
              ]}
            />
          </div>

          {isLoading && users.length === 0 ? (
            <div className="user-mgmt-skeletons">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} height="52px" />)}
            </div>
          ) : users.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck size={32} />}
              title="No accounts found"
              description="Try a different search or status filter."
            />
          ) : (
            <div className="user-mgmt-table-wrap">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Announcements</TableHead>
                    <TableHead style={{ textAlign: 'right' }}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <tbody>
                  {users.map((u) => {
                    const editable = canManage(u)
                    const busy = savingUserId === u.user_id
                    const isOfficialRole = roleLevel(u.role_name) <= 2
                    return (
                      <TableRow key={u.user_id}>
                        <TableCell>
                          <div className="user-mgmt-identity">
                            <span className="user-mgmt-name">{u.name}</span>
                            <span className="user-mgmt-email">{u.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {editable ? (
                            <Select
                              aria-label={`Role for ${u.name}`}
                              value={String(u.role_id ?? '')}
                              disabled={busy}
                              onChange={(e) => {
                                const role = roles.find((r) => String(r.role_id) === e.target.value)
                                if (role && window.confirm(`Change ${u.name}'s role to ${role.name}?`)) {
                                  applyChange(u, { role_id: role.role_id }, `${u.name} is now ${role.name}.`)
                                }
                              }}
                              options={[
                                ...(grantableRoles.some((r) => r.role_id === u.role_id)
                                  ? []
                                  : [{ value: String(u.role_id ?? ''), label: u.role_name || 'Unknown' }]),
                                ...grantableRoles.map((r) => ({ value: String(r.role_id), label: r.name }))
                              ]}
                            />
                          ) : (
                            <span className="user-mgmt-readonly">{u.position || u.role_name}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editable && !isOfficialRole ? (
                            <Select
                              aria-label={`Group for ${u.name}`}
                              value={String(u.group_id ?? '')}
                              disabled={busy}
                              onChange={(e) => {
                                const groupId = e.target.value ? Number(e.target.value) : null
                                const group = groups.find((g) => g.group_id === groupId)
                                applyChange(u, { group_id: groupId, team_id: group ? group.team : null },
                                  group ? `${u.name} moved to ${group.name}.` : `${u.name} removed from their group.`)
                              }}
                              options={[
                                { value: '', label: 'No group' },
                                ...groups.map((g) => ({ value: String(g.group_id), label: g.name }))
                              ]}
                            />
                          ) : (
                            <span className="user-mgmt-readonly">{u.group_name || '—'}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge status={u.status} size="sm">{u.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {isOfficialRole ? (
                            <span className="user-mgmt-readonly">Always allowed</span>
                          ) : (
                            <label className="user-mgmt-toggle">
                              <input
                                type="checkbox"
                                checked={!!u.can_post_announcements}
                                disabled={!editable || busy}
                                onChange={(e) =>
                                  applyChange(u, { can_post_announcements: e.target.checked },
                                    e.target.checked
                                      ? `${u.name} can now publish announcements.`
                                      : `${u.name} can no longer publish announcements.`)
                                }
                              />
                              <Megaphone size={14} aria-hidden="true" />
                              <span>{u.can_post_announcements ? 'Granted' : 'Not granted'}</span>
                            </label>
                          )}
                        </TableCell>
                        <TableCell style={{ textAlign: 'right' }}>
                          {!editable ? (
                            <span className="user-mgmt-readonly">{u.user_id === me?.user_id ? 'You' : 'Outranks you'}</span>
                          ) : u.status === 'Active' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              isLoading={busy}
                              leftIcon={<UserX size={14} />}
                              onClick={() => {
                                if (window.confirm(`Deactivate ${u.name}? They will no longer be able to sign in.`)) {
                                  applyChange(u, { status: 'Inactive' }, `${u.name} was deactivated.`)
                                }
                              }}
                            >
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              isLoading={busy}
                              leftIcon={<UserCheck size={14} />}
                              onClick={() => applyChange(u, { status: 'Active' },
                                u.status === 'Pending' ? `${u.name}'s registration was approved.` : `${u.name} was reactivated.`)}
                            >
                              {u.status === 'Pending' ? 'Approve' : 'Reactivate'}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </tbody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={totalCount}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default UserManagementView
