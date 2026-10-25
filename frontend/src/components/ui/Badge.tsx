import React from 'react';
import './Badge.css';

export type TaskStatus = 'Assigned' | 'In Progress' | 'Submitted' | 'Approved' | 'Changes Requested';
export type UserStatus = 'Active' | 'Inactive' | 'Pending';
export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'outline';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  status?: TaskStatus | UserStatus | string;
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant,
  status,
  size = 'md',
  dot = false,
  className = '',
  ...props
}) => {
  let resolvedVariant = variant || 'default';

  if (status) {
    switch (status) {
      case 'Pending':
        resolvedVariant = 'warning';
        break;
      case 'In Progress':
        resolvedVariant = 'primary';
        break;
      case 'Submitted':
      case 'Under Review':
        resolvedVariant = 'info';
        break;
      case 'Approved':
      case 'Completed':
      case 'Active':
        resolvedVariant = 'success';
        break;
      case 'Changes Requested':
      case 'Rejected':
      case 'Overdue':
        resolvedVariant = 'danger';
        break;
      case 'Cancelled':
      case 'Inactive':
      case 'Assigned':
      default:
        resolvedVariant = 'default';
        break;
    }
  }

  return (
    <span className={`badge badge-${resolvedVariant} badge-${size} ${className}`} {...props}>
      {dot && <span className="badge-dot" />}
      {children || status}
    </span>
  );
};
