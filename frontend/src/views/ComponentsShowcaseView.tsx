import React, { useState } from 'react';
import {
  Button,
  Input,
  Select,
  Textarea,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Alert,
  Skeleton,
  Breadcrumbs,
  Modal
} from '../components/ui';
import { Search, Send } from 'lucide-react';
import './ComponentsShowcaseView.css';

export const ComponentsShowcaseView: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [btnLoading, setBtnLoading] = useState(false);

  return (
    <div className="showcase-page">
      <Breadcrumbs items={[{ label: 'Design System' }, { label: 'Reusable UI Component Showcase' }]} />

      <div className="showcase-intro">
        <h2 className="showcase-heading">Design System & Reusable UI Components</h2>
        <p className="showcase-sub">
          A curated suite of accessible, polished SaaS dashboard components built on the TechNeekX token specifications.
        </p>
      </div>

      {/* 1. Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>1. Buttons & Interaction States</CardTitle>
          <CardDescription>Primary Red (#D7263D), hover states, secondary, outline, ghost, danger, sizes, and loading.</CardDescription>
        </CardHeader>
        <CardContent className="showcase-section">
          <div className="component-row">
            <Button variant="primary">Primary Blue</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </div>
          <div className="component-row">
            <Button size="sm">Small (32px)</Button>
            <Button size="md">Medium (40px)</Button>
            <Button size="lg">Large (46px)</Button>
            <Button
              isLoading={btnLoading}
              onClick={() => {
                setBtnLoading(true);
                setTimeout(() => setBtnLoading(false), 2000);
              }}
            >
              {btnLoading ? 'Processing...' : 'Click to Load'}
            </Button>
            <Button disabled>Disabled Button</Button>
            <Button leftIcon={<Send size={15} />}>With Left Icon</Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. Badges & Status Indicators */}
      <Card>
        <CardHeader>
          <CardTitle>2. Badges & Workflow Statuses</CardTitle>
          <CardDescription>Reflecting all task lifecycle states and user statuses.</CardDescription>
        </CardHeader>
        <CardContent className="showcase-section">
          <div className="component-row">
            <Badge status="Assigned" dot />
            <Badge status="In Progress" dot />
            <Badge status="Submitted" dot />
            <Badge status="Approved" dot />
            <Badge status="Changes Requested" dot />
          </div>
          <div className="component-row">
            <Badge status="Active" dot />
            <Badge status="Pending" dot />
            <Badge status="Inactive" dot />
            <Badge variant="primary">Tier 1: Executive</Badge>
            <Badge variant="warning">Tier 3: Core Lead</Badge>
          </div>
        </CardContent>
      </Card>

      {/* 3. Form Inputs */}
      <Card>
        <CardHeader>
          <CardTitle>3. Form Inputs, Selects & Textareas</CardTitle>
          <CardDescription>Accessible inputs with labels, icons, error states, and helper text.</CardDescription>
        </CardHeader>
        <CardContent className="showcase-section">
          <div className="form-demo-grid">
            <Input
              label="Task Title"
              placeholder="e.g. Build authentication endpoints"
              helperText="Brief summary of task requirement"
              required
            />
            <Input
              label="GitHub URL"
              placeholder="https://github.com/..."
              leftIcon={<Search size={16} />}
            />
            <Select
              label="Assigned Team"
              options={[
                { value: '1', label: 'Official Team' },
                { value: '2', label: 'Core Operations' },
                { value: '3', label: 'Development Team' },
              ]}
              placeholder="Select team..."
            />
            <Input
              label="Error State Input"
              defaultValue="invalid-format"
              error="Please enter a valid HTTPS URL."
            />
          </div>
          <Textarea
            label="Task Description"
            placeholder="Detailed description of deliverables..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* 4. Feedback & Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>4. Alerts & Notifications</CardTitle>
          <CardDescription>Status-specific alert banners with semantic contrast.</CardDescription>
        </CardHeader>
        <CardContent className="showcase-section">
          <Alert variant="info" title="Information Notice">
            Submissions for Sprint #3 close this Friday at 17:00 UTC.
          </Alert>
          <Alert variant="success" title="Review Approved">
            Task #4 was approved and +10 points were awarded to the contributor.
          </Alert>
          <Alert variant="warning" title="Action Needed">
            Reviewer requested changes: Please add unit test coverage before re-submitting.
          </Alert>
          <Alert variant="danger" title="Access Denied">
            You do not have permission to modify roles on this organization.
          </Alert>
        </CardContent>
      </Card>

      {/* 5. Skeleton Loading State */}
      <Card>
        <CardHeader>
          <CardTitle>5. Skeleton Placeholders</CardTitle>
          <CardDescription>Shimmer animated loading placeholders for tables and content cards.</CardDescription>
        </CardHeader>
        <CardContent className="showcase-section">
          <div className="skeleton-demo-row">
            <Skeleton circle width={44} height={44} />
            <div className="skeleton-text-group">
              <Skeleton width="60%" height={16} />
              <Skeleton width="40%" height={12} />
            </div>
          </div>
          <Skeleton height={70} />
        </CardContent>
      </Card>

      {/* 6. Modal Trigger Demo */}
      <Card>
        <CardHeader>
          <CardTitle>6. Accessible Modal Dialog</CardTitle>
          <CardDescription>Backdrop blur, focus containment, and keyboard escape handling.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setModalOpen(true)}>
            Open Demo Dialog Modal
          </Button>

          <Modal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Confirm Task Approval"
            description="Are you sure you want to approve this submission and award 10 points?"
            footer={
              <>
                <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
                <Button variant="primary" onClick={() => setModalOpen(false)}>Confirm & Approve</Button>
              </>
            }
          >
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              Approving this submission will transition the task to <strong>Approved</strong> and atomically increment the submitter's points in the live database performance ledger.
            </p>
          </Modal>
        </CardContent>
      </Card>
    </div>
  );
};
