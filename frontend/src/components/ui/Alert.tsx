import React from 'react';
import { Info, CheckCircle2, AlertTriangle, AlertCircle, X } from 'lucide-react';
import './Alert.css';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  description,
  children,
  onClose,
  className = ''
}) => {
  const renderIcon = () => {
    switch (variant) {
      case 'success':
        return <CheckCircle2 size={18} className="alert-icon" />;
      case 'warning':
        return <AlertTriangle size={18} className="alert-icon" />;
      case 'danger':
        return <AlertCircle size={18} className="alert-icon" />;
      default:
        return <Info size={18} className="alert-icon" />;
    }
  };

  return (
    <div className={`alert alert-${variant} ${className}`} role="alert">
      <div className="alert-content-wrapper">
        {renderIcon()}
        <div className="alert-text-block">
          {title && <h4 className="alert-title">{title}</h4>}
          <div className="alert-body">{children || description}</div>
        </div>
      </div>
      {onClose && (
        <button
          type="button"
          className="alert-close-btn"
          onClick={onClose}
          aria-label="Dismiss alert"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};
