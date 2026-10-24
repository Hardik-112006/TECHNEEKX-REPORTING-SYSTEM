import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import './Breadcrumbs.css';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  showHomeIcon?: boolean;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, showHomeIcon = true }) => {
  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs-nav">
      <ol className="breadcrumbs-list">
        {showHomeIcon && (
          <li className="breadcrumb-item">
            <span className="breadcrumb-home">
              <Home size={14} />
            </span>
            <ChevronRight size={14} className="breadcrumb-separator" />
          </li>
        )}
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.label} className="breadcrumb-item">
              {isLast || (!item.href && !item.onClick) ? (
                <span className="breadcrumb-current" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <button
                  type="button"
                  className="breadcrumb-link"
                  onClick={item.onClick}
                >
                  {item.label}
                </button>
              )}
              {!isLast && <ChevronRight size={14} className="breadcrumb-separator" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
