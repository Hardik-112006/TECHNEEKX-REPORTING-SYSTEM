import React, { useState } from 'react';
import {
  Plus,
  Search,
  CheckCircle,
  Play,
  Upload,
  Calendar,
  User,
  Users
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, type TaskStatus } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Textarea } from '../components/ui/Textarea';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState } from '../components/ui/EmptyState';
import './TasksView.css';

export const TasksView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [githubUrl, setGithubUrl] = useState('');
  const [proofDesc, setProofDesc] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const sampleTasks = [
    {
      id: 1,
      title: 'Build task dashboard UI',
      description: 'Create a responsive SaaS dashboard displaying assigned tasks and their statuses conforming to the project style guide.',
      assignee: 'Riya Member',
      team: 'Development Team',
      status: 'In Progress' as TaskStatus,
      deadline: 'Nov 02, 2026',
      proofsCount: 0
    },
    {
      id: 2,
      title: 'Prepare API documentation',
      description: 'Document task, submission, review, and announcement endpoints with sample request/response payloads.',
      assignee: 'Kabir Member',
      team: 'Development Team',
      status: 'Submitted' as TaskStatus,
      deadline: 'Oct 30, 2026',
      proofsCount: 1
    },
    {
      id: 3,
      title: 'Publish onboarding announcement',
      description: 'Prepare and publish a short community onboarding announcement for new joiners.',
      assignee: 'Meera Group Leader',
      team: 'Official Team',
      status: 'Approved' as TaskStatus,
      deadline: 'Oct 28, 2026',
      proofsCount: 1
    },
    {
      id: 4,
      title: 'Implement PostgreSQL transactional scoring',
      description: 'Ensure double-review API calls do not duplicate score awards using select_for_update row locking.',
      assignee: 'Riya Member',
      team: 'Development Team',
      status: 'Changes Requested' as TaskStatus,
      deadline: 'Nov 05, 2026',
      proofsCount: 2
    }
  ];

  const filterTabs = ['All', 'Assigned', 'In Progress', 'Submitted', 'Approved', 'Changes Requested'];

  const filteredTasks = sampleTasks.filter((task) => {
    const matchesTab = activeTab === 'All' || task.status === activeTab;
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          task.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleOpenSubmit = (task: any) => {
    setSelectedTask(task);
    setIsSubmitModalOpen(true);
  };

  return (
    <div className="tasks-page">
      <Breadcrumbs items={[{ label: 'Workspace' }, { label: 'Task Management' }]} />

      <div className="page-header-row">
        <div>
          <h2 className="page-heading">Tasks & Assignments</h2>
          <p className="page-subheading">Track assigned tasks, submit proofs, and review work.</p>
        </div>
        <Button leftIcon={<Plus size={16} />}>
          Create Task
        </Button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="tasks-toolbar">
        <div className="status-tabs">
          {filterTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`status-tab-btn ${activeTab === tab ? 'status-tab-active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="tasks-search">
          <Input
            placeholder="Search task title or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search size={16} />}
          />
        </div>
      </div>

      {/* Task Cards Grid */}
      {filteredTasks.length === 0 ? (
        <EmptyState
          title="No tasks found"
          description="There are no tasks matching the selected status or search filter."
          action={<Button variant="outline" onClick={() => { setActiveTab('All'); setSearchTerm(''); }}>Clear Filters</Button>}
        />
      ) : (
        <div className="tasks-card-list">
          {filteredTasks.map((t) => (
            <Card key={t.id} hoverable className="task-item-card">
              <CardContent className="task-item-content">
                <div className="task-card-header">
                  <div className="task-title-group">
                    <span className="task-id-tag">#{t.id}</span>
                    <h3 className="task-card-title">{t.title}</h3>
                  </div>
                  <Badge status={t.status} dot />
                </div>

                <p className="task-card-desc">{t.description}</p>

                <div className="task-meta-row">
                  <div className="meta-badge">
                    <User size={14} />
                    <span>{t.assignee}</span>
                  </div>
                  <div className="meta-badge">
                    <Users size={14} />
                    <span>{t.team}</span>
                  </div>
                  <div className="meta-badge">
                    <Calendar size={14} />
                    <span>{t.deadline}</span>
                  </div>
                </div>

                <div className="task-actions-row">
                  {t.status === 'Assigned' && (
                    <Button size="sm" variant="secondary" leftIcon={<Play size={14} />}>
                      Start Task
                    </Button>
                  )}
                  {(t.status === 'In Progress' || t.status === 'Changes Requested') && (
                    <Button
                      size="sm"
                      variant="primary"
                      leftIcon={<Upload size={14} />}
                      onClick={() => handleOpenSubmit(t)}
                    >
                      {t.status === 'Changes Requested' ? 'Resubmit Proof' : 'Submit Proof'}
                    </Button>
                  )}
                  {t.status === 'Submitted' && (
                    <Badge variant="primary">Pending Review</Badge>
                  )}
                  {t.status === 'Approved' && (
                    <div className="approved-badge-row">
                      <CheckCircle size={16} className="text-success" />
                      <span className="approved-label">Approved (+10 pts awarded)</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={1}
        onPageChange={(p) => setCurrentPage(p)}
        totalItems={filteredTasks.length}
      />

      {/* Proof Submission Modal */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        title="Submit Task Proof"
        description={`Submit evidence for Task #${selectedTask?.id}: ${selectedTask?.title}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsSubmitModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                alert('Proof submission verified! In Phase 6, this calls POST /api/tasks/:id/submit/');
                setIsSubmitModalOpen(false);
              }}
            >
              Submit Evidence
            </Button>
          </>
        }
      >
        <div className="submission-modal-form">
          <Input
            label="GitHub Repository or PR URL"
            placeholder="https://github.com/techneekx/your-repo"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            helperText="Optional if providing screenshots or description."
          />
          <Textarea
            label="Work Summary & Evidence Description"
            placeholder="Describe the solution, key changes made, or link to hosted demo..."
            rows={4}
            value={proofDesc}
            onChange={(e) => setProofDesc(e.target.value)}
            required
          />
        </div>
      </Modal>
    </div>
  );
};
