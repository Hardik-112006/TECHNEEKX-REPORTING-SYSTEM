import React from 'react';
import './Badge.css';

export type TaskStatus = 'Assigned' | 'In Progress' | 'Submitted' | 'Approved' | 'Changes Requested';
export type UserStatus = 'Active' | 'Inactive' | 'Pending';
export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'outline';

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
    // Semantic workflow colors from the style guide: Assigned blue, In Progress amber,
    // Submitted violet, Approved green, Changes Requested / Overdue red.
    switch (status) {
      case 'Assigned':
        resolvedVariant = 'info';
        break;
      case 'Pending':
      case 'In Progress':
        resolvedVariant = 'warning';
        break;
      case 'Submitted':
      case 'Under Review':
        resolvedVariant = 'violet';
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
