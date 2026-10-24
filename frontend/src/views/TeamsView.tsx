import React, { useState, useEffect } from 'react'
import {
  Users,
  UserPlus,
  UserMinus,
  FolderTree,
  Plus,
  RefreshCw
} from 'lucide-react'
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
  Modal,
  Alert,
  Skeleton,
  EmptyState,
  Breadcrumbs
} from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { teamsApi, usersApi } from '../services/api'
import type { TeamSummary, TeamDetail, UserSummary } from '../types/api'
import './TeamsView.css'

export const TeamsView: React.FC = () => {
  const { roleTier } = useAuth()

  const [teams, setTeams] = useState<TeamSummary[]>([])
  const [selectedTeam, setSelectedTeam] = useState<TeamDetail | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)

  // Add member modal state
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false)
  const [candidateUsers, setCandidateUsers] = useState<UserSummary[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [isAdding, setIsAdding] = useState<boolean>(false)

  // Create team modal state (Tier 1-2)
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false)
  const [teamName, setTeamName] = useState<string>('')
  const [teamType, setTeamType] = useState<string>('Core')
  const [teamDesc, setTeamDesc] = useState<string>('')
  const [parentTeamId, setParentTeamId] = useState<string>('')
  const [isCreating, setIsCreating] = useState<boolean>(false)

  const loadTeams = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await teamsApi.getTeams()
      setTeams(res.results || [])
      if (res.results && res.results.length > 0 && !selectedTeam) {
        loadTeamDetail(res.results[0].team_id)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load teams.')
    } finally {
      setIsLoading(false)
    }
  }

  const loadTeamDetail = async (teamId: number) => {
    try {
      const detail = await teamsApi.getTeam(teamId)
      setSelectedTeam(detail)
    } catch (err: any) {
      setError(err?.message || 'Failed to load team details.')
    }
  }

  useEffect(() => {
    loadTeams()
  }, [])

  // Open add member modal
  const handleOpenAddMember = async () => {
    if (!selectedTeam) return
    setIsAddOpen(true)
    setSelectedUserId('')
    try {
      const res = await usersApi.getUsers()
      // Filter out users already in this team
      const existingIds = new Set(selectedTeam.members.map((m) => m.user_id))
      setCandidateUsers((res.results || []).filter((u) => !existingIds.has(u.user_id)))
    } catch (err) {
      console.error('Error fetching users', err)
    }
  }

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTeam || !selectedUserId) return
    setIsAdding(true)
    try {
      const res = await teamsApi.addMember(selectedTeam.team_id, Number(selectedUserId))
      setSuccessBanner(res.message || 'Member added to team successfully.')
      setIsAddOpen(false)
      loadTeamDetail(selectedTeam.team_id)
      loadTeams()
    } catch (err: any) {
      setError(err?.message || 'Failed to add member to team.')
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemoveMember = async (userId: number, memberName: string) => {
    if (!selectedTeam) return
    if (!window.confirm(`Are you sure you want to remove ${memberName} from ${selectedTeam.name}?`)) {
      return
    }

    try {
      const res = await teamsApi.removeMember(selectedTeam.team_id, userId)
      setSuccessBanner(res.message || 'Member removed successfully.')
      loadTeamDetail(selectedTeam.team_id)
      loadTeams()
    } catch (err: any) {
      setError(err?.message || 'Failed to remove member from team.')
    }
  }

  const handleCreateTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!teamName.trim()) return
    setIsCreating(true)
    try {
      await teamsApi.createTeam({
        name: teamName.trim(),
        type: teamType,
        description: teamDesc.trim() || undefined,
        parent_team: parentTeamId ? Number(parentTeamId) : null
      })
      setSuccessBanner(`Team '${teamName}' created successfully.`)
      setIsCreateOpen(false)
      setTeamName('')
      setTeamDesc('')
      setParentTeamId('')
      loadTeams()
    } catch (err: any) {
      setError(err?.message || 'Failed to create team.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="teams-view-container">
      <Breadcrumbs items={[{ label: 'Organization' }, { label: 'Teams & Groups' }]} />

      <div className="teams-header">
        <div>
          <h1 className="teams-title">Teams & Organizational Groups</h1>
          <p className="teams-subtitle">
            Hierarchical parent-team architecture, sub-teams, and role-enforced member assignments.
          </p>
        </div>

        <div className="teams-actions-header">
          <Button
            variant="outline"
            size="sm"
            onClick={loadTeams}
            isLoading={isLoading}
            leftIcon={<RefreshCw size={14} />}
          >
            Refresh
          </Button>
          {roleTier <= 2 && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              leftIcon={<Plus size={16} />}
            >
              Create Team
            </Button>
          )}
        </div>
      </div>

      {successBanner && (
        <Alert
          variant="success"
          title="Operation Succeeded"
          description={successBanner}
          onClose={() => setSuccessBanner(null)}
          className="mb-4"
        />
      )}

      {error && (
        <Alert
          variant="danger"
          title="Notice"
          description={error}
          onClose={() => setError(null)}
          className="mb-4"
        />
      )}

      <div className="teams-layout-grid">
        {/* Teams Directory Sidebar */}
        <div className="teams-list-column">
          <Card>
            <CardHeader>
              <CardTitle>Teams Directory</CardTitle>
              <CardDescription>Select a team to inspect roster</CardDescription>
            </CardHeader>
            <CardContent className="teams-directory-content">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton height="44px" />
                  <Skeleton height="44px" />
                  <Skeleton height="44px" />
                </div>
              ) : teams.length === 0 ? (
                <p className="text-muted p-4">No teams created yet.</p>
              ) : (
                <div className="teams-nav-list">
                  {teams.map((t) => {
                    const isSelected = selectedTeam?.team_id === t.team_id
                    return (
                      <button
                        key={t.team_id}
                        type="button"
                        className={`team-nav-item ${isSelected ? 'active' : ''}`}
                        onClick={() => loadTeamDetail(t.team_id)}
                      >
                        <div className="team-nav-info">
                          <span className="team-nav-name">{t.name}</span>
                          <span className="team-nav-type">
                            {t.type} {t.parent_team_name ? `• Under ${t.parent_team_name}` : ''}
                          </span>
                        </div>
                        <span className="team-nav-count">{t.member_count} members</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Selected Team Details Column */}
        <div className="team-detail-column">
          {selectedTeam ? (
            <div className="team-detail-stack">
              <Card>
                <CardHeader>
                  <div className="team-detail-header-flex">
                    <div>
                      <div className="team-title-row">
                        <CardTitle>{selectedTeam.name}</CardTitle>
                        <Badge variant="primary" size="sm">
                          {selectedTeam.type} Team
                        </Badge>
                      </div>
                      <CardDescription>
                        {selectedTeam.description || 'No description provided.'}
                      </CardDescription>
                    </div>

                    {roleTier <= 3 && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleOpenAddMember}
                        leftIcon={<UserPlus size={14} />}
                      >
                        Add Member
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="table-card-content">
                  <div className="roster-heading-bar">
                    <h4>Assigned Roster ({selectedTeam.members.length})</h4>
                  </div>

                  {selectedTeam.members.length === 0 ? (
                    <EmptyState
                      icon={<Users size={32} />}
                      title="No Members Assigned"
                      description="This team currently has no members assigned to it."
                      action={
                        roleTier <= 3 ? (
                          <Button variant="primary" size="sm" onClick={handleOpenAddMember}>
                            Assign First Member
                          </Button>
                        ) : undefined
                      }
                    />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          {roleTier <= 3 && (
                            <TableHead style={{ textAlign: 'right' }}>Actions</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <tbody>
                        {selectedTeam.members.map((m) => (
                          <TableRow key={m.user_id}>
                            <TableCell>
                              <div className="table-member-cell">
                                <span className="member-name">{m.name}</span>
                                <span className="member-email">{m.email}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" size="sm">
                                {m.role?.name || m.role_name || 'Member'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="status-indicator-dot active" /> Active
                            </TableCell>
                            {roleTier <= 3 && (
                              <TableCell style={{ textAlign: 'right' }}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveMember(m.user_id, m.name)}
                                  title="Remove from Team"
                                  className="text-danger-btn"
                                  leftIcon={<UserMinus size={14} />}
                                >
                                  Remove
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Sub-Teams and Groups (if present) */}
              {(selectedTeam.sub_teams?.length > 0 || selectedTeam.groups?.length > 0) && (
                <div className="sub-units-grid">
                  {selectedTeam.sub_teams?.length > 0 && (
                    <Card>
                      <CardHeader>
                        <div className="header-with-icon">
                          <FolderTree size={16} className="text-primary" />
                          <CardTitle>Nested Sub-Teams</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <ul className="sub-units-list">
                          {selectedTeam.sub_teams.map((st) => (
                            <li key={st.team_id} className="sub-unit-item">
                              <span>{st.name}</span>
                              <Badge size="sm">{st.member_count} members</Badge>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {selectedTeam.groups?.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Specialized Working Groups</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="sub-units-list">
                          {selectedTeam.groups.map((grp) => (
                            <li key={grp.group_id} className="sub-unit-item">
                              <span>{grp.name}</span>
                              <span className="text-muted text-xs">{grp.description}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted">
                Select a team from the directory to inspect members and hierarchy.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add Member Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title={`Add Member to ${selectedTeam?.name}`}
        size="md"
      >
        <form onSubmit={handleAddMemberSubmit} className="modal-form-layout">
          <p className="modal-note-text">
            Assign an active community member to this team. Members gain access to team-allocated deliverables.
          </p>

          <Select
            label="Select Member *"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            required
          >
            <option value="">-- Choose Candidate --</option>
            {candidateUsers.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.name} ({u.role?.name || u.role_name || 'Member'}) - {u.email}
              </option>
            ))}
          </Select>

          <div className="modal-button-footer">
            <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isAdding} leftIcon={<UserPlus size={14} />}>
              Add to Team
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Team Modal (Tier 1-2) */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Team"
        size="md"
      >
        <form onSubmit={handleCreateTeamSubmit} className="modal-form-layout">
          <Input
            label="Team Name *"
            placeholder="e.g. Mobile Engineering Team"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            required
          />

          <Select
            label="Team Classification *"
            value={teamType}
            onChange={(e) => setTeamType(e.target.value)}
            required
          >
            <option value="Core">Core Team</option>
            <option value="Group">Working Group</option>
            <option value="Division">Regional Division</option>
          </Select>

          <Select
            label="Parent Team (Optional)"
            value={parentTeamId}
            onChange={(e) => setParentTeamId(e.target.value)}
          >
            <option value="">-- Top Level Team (No Parent) --</option>
            {teams.map((t) => (
              <option key={t.team_id} value={t.team_id}>
                {t.name} ({t.type})
              </option>
            ))}
          </Select>

          <Input
            label="Description"
            placeholder="Focus area and operational mandate..."
            value={teamDesc}
            onChange={(e) => setTeamDesc(e.target.value)}
          />

          <div className="modal-button-footer">
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isCreating}>
              Create Team
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
